/* Stratus Cloud integration for the Xbox replica.
   Mirrors the working Synapse/Lovable architecture:
   browser -> trusted backend proxy -> Stratus API.
   The API key never needs to be exposed to the static Xbox frontend. */
(() => {
'use strict';

const BASE = String(window.STRATUS_BASE || 'https://stratus-api-2.onrender.com').replace(/\/$/, '');
const BACKEND = String(
  window.STRATUS_BACKEND ||
  'https://id-preview--6191b4a9-2b1b-4a95-95d1-3b21d04824e6.lovable.app/api/public/ember'
).replace(/\?$/, '');
const OWNERSHIP_KEY = 'xbox.stratus.owned.v2';
const CATALOG_SOURCES = [
  'https://raw.githubusercontent.com/evanjeffrey1212-eng/stratus-api/main/cloud.json',
  'https://cdn.jsdelivr.net/gh/evanjeffrey1212-eng/stratus-api@main/cloud.json'
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isAbort = err => err?.name === 'AbortError';

let catalogue = null;
let cataloguePromise = null;
let active = null;
let pending = null;
let starting = false;
let startedUuid = null;
let heartbeat = null;

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
  const gameKey = String(raw?.game_key || raw?.key || '').trim();
  const name = String(raw?.name || gameKey || `Cloud game ${index + 1}`).trim();
  return {
    id:`stratus:${gameKey || index}`,
    numericId:index + 1,
    name,
    gameKey,
    description:String(raw?.description || raw?.desc || ''),
    image:String(raw?.image || raw?.img || raw?.cover || ''),
    cover:String(raw?.cover || raw?.image || raw?.img || ''),
    tags:Array.isArray(raw?.tags) ? raw.tags.map(String).filter(Boolean) : [],
    provider:'Stratus Cloud',
    cloud:true,
    price:0
  };
}

async function loadCatalogue(){
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

function backendUrl(action, uuid){
  const url = new URL(BACKEND);
  url.searchParams.set('action', action);
  if (uuid) url.searchParams.set('uuid', uuid);
  return url.toString();
}

async function backend(action, { method='POST', body, uuid, signal } = {}){
  const options = {
    method,
    signal,
    cache:'no-store',
    headers:{ 'Accept':'application/json, application/x-ndjson, text/plain, */*' }
  };
  if (method !== 'GET'){
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body || {});
  }

  let res;
  try {
    res = await fetch(backendUrl(action, uuid), options);
  } catch (err){
    throw new Error(`Xbox cloud backend could not be reached. ${err?.message || ''}`.trim());
  }

  if (!res.ok){
    let message = `Cloud backend returned ${res.status}`;
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        message = json?.error || json?.message || text || message;
      } catch { if (text) message = text.slice(0, 240); }
    } catch {}
    throw new Error(message);
  }
  return res;
}

function statusText(event, game){
  switch (event?.status){
    case 'creating_account': return 'Provisioning a cloud rig…';
    case 'account_ready': return 'Cloud rig ready…';
    case 'requesting_game': return `Loading ${game?.name || 'game'}…`;
    case 'queue': return `In queue${event.queue_pos != null ? ` • position ${event.queue_pos}` : '…'}`;
    case 'finished_queue': return 'Cloud rig ready…';
    default: return 'Connecting to Xbox Cloud Gaming…';
  }
}

async function waitForQueue(uuid, controller, game, onStatus){
  for (;;){
    await sleep(4000);
    if (controller.signal.aborted) throw new DOMException('Aborted','AbortError');

    let res;
    try {
      res = await fetch(backendUrl('queue', uuid), {
        method:'GET',
        signal:controller.signal,
        cache:'no-store',
        headers:{ 'Accept':'application/json' }
      });
    } catch (err){
      if (isAbort(err)) throw err;
      continue;
    }

    const text = await res.text();
    let msg = {};
    try { msg = JSON.parse(text); } catch {}

    if (res.status === 429) continue;
    if (!res.ok){
      console.warn('[Stratus] queue', res.status, text);
      continue;
    }

    onStatus?.(msg);
    if (msg.status === 'error') throw new Error(msg.error || 'Cloud session failed');
    if (msg.status === 'finished_queue') return msg.uuid || uuid;
    if (msg.status === 'queue') continue;
  }
}

