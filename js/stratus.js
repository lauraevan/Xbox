/* Stratus Cloud integration for the Xbox replica.
   Uses the deployed Render API, tries it directly first, then falls back to
   browser-safe proxy transports when the static host is blocked by CORS. */
(() => {
'use strict';

const BASE = String(window.STRATUS_BASE || 'https://stratus-api-2.onrender.com').replace(/\/$/, '');
const PUBLIC_KEY = 'stratus-api-synapsium';
const OWNERSHIP_KEY = 'xbox.stratus.owned.v2';
const CATALOG_SOURCES = [
  'https://raw.githubusercontent.com/evanjeffrey1212-eng/stratus-api/main/cloud.json',
  'https://cdn.jsdelivr.net/gh/evanjeffrey1212-eng/stratus-api@main/cloud.json'
];
const DEFAULT_PROXIES = [
  target => `https://corsproxy.io/?url=${encodeURIComponent(target)}`,
  target => `https://api.cors.lol/?url=${encodeURIComponent(target)}`
];

const key = () => String(window.STRATUS_API_KEY || PUBLIC_KEY);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isAbort = err => err?.name === 'AbortError';

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
    const value = JSON.parse(localStorage.getItem(OWNERSHIP_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}

function writeLicenses(value){
  try { localStorage.setItem(OWNERSHIP_KEY, JSON.stringify(value)); } catch {}
}

function licenseRows(){
  const rows = readLicenses()[profileId()];
  return Array.isArray(rows) ? rows : [];
}

function normalizeGame(raw, index){
  const gameKey = String(raw?.game_key || '').trim();
  const name = String(raw?.name || gameKey || `Cloud game ${index + 1}`).trim();
  return {
    id:`stratus:${gameKey || index}`,
    numericId:index + 1,
    name,
    gameKey,
    description:String(raw?.description || ''),
    image:String(raw?.image || raw?.cover || ''),
    cover:String(raw?.cover || raw?.image || ''),
    tags:Array.isArray(raw?.tags) ? raw.tags.map(String).filter(Boolean) : [],
    provider:'Stratus Cloud',
    cloud:true,
    price:0
  };
}

function warm(){
  if (warmed) return;
  warmed = true;
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
      } catch (err){ lastError = err; }
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
  const order = new Map(licenseRows().map((row, i) => [String(row.gameKey), i]));
  return list
    .filter(game => order.has(String(game.gameKey)))
    .sort((a,b) => order.get(String(a.gameKey)) - order.get(String(b.gameKey)));
}

function buildTarget(path){
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', key());
  url.searchParams.set('_xbox', `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`);
  return url.toString();
}

function proxyBuilders(){
  const list = [];
  const custom = window.STRATUS_CORS_PROXY;

  if (typeof custom === 'function') list.push(custom);
  else if (typeof custom === 'string' && custom){
    list.push(target => custom.includes('{url}')
      ? custom.replace('{url}', encodeURIComponent(target))
      : custom + encodeURIComponent(target));
  }

  if (window.STRATUS_DISABLE_DEFAULT_PROXIES !== true) list.push(...DEFAULT_PROXIES);
  return list;
}

function requestInit(method, body, signal){
  const init = {
    method,
    signal,
    cache:'no-store',
    headers:{ 'Accept':'application/json, application/x-ndjson, text/plain, */*' }
  };
  if (method !== 'GET'){
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body || {});
  }
  return init;
}

async function fetchOnce(url, init, timeoutMs){
  if (init.signal?.aborted) throw new DOMException('Aborted','AbortError');

  const timeout = new AbortController();
  const abort = () => timeout.abort();
  init.signal?.addEventListener?.('abort', abort, { once:true });
  const timer = setTimeout(() => timeout.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal:timeout.signal });
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener?.('abort', abort);
  }
}

