/* Stratus transport pass for the Xbox replica.
   Direct API target: https://stratus-api-2.onrender.com
   Uses the official Stratus v1 session flow first, with the existing
   Synapse/Lovable proxy routes retained only as a browser-CORS fallback. */
(() => {
'use strict';

const original = window.StratusCloud;
if (!original) return;

const API_BASE = String(
  window.STRATUS_BASE ||
  original.BASE ||
  'https://stratus-api-2.onrender.com'
).replace(/\/$/, '');

// Stratus publishes this site key in its public API repository. It can be
// overridden before this script loads with window.STRATUS_API_KEY.
const API_KEY = String(
  window.STRATUS_API_KEY ||
  'stratus-api-synapsium'
).trim();

const PROXY_BACKENDS = [
  window.STRATUS_BACKEND,
  'https://synapse.educationcatlearningandtutoring.com/api/public/ember',
  'https://id-preview--6191b4a9-2b1b-4a95-95d1-3b21d04824e6.lovable.app/api/public/ember'
].filter(Boolean)
  .map(v => String(v).replace(/\?$/, ''))
  .filter((v, i, a) => a.indexOf(v) === i);

const DIRECT_PATHS = {
  create: '/cloud/v1/createSession',
  queue:  '/cloud/v1/getQueue',
  start:  '/cloud/v1/startGame',
  ping:   '/cloud/v1/pingSession',
  quit:   '/cloud/v1/quitSession'
};

let active = null;
let pending = null;
let starting = false;
let heartbeat = null;
let startedUuid = null;
let activeTransport = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const aborted = err => err?.name === 'AbortError';
const log = (...args) => console.log('[Stratus/Xbox]', ...args);
const warn = (...args) => console.warn('[Stratus/Xbox]', ...args);

function directEndpoint(action, uuid){
  const path = DIRECT_PATHS[action];
  if (!path) throw new Error(`Unknown Stratus action: ${action}`);
  const url = new URL(path, API_BASE);
  if (action === 'queue' && uuid) url.searchParams.set('uuid', uuid);
  return url.toString();
}

function proxyEndpoint(base, action, uuid){
  const url = new URL(base);
  url.searchParams.set('action', action);
  if (uuid) url.searchParams.set('uuid', uuid);
  return url.toString();
}

async function readError(res){
  let message = `Stratus returned ${res.status}`;
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      message = String(json?.error || json?.message || text || message);
    } catch {
      if (text) message = text.slice(0, 260);
    }
  } catch {}
  return message;
}

function requestOptions(method, body, signal, direct){
  const headers = {
    'Accept':'application/json, application/x-ndjson, text/plain, */*'
  };
  if (direct && API_KEY) headers['x-api-key'] = API_KEY;
  if (method !== 'GET') headers['Content-Type'] = 'application/json';

  return {
    method,
    signal,
    cache:'no-store',
    headers,
    ...(method === 'GET' ? {} : { body:JSON.stringify(body || {}) })
  };
}

async function requestDirect(action, { method='POST', body, uuid, signal } = {}){
  const url = directEndpoint(action, uuid);
  log(`direct ${method} ${action}`, url);
  const res = await fetch(url, requestOptions(method, body, signal, true));
  if (!res.ok) throw new Error(await readError(res));
  activeTransport = { type:'direct', base:API_BASE };
  window.dispatchEvent(new CustomEvent('stratus:backend', {
    detail:{ backend:API_BASE, transport:'direct', action }
  }));
  return res;
}

async function requestProxy(base, action, { method='POST', body, uuid, signal } = {}){
  const url = proxyEndpoint(base, action, uuid);
  log(`proxy ${method} ${action}`, base);
  const res = await fetch(url, requestOptions(method, body, signal, false));
  if (!res.ok) throw new Error(await readError(res));
  activeTransport = { type:'proxy', base };
  window.dispatchEvent(new CustomEvent('stratus:backend', {
    detail:{ backend:base, transport:'proxy', action }
  }));
  return res;
}