async function createSession(game, controller, onStatus){
  const res = await backend('create', {
    method:'POST',
    body:{ game_key:game.gameKey },
    signal:controller.signal
  });

  if (!res.body?.getReader){
    const text = await res.text();
    let uuid = null;
    let finished = false;
    for (const line of text.split(/\r?\n/)){
      if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (typeof msg.uuid === 'string') uuid = msg.uuid;
      onStatus?.(msg);
      if (msg.status === 'error') throw new Error(msg.error || 'Cloud session failed');
      if (msg.status === 'finished_queue') finished = true;
    }
    if (!uuid) throw new Error('Stratus did not return a session ID.');
    return finished ? uuid : waitForQueue(uuid, controller, game, onStatus);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let uuid = null;
  let finished = false;

  while (!finished){
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream:true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines){
      if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (typeof msg.uuid === 'string') uuid = msg.uuid;
      onStatus?.(msg);
      if (msg.status === 'error') throw new Error(msg.error || 'Cloud session failed');
      if (msg.status === 'finished_queue'){
        finished = true;
        break;
      }
    }
  }

  if (buffer.trim()){
    try {
      const msg = JSON.parse(buffer);
      if (typeof msg.uuid === 'string') uuid = msg.uuid;
      onStatus?.(msg);
      if (msg.status === 'error') throw new Error(msg.error || 'Cloud session failed');
      if (msg.status === 'finished_queue') finished = true;
    } catch (err){
      if (err instanceof SyntaxError) {} else throw err;
    }
  }

  try { await reader.cancel(); } catch {}
  if (!uuid) throw new Error('Stratus did not return a session ID.');
  if (controller.signal.aborted) throw new DOMException('Aborted','AbortError');
  return finished ? uuid : waitForQueue(uuid, controller, game, onStatus);
}

async function startGame(uuid, controller){
  if (startedUuid === uuid) return;
  startedUuid = uuid;
  try {
    const res = await backend('start', {
      method:'POST',
      body:{ uuid },
      signal:controller.signal
    });
    const data = await res.json();
    if (!data?.signaling_ws || !Array.isArray(data?.ice_servers))
      throw new Error('Stratus returned incomplete WebRTC credentials.');
    return data;
  } catch (err){
    startedUuid = null;
    throw err;
  }
}

function stopHeartbeat(){
  if (heartbeat !== null){
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function sendPing(uuid){
  return fetch(backendUrl('ping'), {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ uuid }),
    cache:'no-store'
  }).catch(err => console.warn('[Stratus] heartbeat failed', err));
}

function startHeartbeat(uuid){
  stopHeartbeat();
  void sendPing(uuid);
  heartbeat = setInterval(() => void sendPing(uuid), 10_000);
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
  if (!player || !frame) throw new Error('Player surface is missing.');

  // The working Lovable Ember client does not sandbox the Stratus iframe.
  // Remove the browser-game sandbox for cloud sessions so WebRTC/gamepad/input
  // behavior matches that known-good integration.
  if (!frame.dataset.originalSandbox)
    frame.dataset.originalSandbox = frame.getAttribute('sandbox') || '';
  frame.removeAttribute('sandbox');
  frame.setAttribute('allow', 'autoplay *; fullscreen *; gamepad *; encrypted-media *; clipboard-write *; clipboard-read *; pointer-lock *; microphone *; camera *');
  frame.referrerPolicy = 'unsafe-url';
  frame.src = `${BASE}/cloud/v1/embed?id=${encodeURIComponent(uuid)}`;
  frame.tabIndex = 0;

  player.hidden = false;
  player.classList.add('cloud-player');
  if (hint){
    hint.textContent = 'Press Esc or B to return to Xbox';
    hint.classList.remove('hide');
    setTimeout(() => hint.classList.add('hide'), 5000);
  }

  window.Nav?.pushLayer?.(player);
  window.Nav?.hideRing?.();
  const focus = () => {
    try { frame.contentWindow?.focus?.(); } catch {}
    try { frame.focus?.(); } catch {}
  };
  [60, 250, 900, 2200].forEach(ms => setTimeout(focus, ms));
  window.Guide?.notify?.({ title:'Cloud game started', text:game.name, icon:'' });
}

