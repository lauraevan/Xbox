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
    .find(node => node.getAttribute('aria-label') === 'Browse the store');
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

window.XboxStoreRoute = { show:showStore, hide:hideStore };
})();