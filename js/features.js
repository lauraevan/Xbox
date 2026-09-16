/* ═══════════════════════════════════════════════════════════
   FEATURES — the console services that need real storage or
   real network work, rather than just a settings toggle.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ───────────────────────── captures ─────────────────────────
   Screenshots live in IndexedDB as blobs; localStorage would blow
   its quota on the first capture. */
const DB_NAME = 'xbox.captures';
const STORE = 'shots';
let dbPromise = null;

function db(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE))
        d.createObjectStore(STORE, { keyPath:'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => resolve(result.result ?? result);
    t.onerror    = () => reject(t.error);
  });
};

const Captures = {
  async save(blob, meta = {}){
    const record = {
      id: 'c' + Date.now().toString(36),
      at: Date.now(),
      title: meta.title || 'Dashboard',
      kind: meta.kind || 'screenshot',
      blob
    };
    await tx('readwrite', store => store.put(record));
    return record;
  },
  async list(){
    const all = await tx('readonly', store => store.getAll());
    return (all || []).sort((a, b) => b.at - a.at);
  },
  async remove(id){ return tx('readwrite', store => store.delete(id)); },
  async clear(){ return tx('readwrite', store => store.clear()); },
  async count(){
    try { return (await Captures.list()).length; } catch { return 0; }
  },
  async bytes(){
    try {
      const all = await Captures.list();
      return all.reduce((n, r) => n + (r.blob?.size || 0), 0);
    } catch { return 0; }
  }
};

/* ──────────────────── network diagnostics ────────────────────
   Tests the same mirrors the cover loader uses, so "why is the art
   missing" has an answer on the console itself rather than in
   devtools. */
const Network = {
  async test(onProgress){
    const sources = window.Media.COVER_SOURCES;
    const names = ['jsDelivr (cdn)', 'jsDelivr (fastly)', 'jsDelivr (gcore)',
                   'GitHub raw', 'wsrv proxy'];
    const results = [];

    for (let i = 0; i < sources.length; i++){
      const url = sources[i]('0.png') + (sources[i]('0.png').includes('?') ? '&' : '?') + 'cb=' + Date.now();
      const started = performance.now();
      const ok = await new Promise(resolve => {
        const img = new Image();
        const timer = setTimeout(() => { img.src = ''; resolve(false); }, 8000);
        img.onload  = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
        img.onerror = () => { clearTimeout(timer); resolve(false); };
        img.src = url;
      });
      const ms = Math.round(performance.now() - started);
      results.push({ name: names[i] || `mirror ${i + 1}`, ok, ms });
      onProgress?.(results.slice());
    }
    return results;
  },

  async manifest(){
    const started = performance.now();
    try {
      const res = await fetch(window.Catalog.state.source ||
        'https://cdn.jsdelivr.net/gh/bestsabplayerox/assets@main/zones.json',
        { cache:'no-store' });
      return { ok: res.ok, ms: Math.round(performance.now() - started), status: res.status };
    } catch {
      return { ok:false, ms: Math.round(performance.now() - started), status: 0 };
    }
  },

  info(){
    const c = navigator.connection || {};
    return {
      online: navigator.onLine,
      type: c.effectiveType || 'unknown',
      downlink: c.downlink ? `${c.downlink} Mb/s` : 'unknown',
      rtt: c.rtt != null ? `${c.rtt} ms` : 'unknown',
      saveData: c.saveData === true
    };
  }
};

/* ───────────────────────── screen time ─────────────────────────
   Counts minutes spent in games today and enforces the family limit. */
const TIME_KEY = 'xbox.web.screentime.v1';

function today(){ return new Date().toISOString().slice(0, 10); }

function readTime(){
  try {
    const raw = JSON.parse(localStorage.getItem(TIME_KEY) || '{}');
    return raw.day === today() ? raw : { day: today(), seconds: 0 };
  } catch { return { day: today(), seconds: 0 }; }
}

const ScreenTime = {
  get(){ return readTime(); },
  add(seconds){
    const t = readTime();
    t.seconds += seconds;
    try { localStorage.setItem(TIME_KEY, JSON.stringify(t)); } catch {}
    return t;
  },
  minutes(){ return Math.floor(readTime().seconds / 60); },
  limit(){ return window.State.settings.screenTimeLimit || 0; },
  remaining(){
    const limit = ScreenTime.limit();
    return limit ? Math.max(0, limit - ScreenTime.minutes()) : Infinity;
  },
  exceeded(){ return ScreenTime.limit() > 0 && ScreenTime.remaining() <= 0; },
  reset(){ try { localStorage.removeItem(TIME_KEY); } catch {} }
};

/* ───────────────────────── quick resume ─────────────────────────
   The console keeps a handful of titles suspended. A browser cannot
   hold real game state across a reload, so this tracks the slots and
   drops you back into the title at the point the dashboard knows
   about — which is honest about what it can restore. */
const RESUME_KEY = 'xbox.web.resume.v1';
const SLOTS = 4;

const QuickResume = {
  slots(){
    try { return JSON.parse(localStorage.getItem(RESUME_KEY) || '[]'); }
    catch { return []; }
  },
  push(game){
    let slots = QuickResume.slots().filter(s => s.id !== String(game.id));
    slots.unshift({ id:String(game.id), name:game.name, at:Date.now() });
    slots = slots.slice(0, SLOTS);
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(slots)); } catch {}
    return slots;
  },
  drop(id){
    const slots = QuickResume.slots().filter(s => s.id !== String(id));
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(slots)); } catch {}
    return slots;
  },
  clear(){ try { localStorage.removeItem(RESUME_KEY); } catch {} }
};

/* ───────────────────────── storage ───────────────────────── */
const Storage = {
  async usage(){
    let quota = null, usage = null;
    try {
      const est = await navigator.storage?.estimate?.();
      if (est){ quota = est.quota; usage = est.usage; }
    } catch {}
    let local = 0;
    try {
      for (const k in localStorage) if (Object.hasOwn(localStorage, k))
        local += (localStorage[k]?.length || 0) * 2;
    } catch {}
    return { quota, usage, local, captures: await Captures.bytes() };
  },
  format(bytes){
    if (bytes == null) return 'unknown';
    const units = ['B','KB','MB','GB'];
    let n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1){ n /= 1024; i++; }
    return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
  }
};

/* ───────────────────────── wallpaper ─────────────────────────
   A 1080p image is too big for localStorage, so the picked file lives in
   IndexedDB alongside captures and is handed back as an object URL. */
const WALL_STORE = 'wallpaper';

const Wallpaper = {
  async set(blob){
    await tx('readwrite', store => store.put({ id: WALL_STORE, at: Date.now(), blob }));
  },
  async get(){
    try {
      const rec = await tx('readonly', store => store.get(WALL_STORE));
      return rec?.blob || null;
    } catch { return null; }
  },
  async clear(){ try { await tx('readwrite', store => store.delete(WALL_STORE)); } catch {} },

  /** An object URL for the stored image, or null. */
  async url(){
    const blob = await Wallpaper.get();
    return blob ? URL.createObjectURL(blob) : null;
  },

  /** Open a file picker and store what comes back. */
  pick(){
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try { await Wallpaper.set(file); resolve(await Wallpaper.url()); }
        catch { resolve(null); }
      }, { once: true });
      input.click();
    });
  }
};

window.Features = { Captures, Network, ScreenTime, QuickResume, Storage, Wallpaper };
})();
