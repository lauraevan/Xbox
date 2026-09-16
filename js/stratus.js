/* Stratus Cloud integration for the Xbox replica.
   Uses the deployed Render API and the upstream site key.
   A host can override either value before this file loads by setting
   window.STRATUS_BASE / window.STRATUS_API_KEY. */
(() => {
'use strict';

const BASE = String(window.STRATUS_BASE || 'https://stratus-api-2.onrender.com').replace(/\/$/, '');
const CATALOG_SOURCES = [
  'https://raw.githubusercontent.com/evanjeffrey1212-eng/stratus-api/main/cloud.json',
  'https://cdn.jsdelivr.net/gh/evanjeffrey1212-eng/stratus-api@main/cloud.json'
];
const UPSTREAM_PUBLIC_KEY = 'stratus-api-synapsium';
const key = () => window.STRATUS_API_KEY || UPSTREAM_PUBLIC_KEY;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

let catalogue = null;
let cataloguePromise = null;
let active = null;
let starting = false;

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
    provider: 'Stratus Cloud'
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
        catalogue = data
          .map(normalizeGame)
          .filter(game => game.gameKey && game.name);
        return catalogue;
      } catch (err){
        lastError = err;
      }
    }
    throw lastError || new Error('Could not load the Stratus catalogue');
  })().finally(() => { cataloguePromise = null; });

  return cataloguePromise;
}

async function api(path, { method='GET', body, signal } = {}){
  let url = BASE + path;
  const options = { method, signal, headers:{} };

  if (method === 'GET'){
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}api_key=${encodeURIComponent(key())}`;
  } else {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ ...(body || {}), api_key:key() });
  }

  const res = await fetch(url, options);
  if (!res.ok){
    let message = `Stratus returned ${res.status}`;
    try { message = (await res.json())?.error || message; } catch {}
    throw new Error(message);
  }
  return res;
}

function statusText(event){
  switch (event?.status){
    case 'creating_account': return 'Preparing cloud session…';
    case 'account_ready': return 'Cloud account ready…';
    case 'requesting_game': return 'Requesting a game server…';
    case 'queue': return `Waiting for a server${Number.isFinite(event.queue_pos) ? ` • #${event.queue_pos}` : '…'}`;
    case 'finished_queue': return 'Server ready…';
    default: return 'Starting game…';
  }
}

async function pollQueue(uuid, onStatus, signal){
  while (!signal?.aborted){
    await wait(3600);
    const res = await api(`/cloud/v1/getQueue?uuid=${encodeURIComponent(uuid)}`, { signal });
    const event = await res.json();
    onStatus?.(event);
    if (event.status === 'finished_queue') return event.uuid || uuid;
    if (event.status !== 'queue') throw new Error(event.error || 'Unexpected queue response');
  }
  throw new DOMException('Aborted', 'AbortError');
}

async function createSession(gameKey, onStatus, signal){
  const res = await api('/cloud/v1/createSession', {
    method:'POST',
    body:{ game_key:gameKey },
    signal
  });

  if (!res.body) throw new Error('Streaming responses are unavailable in this browser');
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
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      onStatus?.(event);

      if (event.status === 'error') throw new Error(event.error || 'Cloud session failed');
      if (event.status === 'finished_queue'){
        try { await reader.cancel(); } catch {}
        return event.uuid;
      }
      if (event.status === 'queue' && event.uuid){
        try { await reader.cancel(); } catch {}
        return pollQueue(event.uuid, onStatus, signal);
      }
    }

    if (done) break;
  }
  throw new Error('Stratus session ended before a server became ready');
}

async function startGame(uuid, signal){
  const res = await api('/cloud/v1/startGame', {
    method:'POST',
    body:{ uuid },
    signal
  });
  return res.json();
}

function launchSurface(game){
  const splash = document.getElementById('launch');
  const art = document.getElementById('launchArt');
  const title = document.getElementById('launchTitle');
  const sub = splash?.querySelector('.launch-sub');
  if (art) art.style.backgroundImage = game.image ? `url("${game.image}")` : '';
  if (title) title.textContent = game.name;
  if (sub) sub.textContent = 'Connecting to Stratus Cloud…';
  if (splash) splash.hidden = false;
  window.Nav?.hideRing?.();
  return { splash, sub };
}

function showPlayer(game, uuid){
  const player = document.getElementById('player');
  const frame = document.getElementById('playerFrame');
  const hint = document.getElementById('playerHint');
  if (!player || !frame) throw new Error('Player surface is missing');

  frame.src = `${BASE}/cloud/v1/embed?id=${encodeURIComponent(uuid)}`;
  player.hidden = false;
  hint?.classList.remove('hide');
  setTimeout(() => hint?.classList.add('hide'), 4200);
  window.Nav?.pushLayer?.(player);
  window.Nav?.hideRing?.();
  window.Guide?.notify?.({ title:'Cloud game started', text:game.name, icon:window.Views?.ICON?.play || '' });
}

async function play(game){
  if (!game?.gameKey || starting) return;
  if (active) await quit();
  starting = true;
  const controller = new AbortController();
  const { splash, sub } = launchSurface(game);

  try {
    const uuid = await createSession(game.gameKey, event => {
      if (sub) sub.textContent = statusText(event);
    }, controller.signal);
    if (!uuid) throw new Error('Stratus did not return a session ID');

    if (sub) sub.textContent = 'Opening stream…';
    const session = await startGame(uuid, controller.signal);
    active = { uuid, game, controller, session, pingTimer:null };
    active.pingTimer = setInterval(() => {
      api('/cloud/v1/pingSession', { method:'POST', body:{ uuid } }).catch(() => {});
    }, 20_000);

    if (splash) splash.hidden = true;
    showPlayer(game, uuid);
  } catch (err){
    if (sub) sub.textContent = err?.name === 'AbortError'
      ? 'Cloud session cancelled.'
      : `Could not start cloud game: ${err?.message || 'Unknown error'}`;
    window.Sound?.error?.();
    setTimeout(() => {
      if (splash) splash.hidden = true;
      window.Nav?.setRingVisible?.(true);
      window.Nav?.repaint?.();
    }, 3500);
  } finally {
    starting = false;
  }
}

async function quit(){
  if (starting && !active) return;
  const session = active;
  active = null;
  if (!session) return;

  clearInterval(session.pingTimer);
  session.controller?.abort?.();
  api('/cloud/v1/quitSession', { method:'POST', body:{ uuid:session.uuid } }).catch(() => {});

  const frame = document.getElementById('playerFrame');
  const player = document.getElementById('player');
  if (frame) frame.src = 'about:blank';
  if (player) player.hidden = true;
  window.Nav?.popLayer?.();
  window.Nav?.setRingVisible?.(true);
  window.Nav?.restore?.();
  window.Sound?.back?.();
}

window.addEventListener('nav:button', event => {
  if (!active) return;
  if (event.detail?.button === 'b') quit();
});

window.StratusCloud = {
  BASE,
  loadCatalogue,
  play,
  quit,
  get active(){ return active; },
  get starting(){ return starting; }
};
})();