function restorePlayerSandbox(){
  const frame = document.getElementById('playerFrame');
  if (!frame) return;
  const original = frame.dataset.originalSandbox;
  if (original !== undefined){
    if (original) frame.setAttribute('sandbox', original);
    else frame.removeAttribute('sandbox');
    delete frame.dataset.originalSandbox;
  }
}

async function play(game){
  if (!game?.gameKey) throw new Error('This title has no Stratus game key.');
  if (starting) return;
  if (!owns(game)) throw new Error('This game is not in your library yet.');
  if (active) await quit();

  starting = true;
  startedUuid = null;
  const controller = new AbortController();
  pending = { game, controller, uuid:null };
  const { splash, sub } = launchSurface(game);

  try {
    let uuid = await createSession(game, controller, msg => {
      if (typeof msg?.uuid === 'string' && pending) pending.uuid = msg.uuid;
      if (sub) sub.textContent = statusText(msg, game);
    });

    if (controller.signal.aborted) return;
    if (!uuid) throw new Error('Cloud session did not return an ID.');
    if (pending) pending.uuid = uuid;

    if (sub) sub.textContent = 'Starting stream…';
    const session = await startGame(uuid, controller);
    if (controller.signal.aborted) return;

    // Match the working Lovable project: heartbeat starts immediately after
    // startGame, before the iframe has even finished loading.
    startHeartbeat(uuid);
    active = { uuid, game, controller, session };
    pending = null;

    if (splash) splash.hidden = true;
    showPlayer(game, uuid);
  } catch (err){
    if (isAbort(err) || controller.signal.aborted) return;

    const uuid = pending?.uuid || startedUuid;
    pending = null;
    stopHeartbeat();
    startedUuid = null;
    if (uuid){
      fetch(backendUrl('quit'), {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ uuid }),
        cache:'no-store'
      }).catch(() => {});
    }

    if (sub) sub.textContent = `Could not start cloud game: ${err?.message || 'Unknown error'}`;
    window.Sound?.error?.();
    setTimeout(() => {
      if (splash) splash.hidden = true;
      window.Nav?.setRingVisible?.(true);
      window.Nav?.repaint?.();
    }, 5000);
  } finally {
    starting = false;
  }
}

async function quit(){
  const p = pending;
  const a = active;
  pending = null;
  active = null;
  starting = false;
  stopHeartbeat();

  try { p?.controller?.abort?.(); } catch {}
  try { a?.controller?.abort?.(); } catch {}

  const uuid = a?.uuid || p?.uuid || startedUuid;
  startedUuid = null;
  if (uuid){
    fetch(backendUrl('quit'), {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ uuid }),
      cache:'no-store'
    }).catch(() => {});
  }

  const splash = document.getElementById('launch');
  const frame = document.getElementById('playerFrame');
  const player = document.getElementById('player');
  if (splash) splash.hidden = true;
  if (frame) frame.src = 'about:blank';
  restorePlayerSandbox();
  if (player){
    player.hidden = true;
    player.classList.remove('cloud-player');
  }

  try { window.Nav?.popLayer?.(); } catch {}
  window.Nav?.setRingVisible?.(true);
  window.Nav?.restore?.();
  window.Sound?.back?.();
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
  const uuid = active?.uuid || pending?.uuid || startedUuid;
  if (!uuid) return;
  try {
    fetch(backendUrl('quit'), {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ uuid }),
      keepalive:true
    }).catch(() => {});
  } catch {}
});

window.StratusCloud = {
  BASE,
  BACKEND,
  loadCatalogue,
  ownedGames,
  owns,
  acquire,
  play,
  quit,
  warm:() => fetch(BACKEND, { mode:'no-cors', cache:'no-store' }).catch(() => {}),
  get active(){ return active; },
  get starting(){ return starting; }
};
})();