/* Stratus Cloud integration for the Xbox replica.
   Uses the deployed Render API and the public Stratus site key.
   Static hosts such as raw.githack cannot call the Render API directly because
   the API does not currently emit browser CORS headers, so API requests are
   routed through a CORS proxy while the actual WebRTC embed stays direct. */
(() => {
'use strict';

const BASE = String(window.STRATUS_BASE || 'https://stratus-api-2.onrender.com').replace(/\/$/, '');
const CATALOG_SOURCES = [
  'https://raw.githubusercontent.com/evanjeffrey1212-eng/stratus-api/main/cloud.json',
  'https://cdn.jsdelivr.net/gh/evanjeffrey1212-eng/stratus-api@main/cloud.json'
];
const UPSTREAM_PUBLIC_KEY = 'stratus-api-synapsium';
const OWNERSHIP_KEY = 'xbox.stratus.owned.v2';
const DEFAULT_CORS_PROXY = 'https://corsproxy.io/?url=';
const key = () => window.STRATUS_API_KEY || UPSTREAM_PUBLIC_KEY;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

let catalogue = null;
let cataloguePromise = null;
let active = null;
let pending = null;
let starting = false;
let warmed = false;

function profileId(){
  return String(window.State?.data?.profileId || 'p1');
}

function readLicenses(){
  try {
    const raw = JSON.parse(localStorage.getItem(OWNERSHIP_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

function writeLicenses(data){
  try { localStorage.setItem(OWNERSHIP_KEY, JSON.stringify(data)); } catch {}
}

function licenseRows(){
  const all = readLicenses();
  const rows = all[profileId()];
  return Array.isArray(rows) ? rows : [];
}

function normalizeGame(raw, index){
  const gameKey = String(raw?.game_key || '').trim();
  const name = String(raw?.name || gameKey || `Cloud game ${index + 1}`);
  return {
    id: `stratus:${gameKey || index}`,
    numericId: index + 1,
    name,
    gameKey,
    description: String(raw?.description || ''),
    image: String(raw?.image || raw?.cover || ''),
    cover: String(raw?.cover || raw?.image || ''),
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String).filter(Boolean) : [],
    provider: 'Stratus Cloud',
    cloud: true,
    price: 0
  };
}

function warm(){
  if (warmed) return;
  warmed = true;
  // A no-cors request is enough to wake a sleeping Render instance. We do not
  // need to read the response here.
  try { fetch(`${BASE}/`, { mode:'no-cors', cache:'no-store' }).catch(() => {}); } catch {}
}

async function loadCatalogue(){
  warm();
  if (catalogue) return catalogue;
  if (cataloguePromise) return cataloguePromise;

  cataloguePromise = (async () => {
    let lastError;
    for (const url of CATALOG_SOURCES){
      try {
        const res = await fetch(url, { cache:'no-store' });
        if (!res.ok) throw new Error(`catalogue ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('catalogue response was not an array');
        catalogue = data.map(normalizeGame).filter(game => game.gameKey && game.name);
        return catalogue;
      } catch (err){
        lastError = err;
      }
    }
    throw lastError || new Error('Could not load the Stratus catalogue');
  })().finally(() => { cataloguePromise = null; });

  return cataloguePromise;
}

function owns(gameOrKey){
  const gameKey = String(gameOrKey?.gameKey || gameOrKey || '');
  return !!gameKey && licenseRows().some(row => String(row.gameKey) === gameKey);
}

function acquire(game){
  if (!game?.gameKey) return false;
  const all = readLicenses();
  const id = profileId();
  const rows = Array.isArray(all[id]) ? all[id] : [];
  if (rows.some(row => String(row.gameKey) === String(game.gameKey))) return false;
  rows.unshift({ gameKey:String(game.gameKey), acquiredAt:Date.now() });
  all[id] = rows;
  writeLicenses(all);
  window.dispatchEvent(new CustomEvent('stratus:library-change', { detail:{ type:'acquired', game } }));
  return true;
}

async function ownedGames(){
  const list = await loadCatalogue();
  const rows = licenseRows();
  const order = new Map(rows.map((row, i) => [String(row.gameKey), i]));
  return list
    .filter(game => order.has(String(game.gameKey)))
    .sort((a, b) => order.get(String(a.gameKey)) - order.get(String(b.gameKey)));
}

function cacheBust(url){
  const u = new URL(url);
  u.searchParams.set('_xbox', `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`);
  return u.toString();
}

function transportUrl(target){
  const apiOrigin = new URL(BASE).origin;
  const sameOrigin = location.origin === apiOrigin;
  if (sameOrigin || window.STRATUS_DIRECT === true) return target;

  if (typeof window.STRATUS_CORS_PROXY === 'function'){
    return window.STRATUS_CORS_PROXY(target);
  }

  const prefix = String(window.STRATUS_CORS_PROXY || DEFAULT_CORS_PROXY);
  if (prefix.includes('{url}')) return prefix.replace('{url}', encodeURIComponent(target));
  return prefix + encodeURIComponent(target);
}

async function api(path, { method='GET', body, signal } = {}){
  warm();
  const target = new URL(BASE + path);
  target.searchParams.set('_xbox', `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`);

  const options = {
    method,
    signal,
    cache:'no-store',
    headers:{
      'Accept':'application/json, application/x-ndjson, text/plain, */*',
      'x-api-key':key()
    }
  };

  if (method === 'GET'){
    // The API supports query auth too. Keeping it here makes the request work
    // even through proxies that do not forward custom request headers.
    target.searchParams.set('api_key', key());
  } else {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ ...(body || {}), api_key:key() });
  }

  const url = transportUrl(target.toString());
  let res;
  try {
    res = await fetch(url, options);
  } catch (err){
    const hint = location.origin !== new URL(BASE).origin
      ? 'The browser could not reach the Stratus API transport.'
      : 'The Stratus API could not be reached.';
    throw new Error(`${hint} ${err?.message || ''}`.trim());
  }

  if (!res.ok){
    let message = `Stratus returned ${res.status}`;
    try {
      const text = await res.text();
      try { message = JSON.parse(text)?.error || text || message; }
      catch { if (text) message = text.slice(0, 220); }
    } catch {}
    throw new Error(message);
  }
  return res;
}

function statusText(event){
  switch (event?.status){
    case 'creating_account': return 'Preparing your cloud console…';
    case 'account_ready': return 'Cloud console ready…';
    case 'requesting_game': return 'Starting the game…';
    case 'queue': return `Waiting for a cloud console${Number.isFinite(event.queue_pos) ? ` • ${event.queue_pos} ahead` : '…'}`;
    case 'finished_queue': return 'Cloud console ready…';
    default: return 'Starting cloud game…';
  }
}

async function pollQueue(uuid, onStatus, signal){
  while (!signal?.aborted){
    await wait(3400);
    const res = await api(`/cloud/v1/getQueue?uuid=${encodeURIComponent(uuid)}`, { signal });
    const event = await res.json();
    onStatus?.(event);
    if (event.status === 'finished_queue') return event.uuid || uuid;
    if (event.status !== 'queue') throw new Error(event.error || 'Unexpected queue response');
  }
  throw new DOMException('Aborted', 'AbortError');
}

function handleSessionEvent(event, onStatus){
  if (!event || typeof event !== 'object') return null;
  onStatus?.(event);
  if (event.status === 'error') throw new Error(event.error || 'Cloud session failed');
  if (event.status === 'finished_queue' && event.uuid) return { done:true, uuid:event.uuid };
  if (event.status === 'queue' && event.uuid) return { queue:true, uuid:event.uuid };
  return null;
}

async function createSession(gameKey, onStatus, signal){
  const res = await api('/cloud/v1/createSession', {
    method:'POST',
    body:{ game_key:gameKey },
    signal
  });

  // Read NDJSON incrementally where possible. Some CORS proxies buffer the
  // response, so this also correctly handles a complete response delivered at once.
  if (!res.body?.getReader){
    const text = await res.text();
    for (const line of text.split(/\r?\n/)){
      if (!line.trim()) continue;
      let event; try { event = JSON.parse(line); } catch { continue; }
      const result = handleSessionEvent(event, onStatus);
      if (result?.done) return result.uuid;
      if (result?.queue) return pollQueue(result.uuid, onStatus, signal);
    }
    throw new Error('Stratus session ended before a server became ready');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consume = async line => {
    if (!line.trim()) return null;
    let event; try { event = JSON.parse(line); } catch { return null; }
    const result = handleSessionEvent(event, onStatus);
    if (result?.done){
      try { await reader.cancel(); } catch {}
      return result.uuid;
    }
    if (result?.queue){
      try { await reader.cancel(); } catch {}
      return pollQueue(result.uuid, onStatus, signal);
    }
    return null;
  };

  while (!signal?.aborted){
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream:!done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines){
      const result = await consume(line);
      if (result) return result;
    }
    if (done){
      if (buffer.trim()){
        const result = await consume(buffer);
        if (result) return result;
      }
      break;
    }
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  throw new Error('Stratus session ended before a server became ready');
}

async function startGame(uuid, signal){
  const res = await api('/cloud/v1/startGame', {
    method:'POST',
    body:{ uuid },
    signal
  });
  const data = await res.json();
  if (!data?.signaling_ws || !Array.isArray(data?.ice_servers)){
    throw new Error('Stratus returned incomplete WebRTC credentials');
  }
  return data;
}

function launchSurface(game){
  const splash = document.getElementById('launch');
  const art = document.getElementById('launchArt');
  const title = document.getElementById('launchTitle');
  const sub = splash?.querySelector('.launch-sub');
  if (art) art.style.backgroundImage = game.image ? `url("${game.image}")` : '';
  if (title) title.textContent = game.name;
  if (sub) sub.textContent = 'Connecting to Xbox Cloud Gaming…';
  if (splash) splash.hidden = false;
  window.Nav?.hideRing?.();
  return { splash, sub };
}

function showPlayer(game, uuid){
  const player = document.getElementById('player');
  const frame = document.getElementById('playerFrame');
  const hint = document.getElementById('playerHint');
  if (!player || !frame) throw new Error('Player surface is missing');

  frame.src = `${BASE}/cloud/v1/embed?id=${encodeURIComponent(uuid)}&_=${Date.now()}`;
  frame.setAttribute('allow', 'autoplay; fullscreen; gamepad; pointer-lock');
  player.hidden = false;
  player.classList.add('cloud-player');
  hint.textContent = 'Press Esc or B to return to Xbox';
  hint?.classList.remove('hide');
  setTimeout(() => hint?.classList.add('hide'), 5000);
  window.Nav?.pushLayer?.(player);
  window.Nav?.hideRing?.();
  setTimeout(() => frame.focus?.(), 60);
  window.Guide?.notify?.({ title:'Cloud game started', text:game.name, icon:'' });
}

async function play(game){
  if (!game?.gameKey || starting) return;
  if (!owns(game)) throw new Error('This game is not in your library yet.');
  if (active) await quit();

  starting = true;
  const controller = new AbortController();
  pending = { game, controller, uuid:null };
  const { splash, sub } = launchSurface(game);

  try {
    const uuid = await createSession(game.gameKey, event => {
      if (sub) sub.textContent = statusText(event);
      if (event?.uuid && pending) pending.uuid = event.uuid;
    }, controller.signal);
    if (!uuid) throw new Error('Stratus did not return a session ID');
    if (pending) pending.uuid = uuid;

    if (sub) sub.textContent = 'Opening cloud stream…';
    const session = await startGame(uuid, controller.signal);
    active = { uuid, game, controller, session, pingTimer:null };
    pending = null;

    const ping = () => api('/cloud/v1/pingSession', { method:'POST', body:{ uuid } }).catch(err => {
      console.warn('[Stratus] ping failed', err);
    });
    active.pingTimer = setInterval(ping, 15_000);

    if (splash) splash.hidden = true;
    showPlayer(game, uuid);
  } catch (err){
    const pendingUuid = pending?.uuid;
    pending = null;
    if (pendingUuid){
      api('/cloud/v1/quitSession', { method:'POST', body:{ uuid:pendingUuid } }).catch(() => {});
    }
    if (sub) sub.textContent = err?.name === 'AbortError'
      ? 'Cloud session cancelled.'
      : `Could not start cloud game: ${err?.message || 'Unknown error'}`;
    window.Sound?.error?.();
    setTimeout(() => {
      if (splash) splash.hidden = true;
      window.Nav?.setRingVisible?.(true);
      window.Nav?.repaint?.();
    }, 4200);
  } finally {
    starting = false;
  }
}

async function quit(){
  if (pending && !active){
    const p = pending;
    pending = null;
    try { p.controller?.abort?.(); } catch {}
    if (p.uuid) api('/cloud/v1/quitSession', { method:'POST', body:{ uuid:p.uuid } }).catch(() => {});
    const splash = document.getElementById('launch');
    if (splash) splash.hidden = true;
    starting = false;
    window.Nav?.setRingVisible?.(true);
    window.Nav?.restore?.();
    return;
  }

  const session = active;
  active = null;
  if (!session) return;

  clearInterval(session.pingTimer);
  session.controller?.abort?.();
  api('/cloud/v1/quitSession', { method:'POST', body:{ uuid:session.uuid } }).catch(() => {});

  const frame = document.getElementById('playerFrame');
  const player = document.getElementById('player');
  if (frame) frame.src = 'about:blank';
  if (player){ player.hidden = true; player.classList.remove('cloud-player'); }
  try { window.Nav?.popLayer?.(); } catch {}
  window.Nav?.setRingVisible?.(true);
  window.Nav?.restore?.();
  window.Sound?.back?.();
}

window.addEventListener('nav:button', event => {
  if (!active && !pending) return;
  if (event.detail?.button === 'b') quit();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (active || pending)){
    event.preventDefault();
    quit();
  }
});

addEventListener('pagehide', () => {
  const uuid = active?.uuid || pending?.uuid;
  if (!uuid) return;
  // Best-effort teardown. sendBeacon cannot set the API header, so include the
  // public key in the JSON body, which the Stratus auth middleware accepts.
  try {
    navigator.sendBeacon?.(
      transportUrl(cacheBust(`${BASE}/cloud/v1/quitSession`)),
      new Blob([JSON.stringify({ uuid, api_key:key() })], { type:'application/json' })
    );
  } catch {}
});

warm();

window.StratusCloud = {
  BASE,
  loadCatalogue,
  ownedGames,
  owns,
  acquire,
  play,
  quit,
  warm,
  get active(){ return active; },
  get starting(){ return starting; }
};
})();