async function api(path, { method='GET', body, signal, timeoutMs=45_000 } = {}){
  warm();
  const target = buildTarget(path);
  const attempts = [];

  // Direct first. This is fastest when the API deployment itself has CORS.
  attempts.push({ label:'direct', url:target });
  proxyBuilders().forEach((build, index) => {
    try { attempts.push({ label:`proxy-${index + 1}`, url:build(target) }); } catch {}
  });

  let lastError = null;
  for (let i = 0; i < attempts.length; i++){
    const attempt = attempts[i];
    if (signal?.aborted) throw new DOMException('Aborted','AbortError');

    // A direct CORS failure happens immediately. Proxy attempts get the full
    // timeout because createSession can legitimately stay open while queuing.
    const attemptTimeout = attempt.label === 'direct' ? Math.min(timeoutMs, 8_000) : timeoutMs;

    for (let retry = 0; retry < 2; retry++){
      try {
        const res = await fetchOnce(attempt.url, requestInit(method, body, signal), attemptTimeout);

        // 502/503/504 are common while Render is waking. Retry once on the same transport.
        if ([502,503,504].includes(res.status) && retry === 0){
          await sleep(900);
          continue;
        }

        if (!res.ok){
          let message = `Stratus returned ${res.status}`;
          try {
            const text = await res.text();
            try { message = JSON.parse(text)?.error || text || message; }
            catch { if (text) message = text.slice(0,220); }
          } catch {}

          // Proxy services can reject a requesting domain or method themselves.
          // Try the next transport before surfacing those proxy-level failures.
          if (attempt.label !== 'direct' && [400,401,403,405,429].includes(res.status)){
            lastError = new Error(`${attempt.label}: ${message}`);
            break;
          }
          throw new Error(message);
        }

        window.dispatchEvent(new CustomEvent('stratus:transport', {
          detail:{ transport:attempt.label }
        }));
        return res;
      } catch (err){
        if (isAbort(err) && signal?.aborted) throw err;
        lastError = err;
        if (retry === 0 && !isAbort(err)){
          await sleep(450);
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`Could not reach Stratus. ${lastError?.message || 'All transports failed.'}`);
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
    await sleep(3000);
    const res = await api(`/cloud/v1/getQueue?uuid=${encodeURIComponent(uuid)}`, { signal, timeoutMs:20_000 });
    const event = await res.json();
    onStatus?.(event);
    if (event.status === 'finished_queue') return event.uuid || uuid;
    if (event.status !== 'queue') throw new Error(event.error || 'Unexpected queue response');
  }
  throw new DOMException('Aborted','AbortError');
}

function handleSessionEvent(event, onStatus){
  if (!event || typeof event !== 'object') return null;
  onStatus?.(event);
  if (event.status === 'error') throw new Error(event.error || 'Cloud session failed');
  if (event.status === 'finished_queue') return { done:true, uuid:event.uuid };
  if (event.status === 'queue' && event.uuid) return { queue:true, uuid:event.uuid };
  return null;
}

async function createSession(gameKey, onStatus, signal){
  const res = await api('/cloud/v1/createSession', {
    method:'POST',
    body:{ game_key:gameKey },
    signal,
    timeoutMs:180_000
  });

  if (!res.body?.getReader){
    const text = await res.text();
    let queuedUuid = null;
    for (const line of text.split(/\r?\n/)){
      if (!line.trim()) continue;
      let event; try { event = JSON.parse(line); } catch { continue; }
      const result = handleSessionEvent(event, onStatus);
      if (result?.done) return result.uuid || queuedUuid;
      if (result?.queue) queuedUuid = result.uuid;
    }
    if (queuedUuid) return pollQueue(queuedUuid, onStatus, signal);
    throw new Error('Stratus session ended before a server became ready');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal?.aborted){
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream:!done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines){
      if (!line.trim()) continue;
      let event; try { event = JSON.parse(line); } catch { continue; }
      const result = handleSessionEvent(event, onStatus);
      if (result?.done){
        try { await reader.cancel(); } catch {}
        return result.uuid;
      }
      if (result?.queue){
        try { await reader.cancel(); } catch {}
        return pollQueue(result.uuid, onStatus, signal);
      }
    }

    if (done){
      if (buffer.trim()){
        let event; try { event = JSON.parse(buffer); } catch { event = null; }
        const result = handleSessionEvent(event, onStatus);
        if (result?.done) return result.uuid;
        if (result?.queue) return pollQueue(result.uuid, onStatus, signal);
      }
      break;
    }
  }

  if (signal?.aborted) throw new DOMException('Aborted','AbortError');
  throw new Error('Stratus session ended before a server became ready');
}

async function startGame(uuid, signal){
  const res = await api('/cloud/v1/startGame', {
    method:'POST',
    body:{ uuid },
    signal,
    timeoutMs:30_000
  });
  const data = await res.json();
  if (!data?.signaling_ws || !Array.isArray(data?.ice_servers))
    throw new Error('Stratus returned incomplete WebRTC credentials');
  return data;
}

function launchSurface(game){
  const splash = document.getElementById('launch');
  const art = document.getElementById('launchArt');
  const title = document.getElementById('launchTitle');
  const sub = splash?.querySelector('.launch-sub');
  if (art) art.style.backgroundImage = (game.image || game.cover) ? `url("${game.image || game.cover}")` : '';
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
  frame.referrerPolicy = 'no-referrer';
  player.hidden = false;
  player.classList.add('cloud-player');
  if (hint){
    hint.textContent = 'Press Esc or B to return to Xbox';
    hint.classList.remove('hide');
    setTimeout(() => hint.classList.add('hide'), 5000);
  }
  window.Nav?.pushLayer?.(player);
  window.Nav?.hideRing?.();
  setTimeout(() => frame.focus?.(), 80);
  window.Guide?.notify?.({ title:'Cloud game started', text:game.name, icon:'' });
}

async function play(game){
  if (!game?.gameKey) throw new Error('This title has no Stratus game key.');
  if (starting) return;
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

    const ping = () => api('/cloud/v1/pingSession', {
      method:'POST', body:{ uuid }, timeoutMs:20_000
    }).catch(err => console.warn('[Stratus] ping failed', err));
    active.pingTimer = setInterval(ping, 15_000);

    if (splash) splash.hidden = true;
    showPlayer(game, uuid);
  } catch (err){
    const uuid = pending?.uuid;
    pending = null;
    if (uuid){
      api('/cloud/v1/quitSession', { method:'POST', body:{ uuid }, timeoutMs:15_000 }).catch(() => {});
    }
    if (sub) sub.textContent = isAbort(err)
      ? 'Cloud session cancelled.'
      : `Could not start cloud game: ${err?.message || 'Unknown error'}`;
    window.Sound?.error?.();
    setTimeout(() => {
      if (splash) splash.hidden = true;
      window.Nav?.setRingVisible?.(true);
      window.Nav?.repaint?.();
    }, 3600);
    throw err;
  } finally {
    starting = false;
  }
}