async function request(action, options = {}){
  // Once a session is created, keep all control traffic on the same
  // transport so the UUID remains tied to the same Stratus session store.
  if (activeTransport?.type === 'direct'){
    return requestDirect(action, options);
  }
  if (activeTransport?.type === 'proxy'){
    return requestProxy(activeTransport.base, action, options);
  }

  let lastError = null;

  // Prefer the actual Render deployment the user requested.
  try {
    return await requestDirect(action, options);
  } catch (err){
    if (aborted(err) && options.signal?.aborted) throw err;
    lastError = err;
    warn('direct API unavailable, trying compatibility proxy', err?.message || err);
  }

  // Static GitHub/RawGitHack deployments can be subject to browser CORS.
  // Keep the known proxy paths as a fallback rather than breaking launch.
  for (const base of PROXY_BACKENDS){
    try {
      return await requestProxy(base, action, options);
    } catch (err){
      if (aborted(err) && options.signal?.aborted) throw err;
      lastError = err;
      warn('proxy failed', base, err?.message || err);
    }
  }

  throw new Error(
    `Could not reach Stratus at ${API_BASE}. ${lastError?.message || 'All transports failed.'}`
  );
}

function statusText(msg, game){
  switch (msg?.status){
    case 'creating_account': return 'Provisioning a cloud rig…';
    case 'account_ready': return 'Cloud rig ready…';
    case 'requesting_game': return `Loading ${game?.name || 'game'}…`;
    case 'queue': return `In queue${msg.queue_pos != null ? ` • position ${msg.queue_pos}` : '…'}`;
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
      res = await request('queue', {
        method:'GET',
        uuid,
        signal:controller.signal
      });
    } catch (err){
      if (aborted(err)) throw err;
      warn('queue poll failed, retrying', err?.message || err);
      continue;
    }

    const text = await res.text();
    let msg = {};
    try { msg = JSON.parse(text); } catch {}
    log('queue', msg);
    onStatus?.(msg);

    if (msg.status === 'error') throw new Error(msg.error || 'Cloud session failed.');
    if (msg.status === 'finished_queue') return msg.uuid || uuid;
  }
}

async function createSession(game, controller, onStatus){
  const res = await request('create', {
    method:'POST',
    body:{ game_key:game.gameKey },
    signal:controller.signal
  });

  let uuid = null;
  let finished = false;

  const consume = line => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    log('create status', msg);
    if (typeof msg.uuid === 'string') uuid = msg.uuid;
    onStatus?.(msg);
    if (msg.status === 'error') throw new Error(msg.error || 'Cloud session failed.');
    if (msg.status === 'finished_queue') finished = true;
  };

  if (!res.body?.getReader){
    const text = await res.text();
    text.split(/\r?\n/).forEach(consume);
  } else {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!finished && !controller.signal.aborted){
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream:!done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) consume(line);
      if (done) break;
    }

    if (buffer.trim()) consume(buffer);
    try { await reader.cancel(); } catch {}
  }

  if (controller.signal.aborted) throw new DOMException('Aborted','AbortError');
  if (!uuid) throw new Error('Stratus did not return a session ID.');
  return finished ? uuid : waitForQueue(uuid, controller, game, onStatus);
}

