/* Small integration layer for Store routing + responsive Xbox Home backgrounds. */
(() => {
'use strict';

const storeView = document.getElementById('view-store');
const coreViews = ['view-home','view-library','view-pass','view-search','view-settings']
  .map(id => document.getElementById(id)).filter(Boolean);
let homeBgToken = 0;
let lastHomeTitle = '';
let fallbackTimer = null;

function setStoreActive(active){
  document.querySelectorAll('.sysnav-btn').forEach(btn => {
    if (btn.dataset.view === 'store') btn.classList.toggle('active', active);
    else if (active) btn.classList.remove('active');
  });
}

function showStore(){
  if (!storeView) return;
  window.XboxStore?.closeProduct?.();
  coreViews.forEach(view => { view.hidden = true; });
  storeView.hidden = false;
  document.body.dataset.view = 'store';
  setStoreActive(true);
  const legend = document.getElementById('legend');
  if (legend) legend.hidden = true;
  window.XboxStore?.render?.(storeView);
  requestAnimationFrame(() => window.Nav?.focusIn?.(storeView, '.store-game'));
}

function hideStore(){
  if (!storeView || storeView.hidden) return;
  window.XboxStore?.closeProduct?.();
  storeView.hidden = true;
  setStoreActive(false);
  const legend = document.getElementById('legend');
  if (legend) legend.hidden = false;
}

function goHomeFromStore(){
  hideStore();
  window.App?.setView?.('home');
}

function patchHomeStoreCard(){
  const home = document.getElementById('view-home');
  if (!home) return;
  const card = [...home.querySelectorAll('.ref-card')]
    .find(node => node.getAttribute('aria-label') === 'Synapse Store');
  if (card){
    card._navActivate = showStore;
    card.dataset.opensStore = '1';
  }
}

const home = document.getElementById('view-home');
if (home){
  new MutationObserver(patchHomeStoreCard).observe(home, { childList:true, subtree:true });
  patchHomeStoreCard();
}

function paintHomeBackground(url, title, token){
  if (!url || token !== homeBgToken || document.body.dataset.view !== 'home') return;
  const canPaint = window.Personalization?.shouldPaintGameArt
    ? window.Personalization.shouldPaintGameArt(title)
    : (window.WallpaperSystem?.shouldPaintGameArt?.(title) ?? true);
  if (!canPaint) return;
  window.WallpaperSystem?.onGameArtPaint?.(title);
  delete document.body.dataset.homeNeutral;
  const a = document.getElementById('bgA');
  const b = document.getElementById('bgB');
  if (!a || !b) return;
  const current = a.classList.contains('on') ? a : b.classList.contains('on') ? b : a;
  const next = current === a ? b : a;
  next.style.backgroundImage = `url("${url}")`;
  next.style.backgroundPosition = 'center center';
  next.dataset.dynamicTitle = title;
  next.classList.add('wide', 'reference-wide', 'on');
  current.classList.remove('on');
}

async function responsiveHomeBackground(tile){
  if (!tile || document.body.dataset.view !== 'home') return;
  if (window.State?.settings?.wallpaper && !window.Personalization) return;
  const title = tile.dataset.refTitle;
  if (!title) return;
  if (title === lastHomeTitle && document.body.dataset.homeNeutral !== 'true') return;
  const canPaint = window.Personalization?.shouldPaintGameArt
    ? window.Personalization.shouldPaintGameArt(title)
    : (window.WallpaperSystem?.shouldPaintGameArt?.(title) ?? true);
  if (!canPaint) return;
  lastHomeTitle = title;
  const token = ++homeBgToken;
  clearTimeout(fallbackTimer);

  const fallback = tile.querySelector('img')?.currentSrc || tile.querySelector('img')?.src || '';
  fallbackTimer = setTimeout(() => paintHomeBackground(fallback, title, token), 180);

  try {
    const hero = await window.Artwork?.hero?.(title);
    if (!hero || token !== homeBgToken) return;
    clearTimeout(fallbackTimer);
    const probe = new Image();
    probe.onload = () => paintHomeBackground(hero, title, token);
    probe.onerror = () => paintHomeBackground(fallback, title, token);
    probe.src = hero;
  } catch {
    paintHomeBackground(fallback, title, token);
  }
}

window.addEventListener('nav:focus', event => {
  const target = event.detail?.el;
  const tile = target?.closest?.('#view-home .ref-tile[data-ref-title]');
  if (tile) responsiveHomeBackground(tile);
});

document.addEventListener('nav:activate', event => {
  const target = event.detail?.el;
  const view = target?.dataset?.view;
  if (view === 'store'){
    showStore();
    return;
  }
  if (view && view !== 'store') hideStore();
});

/* Pointer/touch needs to actually open the top-bar destination, not only move
   focus onto the button. This is especially important on iPad where there is
   no separate controller A press after tapping the icon. */
document.addEventListener('click', event => {
  const viewButton = event.target.closest?.('.sysnav-btn[data-view]');
  if (viewButton){
    event.preventDefault();
    const view = viewButton.dataset.view;
    if (view === 'store') showStore();
    else {
      hideStore();
      window.App?.setView?.(view);
    }
    return;
  }

  const browse = event.target.closest?.('#view-home [data-opens-store="1"]');
  if (browse){
    event.preventDefault();
    showStore();
  }
});

window.addEventListener('nav:button', event => {
  if (document.body.dataset.view !== 'store') return;
  if (event.detail?.button !== 'b') return;
  if (window.XboxStore?.productOpen) return;
  goHomeFromStore();
});

// Core views do not know about the separately mounted Store surface. If any
// regular view is opened programmatically, make sure Store is not left above it.
if (window.App?.setView){
  const originalSetView = window.App.setView.bind(window.App);
  window.App.setView = (name, opts) => {
    if (name === 'store') return showStore();
    hideStore();
    return originalSetView(name, opts);
  };
}

/* A small always-available way home for secondary pages, especially touch/iPad.
   Controller B / Escape still use the native App.goBack path. */
function ensureHomeReturn(){
  if (document.querySelector('.global-home-return')) return;
  const stage = document.getElementById('stage');
  if (!stage) return;

  const btn = document.createElement('button');
  btn.className = 'global-home-return';
  btn.type = 'button';
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '50%';
  btn.setAttribute('aria-label', 'Back to Home');
  btn.title = 'Back to Home';
  btn.innerHTML = window.Views?.ICON?.home || '⌂';

  const goHome = () => {
    hideStore();
    window.App?.setView?.('home');
  };
  btn._navActivate = goHome;
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    goHome();
  });
  stage.append(btn);
}