async function quit(){
  if (pending && !active){
    const p = pending;
    pending = null;
    try { p.controller.abort(); } catch {}
    if (p.uuid) api('/cloud/v1/quitSession', { method:'POST', body:{ uuid:p.uuid }, timeoutMs:10_000 }).catch(() => {});
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
  try { session.controller.abort(); } catch {}
  api('/cloud/v1/quitSession', { method:'POST', body:{ uuid:session.uuid }, timeoutMs:10_000 }).catch(() => {});

  const frame = document.getElementById('playerFrame');
  const player = document.getElementById('player');
  if (frame) frame.src = 'about:blank';
  if (player){ player.hidden = true; player.classList.remove('cloud-player'); }
  try { window.Nav?.popLayer?.(); } catch {}
  window.Nav?.setRingVisible?.(true);
  window.Nav?.restore?.();
  window.Sound?.back?.();
}

async function diagnostics(){
  const result = { base:BASE, catalogue:false, transport:null, error:null };
  try {
    const list = await loadCatalogue();
    result.catalogue = Array.isArray(list) && list.length > 0;
    const handler = event => { result.transport = event.detail?.transport || null; };
    window.addEventListener('stratus:transport', handler, { once:true });
    try {
      const res = await api('/cloud/v1/getQueue?uuid=diagnostic-not-a-session', { timeoutMs:12_000 });
      result.apiStatus = res.status;
    } catch (err){
      result.error = err?.message || String(err);
    }
  } catch (err){ result.error = err?.message || String(err); }
  return result;
}

window.addEventListener('nav:button', event => {
  if ((active || pending) && event.detail?.button === 'b') quit();
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
  try {
    const url = buildTarget('/cloud/v1/quitSession');
    navigator.sendBeacon?.(url, new Blob([JSON.stringify({ uuid })], { type:'application/json' }));
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
  diagnostics,
  get active(){ return active; },
  get starting(){ return starting; }
};
})();