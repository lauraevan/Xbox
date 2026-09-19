/* Medium console fidelity pass for Store + Stratus UX.
   This augments the existing Store instead of replacing its data/controller code. */
(() => {
'use strict';

const storeRoot = document.getElementById('view-store');
const launch = document.getElementById('launch');
const player = document.getElementById('player');
const Cloud = window.StratusCloud;

function text(value){ return String(value ?? ''); }

function makePromo(game, kicker){
  const btn = document.createElement('button');
  btn.className = 'xstore-mini-promo';
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '.75rem';
  btn.setAttribute('aria-label', game.name);

  const art = document.createElement('span');
  art.className = 'xstore-mini-promo-art';
  art.style.backgroundImage = `url("${game.image || game.cover || ''}")`;

  const copy = document.createElement('span');
  copy.className = 'xstore-mini-promo-copy';
  const small = document.createElement('span');
  small.className = 'xstore-mini-promo-kicker';
  small.textContent = kicker;
  const title = document.createElement('span');
  title.className = 'xstore-mini-promo-title';
  title.textContent = game.name;
  copy.append(small, title);
  btn.append(art, copy);

  btn._navActivate = () => window.XboxStore?.openProduct?.(game);
  btn.addEventListener('click', event => {
    event.preventDefault();
    btn._navActivate?.();
  });
  return btn;
}

function makeTab(label, mode, active){
  const btn = document.createElement('button');
  btn.className = 'xstore-console-tab' + (active ? ' active' : '');
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '.55rem';
  btn.textContent = label;
  btn._navActivate = () => window.XboxStore?.switchMode?.(mode);
  btn.addEventListener('click', event => {
    event.preventDefault();
    btn._navActivate?.();
  });
  return btn;
}

function enhanceStore(){
  if (!storeRoot || storeRoot.hidden) return;
  const content = storeRoot.querySelector('.xstore-content');
  if (!content) return;

  const top = content.querySelector('.xstore-top');
  if (top && !content.querySelector('.xstore-console-tabs')){
    const tabs = document.createElement('nav');
    tabs.className = 'xstore-console-tabs';
    tabs.setAttribute('aria-label', 'Store shortcuts');

    const mode = storeRoot.querySelector('.xstore-nav-btn.active')?.dataset.storeMode || 'home';
    tabs.append(
      makeTab('Home', 'home', mode === 'home'),
      makeTab('Games', 'games', mode === 'games'),
      makeTab('Deals', 'deals', mode === 'deals'),
      makeTab('Owned', 'owned', mode === 'owned'),
      makeTab('Wish list', 'wishlist', mode === 'wishlist'),
      makeTab('Search', 'search', mode === 'search')
    );
    top.insertAdjacentElement('afterend', tabs);
  }

  const hero = content.querySelector('.xstore-hero');
  if (hero && !content.querySelector('.xstore-feature-grid')){
    const all = window.XboxStore?.games || [];
    const primaryKey = hero.dataset.gameKey;
    const alternatives = all.filter(game => game.gameKey !== primaryKey).slice(0, 2);

    const grid = document.createElement('section');
    grid.className = 'xstore-feature-grid';
    hero.parentNode.insertBefore(grid, hero);
    grid.append(hero);

    const side = document.createElement('div');
    side.className = 'xstore-side-promos';
    if (alternatives[0]) side.append(makePromo(alternatives[0], 'New to cloud'));
    if (alternatives[1]) side.append(makePromo(alternatives[1], 'Featured'));
    grid.append(side);
  }

  enhanceProduct();
  window.Nav?.repaint?.();
}

function enhanceProduct(){
  const product = storeRoot?.querySelector('.xproduct');
  if (!product || product.querySelector('.xproduct-console-facts')) return;
  const meta = product.querySelector('.xproduct-meta');
  if (!meta) return;

  const facts = document.createElement('div');
  facts.className = 'xproduct-console-facts';
  ['Cloud playable', 'No install required', 'Controller supported'].forEach(label => {
    const chip = document.createElement('span');
    chip.className = 'xproduct-console-fact';
    chip.textContent = label;
    facts.append(chip);
  });
  meta.insertAdjacentElement('afterend', facts);
}

function decorateLaunch(){
  if (!launch) return;
  const center = launch.querySelector('.launch-center');
  if (!center) return;

  /* Keep connection chrome quiet. Older builds added a second cloud brand
     above the Xbox mark, which made this transient screen feel crowded. */
  center.querySelector('.cloud-launch-brand')?.remove();

  if (!center.querySelector('.cloud-launch-cancel')){
    const cancel = document.createElement('button');
    cancel.className = 'cloud-launch-cancel';
    cancel.type = 'button';
    cancel.setAttribute('aria-label', 'Cancel connection');
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => Cloud?.quit?.());
    center.append(cancel);
  }
}

function ensurePlayerHud(){
  if (!player || player.querySelector('.cloud-player-hud')) return;

  const hud = document.createElement('div');
  hud.className = 'cloud-player-hud';

  const identity = document.createElement('div');
  identity.className = 'cloud-player-id';
  identity.textContent = 'Xbox Cloud Gaming';

  const exit = document.createElement('button');
  exit.className = 'cloud-player-exit';
  exit.type = 'button';
  exit.textContent = 'Exit game';
  exit.addEventListener('click', event => {
    event.preventDefault();
    Cloud?.quit?.();
  });

  hud.append(identity, exit);
  player.append(hud);

  let timer = null;
  const reveal = () => {
    hud.classList.remove('hide');
    clearTimeout(timer);
    timer = setTimeout(() => hud.classList.add('hide'), 4300);
  };
  player.addEventListener('pointermove', reveal, { passive:true });
  player.addEventListener('touchstart', reveal, { passive:true });
  reveal();
}

function refreshCloudChrome(){
  decorateLaunch();
  ensurePlayerHud();
  const hud = player?.querySelector('.cloud-player-hud');
  if (hud && player && !player.hidden){
    hud.classList.remove('hide');
    setTimeout(() => hud.classList.add('hide'), 4300);
  }
}

if (storeRoot){
  const observer = new MutationObserver(() => requestAnimationFrame(enhanceStore));
  observer.observe(storeRoot, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
}

if (launch){
  new MutationObserver(refreshCloudChrome).observe(launch, { attributes:true, attributeFilter:['hidden'], childList:true, subtree:true });
}
if (player){
  new MutationObserver(refreshCloudChrome).observe(player, { attributes:true, attributeFilter:['hidden','class'] });
}

// Keep the connection screen cancellable with controller B / Escape even before
// the WebRTC player is mounted.
window.addEventListener('nav:button', event => {
  if (event.detail?.button !== 'b') return;
  if (launch && !launch.hidden && Cloud?.starting) Cloud.quit?.();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (launch && !launch.hidden && Cloud?.starting) Cloud.quit?.();
});

// When a cloud game starts, update the HUD title from the launch title.
if (Cloud?.play){
  const originalPlay = Cloud.play.bind(Cloud);
  Cloud.play = async game => {
    decorateLaunch();
    const title = player?.querySelector('.cloud-player-id');
    if (title) title.textContent = `${game?.name || 'Game'}  •  Xbox Cloud Gaming`;
    return originalPlay(game);
  };
}

requestAnimationFrame(() => {
  enhanceStore();
  refreshCloudChrome();
});
})();
