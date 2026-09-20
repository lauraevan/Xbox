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
  if (window.State?.settings?.wallpaper) return;
  const title = tile.dataset.refTitle;
  if (!title || title === lastHomeTitle) return;
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


/* ───────── Xbox waves wallpaper on the neutral Home canvas ─────────
   The console runs its animated wallpaper behind Home whenever nothing is
   selected, and cross-fades a game's art over the top once something is.
   Home here was flat black in that state; this fills it.

   Opt-out first, because this is a looping clip and most of the ways it can
   go wrong are on a phone. Nothing is requested at all unless the device and
   the user's own settings both allow it, and every failure path lands on the
   still poster, which is what a black canvas looked like before anyway.

   Added to this file rather than as a 27th script: CLAUDE.md asks for that,
   and a half-loaded pass is the failure mode behind the boot hang. */
(() => {
  const backdrop = document.querySelector('.backdrop');
  const bgA = document.getElementById('bgA');
  const bgB = document.getElementById('bgB');
  if (!backdrop || !bgA || !bgB) return;

  const SMALL = 900;          // px of viewport width below which 720p is served
  let video = null;

  function settings(){
    try { return window.State?.settings || {}; } catch { return {}; }
  }

  /* Every one of these is a reason not to spend a phone's battery or data. */
  function allowed(){
    const set = settings();
    if (set.background === 'plain') return false;
    if (set.wallpaper) return false;           // a fixed wallpaper wins, per CLAUDE.md
    if (set.motion === 'reduced') return false;
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch {}
    const link = navigator.connection || {};
    if (link.saveData) return false;
    if (/(^|-)2g$/.test(String(link.effectiveType || ''))) return false;
    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4) return false;
    return true;
  }

  function small(){
    try {
      return innerWidth <= SMALL || matchMedia('(pointer:coarse)').matches;
    } catch { return innerWidth <= SMALL; }
  }

  function build(){
    if (video) return video;

    /* The neutral canvas is painted opaque #000 on purpose, by
       reference-2026-theme.css and final-home-fixes.css, both keyed on
       body[data-home-neutral="true"] (reference.js sets it as
       dataset.homeNeutral). That black is what the wallpaper replaces, so
       those layers have to become transparent again - but only while the
       clip is actually up. The moment it is opted out of or fails, the
       black canvas they built is exactly what comes back.

       Keyed one attribute deeper than their rules, so this wins on
       specificity rather than on file order. */
    const N = 'body[data-view="home"][data-home-neutral="true"][data-home-wallpaper="on"]';
    const style = document.createElement('style');
    style.textContent = [
      '.backdrop-video{',
      '  position:absolute; inset:0; width:100%; height:100%;',
      '  object-fit:cover; object-position:center;',
      '  opacity:0; transition:opacity .5s ease-out;',
      '  pointer-events:none; background:#000;',
      '}',
      '.backdrop-video.on{ opacity:1; }',
      '@media (prefers-reduced-motion: reduce){ .backdrop-video{ display:none; } }',

      `${N}, ${N} #stage, ${N} .stage, ${N} .views,`,
      `${N} #view-home, ${N} #view-home.reference-home, ${N} .backdrop, ${N} .sysbar{`,
      '  background:transparent !important;',
      '}',
      /* The two scrims come back as gradients so the clock, gamertag and tile
         labels keep their contrast - but kept light through the middle band,
         which is where the waves actually read. Measured at 1920x1080: the
         band behind the top bar lands at ~28 mean luminance against white
         text, the band behind the card row at ~40, and the open middle stays
         at the clip's own ~24 rather than being flattened to black. */
      `${N} .backdrop-scrim{`,
      '  background:linear-gradient(180deg,rgba(0,0,0,.30) 0%,rgba(0,0,0,.08) 22%,',
      '    transparent 46%,transparent 58%,rgba(0,0,0,.26) 82%,rgba(0,0,0,.52) 100%) !important;',
      '}',
      `${N} .topbar-scrim{`,
      '  background:linear-gradient(180deg,rgba(0,0,0,.34),rgba(0,0,0,.10) 58%,transparent) !important;',
      '}'
    ].join('');
    document.head.append(style);

    const base = small() ? 'assets/wallpaper/waves-720' : 'assets/wallpaper/waves-1080';
    video = document.createElement('video');
    video.className = 'backdrop-video';
    video.poster = 'assets/wallpaper/waves-poster.jpg';
    video.preload = 'auto';
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.tabIndex = -1;
    /* Safari and older iOS read the attributes, not the properties, and will
       refuse to autoplay inline without all three. */
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('aria-hidden', 'true');

    const webm = document.createElement('source');
    webm.src = base + '.webm';
    webm.type = 'video/webm';
    const mp4 = document.createElement('source');
    mp4.src = base + '.mp4';
    mp4.type = 'video/mp4';
    video.append(webm, mp4);

    /* If the clip will not load or will not decode, the poster stays on
       screen. That is a still Xbox wallpaper instead of an animated one,
       which is still better than the flat black it replaced. */
    video.addEventListener('error', () => { try { video.pause(); } catch {} });

    backdrop.prepend(video);   // first child, so #bgA/#bgB paint over it
    return video;
  }

  /* Neutral means: on Home, at the top of it, with no game art faded in over
     the top. The scroll test is not just tidiness - home-catalog-pass starts
     its own full-screen Waves clip on the lower shelf as soon as Home is
     scrolled, and two 1080p videos decoding at once is exactly the thing that
     makes a phone stutter and run hot. Only one of them is ever visible, so
     only one of them should ever be running. */
  function neutral(){
    const home = document.getElementById('view-home');
    return document.body.dataset.view === 'home' &&
      (home?.scrollTop || 0) < 40 &&
      !bgA.classList.contains('on') &&
      !bgB.classList.contains('on');
  }

  function sync(){
    const stop = () => {
      delete document.body.dataset.homeWallpaper;
      if (!video) return;
      video.classList.remove('on');
      try { video.pause(); } catch {}
    };

    if (!allowed()) return stop();
    if (!(neutral() && document.visibilityState !== 'hidden')) return stop();

    build().classList.add('on');
    /* Written after the element exists, so the canvas is never made
       transparent with nothing behind it. */
    document.body.dataset.homeWallpaper = 'on';
    /* play() rejects under iOS Low Power Mode and whenever autoplay is
       refused. Swallow it: the poster is already showing. */
    try { video.play()?.catch(() => {}); } catch {}
  }

  /* Watch only the two layers' class attribute. Deliberately not a subtree
     observer on .backdrop: this code writes a class onto a child of .backdrop,
     and an observer that could see its own writes re-enters every frame. */
  const watch = new MutationObserver(sync);
  watch.observe(bgA, { attributes:true, attributeFilter:['class'] });
  watch.observe(bgB, { attributes:true, attributeFilter:['class'] });
  new MutationObserver(sync).observe(document.body, {
    attributes:true, attributeFilter:['data-view']
  });

  document.addEventListener('visibilitychange', sync);
  addEventListener('pageshow', sync);

  /* Home is its own scroller. Coalesce to one check per frame. */
  let queued = false;
  document.getElementById('view-home')?.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }, { passive:true });

  sync();
})();

window.XboxStoreRoute = { show:showStore, hide:hideStore };
})();