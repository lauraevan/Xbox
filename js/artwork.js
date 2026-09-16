/* ═══════════════════════════════════════════════════════════
   ARTWORK — optional 16:9 hero art from SteamGridDB.

   The catalogue ships square covers, which is why the backdrop has
   always been a blurred crop. SteamGridDB carries proper widescreen
   key art for titles that also exist on Steam.

   The API key is NEVER stored in this repository. It is pasted in
   under Settings and kept in localStorage on the device that uses it,
   because this repo is public and anything committed here is readable
   by anyone. Note that a key used from a browser is visible to anyone
   with devtools open on that page regardless — treat it as low-value
   and revocable, not a secret.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const KEY_STORE   = 'xbox.web.sgdb.key';
const CACHE_STORE = 'xbox.web.sgdb.cache.v1';
const API = 'https://www.steamgriddb.com/api/v2';

/* A miss is cached as well as a hit: most of this catalogue is browser
   and Flash originals that SteamGridDB will never carry, and re-asking
   for them on every focus would waste the rate limit. */
const CACHE_TTL = 1000 * 60 * 60 * 24 * 14;

function readCache(){
  try { return JSON.parse(localStorage.getItem(CACHE_STORE) || '{}'); }
  catch { return {}; }
}
let cache = readCache();
let writeTimer = null;
function saveCache(){
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try { localStorage.setItem(CACHE_STORE, JSON.stringify(cache)); } catch {}
  }, 300);
}

const inflight = new Map();

const Artwork = {
  get key(){
    try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; }
  },
  setKey(value){
    try {
      const clean = String(value || '').trim();
      if (clean) localStorage.setItem(KEY_STORE, clean);
      else localStorage.removeItem(KEY_STORE);
    } catch {}
  },
  get enabled(){ return !!Artwork.key; },

  clearCache(){
    cache = {};
    try { localStorage.removeItem(CACHE_STORE); } catch {}
  },

  stats(){
    const rows = Object.values(cache);
    return {
      looked: rows.length,
      found:  rows.filter(r => r && r.url).length
    };
  },

  /**
   * Widescreen art for a title, or null when there is none.
   * Never throws and never blocks the caller: the dashboard keeps its
   * cover-based backdrop unless this resolves.
   */
  async hero(name){
    if (!Artwork.enabled || !name) return null;

    const id = String(name).toLowerCase();
    const hit = cache[id];
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.url;
    if (inflight.has(id)) return inflight.get(id);

    const job = (async () => {
      try {
        const headers = { Authorization: `Bearer ${Artwork.key}` };

        const found = await fetch(
          `${API}/search/autocomplete/${encodeURIComponent(name)}`, { headers });
        if (!found.ok) throw new Error('search ' + found.status);
        const list = (await found.json())?.data || [];
        if (!list.length){ cache[id] = { url:null, at:Date.now() }; saveCache(); return null; }

        const heroes = await fetch(
          `${API}/heroes/game/${list[0].id}?dimensions=1920x620,3840x1240`, { headers });
        if (!heroes.ok) throw new Error('heroes ' + heroes.status);
        const art = (await heroes.json())?.data || [];
        const url = art[0]?.url || null;

        cache[id] = { url, at: Date.now() };
        saveCache();
        return url;
      } catch {
        // a failed lookup is not cached, so a rate limit or an outage
        // does not poison the entry for a fortnight
        return null;
      } finally {
        inflight.delete(id);
      }
    })();

    inflight.set(id, job);
    return job;
  }
};

window.Artwork = Artwork;
})();