async function startGame(uuid, controller){
  if (startedUuid === uuid) return;
  startedUuid = uuid;

  try {
    const res = await request('start', {
      method:'POST',
      body:{ uuid },
      signal:controller.signal
    });
    const payload = await res.json();
    log('start ok', payload);

    if (!payload?.signaling_ws || !Array.isArray(payload?.ice_servers)){
      throw new Error('Stratus returned incomplete WebRTC credentials.');
    }
    return payload;
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

async function ping(uuid){
  try {
    const res = await request('ping', {
      method:'POST',
      body:{ uuid }
    });
    const data = await res.json().catch(() => ({}));
    window.dispatchEvent(new CustomEvent('stratus:ping', { detail:data }));
    return data;
  } catch (err){
    warn('heartbeat failed', err?.message || err);
    return null;
  }
}

function startHeartbeat(uuid){
  stopHeartbeat();
  void ping(uuid);
  heartbeat = setInterval(() => void ping(uuid), 10_000);
}

function launchSurface(game){
  const splash = document.getElementById('launch');
  const art = document.getElementById('launchArt');
  const title = document.getElementById('launchTitle');
  const sub = splash?.querySelector('.launch-sub');

  if (art) art.style.backgroundImage =
    (game.image || game.cover) ? `url("${game.image || game.cover}")` : '';
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

  if (!frame.dataset.originalSandbox){
    frame.dataset.originalSandbox = frame.getAttribute('sandbox') || '';
  }

  frame.removeAttribute('sandbox');
  frame.setAttribute(
    'allow',
    'autoplay *; fullscreen *; gamepad *; encrypted-media *; clipboard-write *; clipboard-read *; pointer-lock *; microphone *; camera *'
  );
  frame.referrerPolicy = 'unsafe-url';
  frame.tabIndex = 0;
  frame.src = `${API_BASE}/cloud/v1/embed?id=${encodeURIComponent(uuid)}`;
  frame.onload = () => log('embed loaded', frame.src);

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
  [60,250,800,1600,3000].forEach(ms => setTimeout(focus, ms));

  window.Guide?.notify?.({
    title:'Cloud game started',
    text:game.name,
    icon:''
  });
}

function restoreSandbox(){
  const frame = document.getElementById('playerFrame');
  if (!frame) return;
  const value = frame.dataset.originalSandbox;

  if (value !== undefined){
    if (value) frame.setAttribute('sandbox', value);
    else frame.removeAttribute('sandbox');
    delete frame.dataset.originalSandbox;
  }
  frame.onload = null;
}

async function endRemoteSession(uuid){
  if (!uuid || !activeTransport) return;
  try {
    await request('quit', {
      method:'POST',
      body:{ uuid }
    });
  } catch (err){
    warn('quit failed', err?.message || err);
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

  await endRemoteSession(uuid);

  const splash = document.getElementById('launch');
  const player = document.getElementById('player');
  const frame = document.getElementById('playerFrame');

  if (splash) splash.hidden = true;
  if (frame) frame.src = 'about:blank';
  restoreSandbox();

  if (player){
    player.hidden = true;
    player.classList.remove('cloud-player');
  }

  activeTransport = null;
  try { window.Nav?.popLayer?.(); } catch {}
  window.Nav?.setRingVisible?.(true);
  window.Nav?.restore?.();
}

async function play(game){
  if (!game?.gameKey) throw new Error('This title has no Stratus game key.');
  if (starting) return;
  if (!original.owns?.(game)) throw new Error('This game is not in your library yet.');
  if (active || pending) await quit();

  starting = true;
  startedUuid = null;
  activeTransport = null;

  const controller = new AbortController();
  pending = { game, controller, uuid:null };
  const { splash, sub } = launchSurface(game);

  try {
    const uuid = await createSession(game, controller, msg => {
      if (typeof msg?.uuid === 'string' && pending) pending.uuid = msg.uuid;
      if (sub) sub.textContent = statusText(msg, game);
    });

    if (!uuid) throw new Error('Cloud session did not return an ID.');
    if (pending) pending.uuid = uuid;

    if (sub) sub.textContent = 'Starting stream…';
    const session = await startGame(uuid, controller);
    if (controller.signal.aborted) return;

    startHeartbeat(uuid);
    active = { uuid, game, controller, session };
    pending = null;

    if (splash) splash.hidden = true;
    showPlayer(game, uuid);
  } catch (err){
    if (aborted(err) || controller.signal.aborted) return;

    warn('launch failed', err);
    const uuid = pending?.uuid || startedUuid;
    await endRemoteSession(uuid);

    pending = null;
    startedUuid = null;
    stopHeartbeat();

    if (sub){
      sub.textContent = `Could not start cloud game: ${err?.message || 'Unknown error'}`;
    }

    window.Sound?.error?.();
    setTimeout(() => {
      if (splash) splash.hidden = true;
      window.Nav?.setRingVisible?.(true);
      window.Nav?.repaint?.();
    }, 6000);
  } finally {
    starting = false;
  }
}

window.addEventListener('nav:button', event => {
  if ((active || pending) && event.detail?.button === 'b') void quit();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (active || pending)){
    event.preventDefault();
    void quit();
  }
});

addEventListener('pagehide', () => {
  const uuid = active?.uuid || pending?.uuid || startedUuid;
  if (!uuid || !activeTransport) return;

  const body = JSON.stringify({ uuid });
  try {
    if (activeTransport.type === 'direct'){
      fetch(directEndpoint('quit'), {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-api-key':API_KEY
        },
        body,
        keepalive:true
      }).catch(() => {});
    } else {
      fetch(proxyEndpoint(activeTransport.base, 'quit'), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body,
        keepalive:true
      }).catch(() => {});
    }
  } catch {}
});

const upgraded = {
  ...original,
  BASE:API_BASE,
  BACKENDS:PROXY_BACKENDS,
  API_MODE:'direct-first',
  play,
  quit,
  warm:() => Promise.allSettled([
    fetch(API_BASE, { mode:'no-cors', cache:'no-store' }),
    ...PROXY_BACKENDS.map(base => fetch(base, { mode:'no-cors', cache:'no-store' }))
  ])
};

Object.defineProperties(upgraded, {
  active:{ get:() => active },
  starting:{ get:() => starting },
  backend:{ get:() => activeTransport?.base || null },
  transport:{ get:() => activeTransport?.type || null }
});

window.StratusCloud = upgraded;
log('direct-first pass ready', API_BASE);
})();