ensureHomeReturn();

/* ───────── pinned-build freshness gate ─────────
   Git commit URLs are immutable, so historical hashes that predate this code
   cannot be changed retroactively. From this build onward, every pinned
   RawGitHack commit checks the branch head and marks itself outdated after a
   newer commit lands. The current/latest commit never receives the overlay.

   Inert on Vercel, which is now the production host: the gate needs a commit
   SHA in the URL path, and xbox-xi-gold.vercel.app has none. That is correct
   rather than a gap — that domain always serves the newest deployment, so a
   stale pinned build is not reachable there. Kept for the githack links
   already in circulation. */
const VERSION_BRANCH = 'claude/xbox-web-replica-v4s0jk';
const VERSION_API =
  'https://api.github.com/repos/lauraevan/Xbox/commits?sha=' +
  encodeURIComponent(VERSION_BRANCH) + '&per_page=1';

function pinnedCommitFromLocation(){
  const host = location.hostname.toLowerCase();
  if (host !== 'raw.githack.com' && host !== 'rawcdn.githack.com') return null;
  const parts = location.pathname.split('/').filter(Boolean);
  const ref = parts[2] || '';
  return /^[0-9a-f]{40}$/i.test(ref) ? ref.toLowerCase() : null;
}

function showOutdatedBuild(currentSha){
  if (document.querySelector('.xbox-outdated-build')) return;
  const key = `xbox.outdated.continued.${currentSha}`;
  try {
    if (sessionStorage.getItem(key) === '1') return;
  } catch {}

  const overlay = document.createElement('div');
  overlay.className = 'xbox-outdated-build';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Outdated Xbox version');

  const panel = document.createElement('div');
  panel.className = 'xbox-outdated-panel';

  const mark = document.createElement('div');
  mark.className = 'xbox-outdated-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<img src="assets/pwa/xbox-logo.svg" alt="">';

  const title = document.createElement('h1');
  title.textContent = 'This version of XBOX is outdated';

  const copy = document.createElement('p');
  copy.textContent = 'A newer version of the dashboard is available.';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Continue';
  button.autofocus = true;
  button.addEventListener('click', () => {
    try { sessionStorage.setItem(key, '1'); } catch {}
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 180);
  });

  panel.append(mark, title, copy, button);
  overlay.append(panel);

  const style = document.createElement('style');
  style.textContent = `
    .xbox-outdated-build{
      position:fixed;
      inset:0;
      z-index:10000;
      display:grid;
      place-items:center;
      padding:24px;
      background:rgba(0,0,0,.82);
      backdrop-filter:blur(12px);
      -webkit-backdrop-filter:blur(12px);
      animation:xboxOutdatedIn .18s ease-out both;
    }
    .xbox-outdated-build.out{
      opacity:0;
      transition:opacity .18s ease;
      pointer-events:none;
    }
    .xbox-outdated-panel{
      width:min(520px,calc(100vw - 32px));
      padding:38px 36px 32px;
      border-radius:18px;
      background:#171717;
      box-shadow:0 24px 80px rgba(0,0,0,.56);
      color:#fff;
      text-align:center;
      font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;
    }
    .xbox-outdated-mark{
      width:64px;
      height:64px;
      margin:0 auto 22px;
      overflow:hidden;
      border-radius:50%;
      background:#107c10;
    }
    .xbox-outdated-mark img{
      display:block;
      width:100%;
      height:100%;
      object-fit:cover;
    }
    .xbox-outdated-panel h1{
      margin:0;
      font-size:26px;
      line-height:1.15;
      font-weight:650;
      letter-spacing:-.4px;
    }
    .xbox-outdated-panel p{
      margin:12px 0 26px;
      color:rgba(255,255,255,.66);
      font-size:15px;
      line-height:1.45;
    }
    .xbox-outdated-panel button{
      width:100%;
      min-height:50px;
      border:0;
      border-radius:8px;
      background:#107c10;
      color:#fff;
      font:700 16px/1 "Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;
      cursor:pointer;
      touch-action:manipulation;
    }
    .xbox-outdated-panel button:hover,
    .xbox-outdated-panel button:focus-visible{
      background:#159315;
      outline:3px solid #fff;
      outline-offset:3px;
    }
    @keyframes xboxOutdatedIn{
      from{ opacity:0; }
      to{ opacity:1; }
    }
  `;
  document.head.append(style);
  document.body.append(overlay);
  requestAnimationFrame(() => button.focus({ preventScroll:true }));
}

