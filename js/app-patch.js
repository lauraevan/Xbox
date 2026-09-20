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


window.XboxStoreRoute = { show:showStore, hide:hideStore };
})();