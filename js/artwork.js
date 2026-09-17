/* ═══════════════════════════════════════════════════════════
   ARTWORK — high quality 16:9 / widescreen game backdrops.

   Home cover icons stay untouched. Backdrops now prefer a small curated set
   of current, clean key-art sources for the games that actually live on Home,
   then fall back to a scored SteamGridDB hero lookup.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const DEFAULT_KEY = '4013cee64ddceaa6dfab638c7e90eb79';
const KEY_STORE   = 'xbox.web.sgdb.key';
/* v2 intentionally clears the old "first image wins" wallpaper cache. */
const CACHE_STORE = 'xbox.web.sgdb.cache.v2';
const API = 'https://www.steamgriddb.com/api/v2';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 14;

const normal = value => String(value || '')
  .toLowerCase()
  .replace(/[™®©:’'–—-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* Current/clean sources for the Home shelf. Steam raw page backgrounds are
   maintained with the live store assets, so GTA V uses Enhanced-era art
   instead of the old 2013 backdrop. The Fortnite image is current 2026 key art.
   Each entry is a candidate list so one CDN failure never leaves Home blank. */
const CURATED = new Map([
  [normal('Forza Horizon 5'), [
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1551360/page_bg_raw.jpg'
  ]],
  [normal('Grand Theft Auto V'), [
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3240220/page_bg_raw.jpg'
  ]],
  [normal('GTA V'), [
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3240220/page_bg_raw.jpg'
  ]],
  [normal('Hollow Knight: Silksong'), [
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1030300/page_bg_raw.jpg',
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1030300/26950369fe4b03c2268620eb9815c8a246aa0b06/ss_26950369fe4b03c2268620eb9815c8a246aa0b06.1920x1080.jpg'
  ]],
  [normal('Elden Ring'), [
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/page_bg_raw.jpg'
  ]],
  [normal('Red Dead Redemption 2'), [
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1174180/page_bg_raw.jpg'
  ]],
  [normal('Fortnite'), [
    'https://cms-assets.unrealengine.com/cm6l5gfpm05kr07my04cqgy2x/cmt14h2ardvpq07o76t76zt0m'
  ]]
]);

/* Better search strings for games whose common short title can resolve to an
   older entry or the wrong edition on SteamGridDB. */
const SEARCH_ALIAS = new Map([
  [normal('Grand Theft Auto V'), 'Grand Theft Auto V Enhanced'],
  [normal('GTA V'), 'Grand Theft Auto V Enhanced'],
  [normal('Minecraft'), 'Minecraft Java & Bedrock Edition'],
  [normal('Fortnite'), 'Fortnite Battle Royale'],
  [normal('Hollow Knight: Silksong'), 'Hollow Knight Silksong']
]);

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
  }, 250);
}

const inflight = new Map();
const probed = new Map();

function imageWorks(url, timeout = 2600){
  if (!url) return Promise.resolve(false);
  if (probed.has(url)) return probed.get(url);
  const job = new Promise(resolve => {
    const img = new Image();
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeout);
    img.onload = () => finish(img.naturalWidth >= 900 && img.naturalHeight >= 450);
    img.onerror = () => finish(false);
    img.decoding = 'async';
    img.src = url;
  });
  probed.set(url, job);
  return job;
}

async function curatedHero(name){
  const candidates = CURATED.get(normal(name)) || [];
  for (const url of candidates){
    if (await imageWorks(url)) return url;
  }
  return null;
}

function rankHero(row){
  if (!row?.url) return -Infinity;
  const dims = String(row.dimensions || '');
  const [w = 0, h = 0] = dims.split('x').map(Number);
  const ratio = w && h ? w / h : 0;
  let score = Number(row.score || 0) * 30;
  if (w >= 1920) score += 50;
  if (w >= 3840) score += 18;
  /* Home is 16:9. SteamGridDB heroes are often ultrawide, so reward anything
     closer to TV aspect without throwing away strong official-looking art. */
  if (ratio) score += Math.max(0, 35 - Math.abs(ratio - (16 / 9)) * 28);
  if (row.nsfw) score -= 1000;
  if (row.humor) score -= 500;
  return score;
}

async function steamGridHero(name, key){
  if (!key || !name) return null;
  const headers = { Authorization: `Bearer ${key}` };
  const query = SEARCH_ALIAS.get(normal(name)) || name;

  const found = await fetch(
    `${API}/search/autocomplete/${encodeURIComponent(query)}`, { headers });
  if (!found.ok) throw new Error('search ' + found.status);
  const list = (await found.json())?.data || [];
  if (!list.length) return null;

  /* Try the first few autocomplete matches instead of blindly trusting #1. */
  for (const game of list.slice(0, 3)){
    const heroes = await fetch(
      `${API}/heroes/game/${game.id}?dimensions=1920x620,3840x1240`, { headers });
    if (!heroes.ok) continue;
    const art = ((await heroes.json())?.data || [])
      .filter(row => row?.url && !row?.nsfw && !row?.humor)
      .sort((a, b) => rankHero(b) - rankHero(a));

    for (const row of art.slice(0, 6)){
      if (await imageWorks(row.url)) return row.url;
    }
  }
  return null;
}

const Artwork = {
  get key(){
    try { return localStorage.getItem(KEY_STORE) || DEFAULT_KEY; }
    catch { return DEFAULT_KEY; }
  },
  get usingDefault(){
    try { return !localStorage.getItem(KEY_STORE); } catch { return true; }
  },
  setKey(value){
    try {
      const clean = String(value || '').trim();
      if (clean) localStorage.setItem(KEY_STORE, clean);
      else localStorage.removeItem(KEY_STORE);
    } catch {}
  },
  /* Curated art works even if the optional SGDB key is unavailable. */
  get enabled(){ return true; },

  clearCache(){
    cache = {};
    probed.clear();
    try { localStorage.removeItem(CACHE_STORE); } catch {}
  },

  stats(){
    const rows = Object.values(cache);
    return {
      looked: rows.length,
      found: rows.filter(r => r && r.url).length,
      curated: rows.filter(r => r && r.source === 'curated').length
    };
  },

  async hero(name){
    if (!name) return null;
    const id = normal(name);
    const hit = cache[id];
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.url;
    if (inflight.has(id)) return inflight.get(id);

    const job = (async () => {
      try {
        const handPicked = await curatedHero(name);
        if (handPicked){
          cache[id] = { url:handPicked, source:'curated', at:Date.now() };
          saveCache();
          return handPicked;
        }

        const url = await steamGridHero(name, Artwork.key);
        cache[id] = { url, source:url ? 'steamgriddb' : 'none', at:Date.now() };
        saveCache();
        return url;
      } catch {
        /* Do not poison the cache on an API outage/rate limit. */
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