async function checkPinnedBuildFreshness(){
  const currentSha = pinnedCommitFromLocation();
  if (!currentSha) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(VERSION_API, {
      cache:'no-store',
      headers:{ Accept:'application/vnd.github+json' },
      signal:controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) return;

    const rows = await response.json();
    const latestSha = String(rows?.[0]?.sha || '').toLowerCase();
    if (/^[0-9a-f]{40}$/.test(latestSha) && latestSha !== currentSha){
      showOutdatedBuild(currentSha);
    }
  } catch {
    /* If GitHub is unreachable, never block the dashboard on version checks. */
  }
}

checkPinnedBuildFreshness();



/* ───────── touch gamepad for cloud games (mobile only) ─────────
   A Stratus session renders in a cross-origin iframe, so nothing here can
   reach into it: no synthetic key events, no injected gamepad. The only
   channel is postMessage, and the embed has to meet us. The listener that
   does that is in stratus/api/public/e.html in this repo, and it will not be
   live until Stratus itself is deployed with it - see CLAUDE.md.

   The wire format below mirrors e.html's own sendGamepad() exactly: an
   XInput-shaped button mask, two analog triggers and four 16-bit axes. */
(() => {
  const player = document.getElementById('player');
  const frame  = document.getElementById('playerFrame');
  if (!player || !frame) return;

  /* Standard-gamepad index -> XInput mask, copied from e.html. */
  const A=4096, B=8192, X=16384, Y=32768, LB=256, RB=512,
        BACK=32, START=16, LS=64, RS=128, DU=1, DD=2, DL=4, DR=8;

  const pad = { mask:0, lt:0, rt:0, lx:0, ly:0, rx:0, ry:0 };
  let beat = null;

  function post(){
    try {
      frame.contentWindow?.postMessage(
        { source:'xbox-touchpad', pad:{ ...pad } }, '*');
    } catch {}
  }
  function idle(){
    return !pad.mask && !pad.lt && !pad.rt && !pad.lx && !pad.ly && !pad.rx && !pad.ry;
  }
  /* Every change posts immediately. Coalescing to one message per frame lost
     any tap that went down and up inside the same frame - which is most taps,
     and the first version of this did exactly that. The interval only keeps a
     held button fresh against the embed's 2s staleness timeout. */
  function mark(){
    post();
    if (beat || idle()) return;
    beat = setInterval(() => {
      if (idle()){ clearInterval(beat); beat = null; return; }
      post();
    }, 250);
  }

  function setButton(bit, down){
    const next = down ? (pad.mask | bit) : (pad.mask & ~bit);
    if (next === pad.mask) return;
    pad.mask = next; mark();
  }
  function setTrigger(side, value){
    const v = Math.max(0, Math.min(255, Math.round(value * 255)));
    if (pad[side] === v) return;
    pad[side] = v; mark();
  }
  function setStick(side, x, y){
    const px = side === 'l' ? 'lx' : 'rx', py = side === 'l' ? 'ly' : 'ry';
    const nx = Math.max(-32767, Math.min(32767, Math.round(x * 32767)));
    const ny = Math.max(-32767, Math.min(32767, Math.round(-y * 32767)));
    if (pad[px] === nx && pad[py] === ny) return;
    pad[px] = nx; pad[py] = ny; mark();
  }
  function releaseAll(){
    pad.mask = 0; pad.lt = 0; pad.rt = 0;
    pad.lx = 0; pad.ly = 0; pad.rx = 0; pad.ry = 0;
    post();
    if (beat){ clearInterval(beat); beat = null; }
  }

  /* ---- the surface ---- */
  let root = null;

  function button(label, cls, onDown, onUp, name){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tpad-btn ' + cls;
    b.textContent = label;
    /* The reference art labels the d-pad's sides LT and RT, the same text the
       triggers carry. Keep the look, but name them apart for screen readers
       and for anything addressing a specific control. */
    b.setAttribute('aria-label', name || label);
    b.dataset.pad = (name || label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    /* Pointer events, not touch events: one handler covers finger, pen and a
       desktop mouse, and setPointerCapture keeps the release attached to this
       button even if the finger slides off it mid-press. */
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch {}
      b.classList.add('down'); onDown();
    });
    const up = e => {
      if (!b.classList.contains('down')) return;
      e.preventDefault(); e.stopPropagation();
      b.classList.remove('down'); onUp();
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    return b;
  }
  const btn = (label, cls, bit, name) =>
    button(label, cls, () => setButton(bit, true), () => setButton(bit, false), name);
  const trig = (label, cls, side, name) =>
    button(label, cls, () => setTrigger(side, 1), () => setTrigger(side, 0), name);

  function stick(){
    const wrap = document.createElement('div');
    wrap.className = 'tpad-stick';
    const knob = document.createElement('span');
    knob.className = 'tpad-knob';
    wrap.append(knob);

    let id = null, cx = 0, cy = 0, radius = 1;
    const move = e => {
      if (e.pointerId !== id) return;
      e.preventDefault();
      let dx = (e.clientX - cx) / radius;
      let dy = (e.clientY - cy) / radius;
      const len = Math.hypot(dx, dy);
      if (len > 1){ dx /= len; dy /= len; }
      knob.style.transform = `translate(${dx * 42}%, ${dy * 42}%)`;
      setStick('l', dx, dy);
    };
    const end = e => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      setStick('l', 0, 0);
    };
    wrap.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      id = e.pointerId;
      const r = wrap.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      radius = r.width / 2;
      try { wrap.setPointerCapture(e.pointerId); } catch {}
      move(e);
    });
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('lostpointercapture', end);
    return wrap;
  }

  function build(){
    if (root) return root;
    root = document.createElement('div');
    root.className = 'touchpad';
    root.setAttribute('aria-label', 'Touch controls');

    const top = document.createElement('div');
    top.className = 'tpad-top';
    const topL = document.createElement('div'); topL.className = 'tpad-cluster';
    topL.append(btn('LB','tpad-sm',LB,'Left bumper'),
                trig('LT','tpad-sm','lt','Left trigger'));
    const topC = document.createElement('div'); topC.className = 'tpad-cluster tpad-mid';
    topC.append(btn('SELECT','tpad-wide',BACK,'Select'),
                btn('START','tpad-wide tpad-start',START,'Start'));
    const topR = document.createElement('div'); topR.className = 'tpad-cluster';
    topR.append(btn('RB','tpad-sm',RB,'Right bumper'),
                trig('RT','tpad-sm','rt','Right trigger'));
    top.append(topL, topC, topR);

    const bottom = document.createElement('div');
    bottom.className = 'tpad-bottom';

    const left = document.createElement('div'); left.className = 'tpad-left';
    left.append(stick());

    const dpad = document.createElement('div'); dpad.className = 'tpad-dpad';
    dpad.append(btn('UP','tpad-d tpad-du',DU,'D-pad up'),
                btn('LT','tpad-d tpad-dl',DL,'D-pad left'),
                btn('RT','tpad-d tpad-dr',DR,'D-pad right'),
                btn('DN','tpad-d tpad-dd',DD,'D-pad down'));

    const face = document.createElement('div'); face.className = 'tpad-face';
    face.append(btn('Y','tpad-f tpad-y',Y,'Y'), btn('X','tpad-f tpad-x',X,'X'),
                btn('B','tpad-f tpad-b',B,'B'), btn('A','tpad-f tpad-a',A,'A'));

    const hints = document.createElement('div'); hints.className = 'tpad-hints';
    hints.append(btn('LS','tpad-hint',LS,'Left stick click'),
                 btn('RS','tpad-hint',RS,'Right stick click'));

    bottom.append(left, dpad, hints, face);
    root.append(top, bottom);
    player.append(root);
    return root;
  }

  /* Only phones and tablets. A desktop has a keyboard and can pair a real
     controller, which e.html already reads directly. */
  function wanted(){
    if (player.hidden) return false;
    if (!player.classList.contains('cloud-player')) return false;
    try {
      return matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
    } catch { return navigator.maxTouchPoints > 0; }
  }

  function sync(){
    const on = wanted();
    if (on){ build().classList.add('on'); }
    else if (root){ root.classList.remove('on'); releaseAll(); }
  }

  new MutationObserver(sync).observe(player, {
    attributes:true, attributeFilter:['hidden','class']
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  sync();

  window.XboxTouchPad = { sync, pad, releaseAll };
})();

window.XboxStoreRoute = { show:showStore, hide:hideStore };
})();