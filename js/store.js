/* Xbox-console-style Microsoft Store backed by the Stratus cloud catalogue.
   The Store is controller-first: left navigation, large gallery shelves,
   product pages, wishlist, free acquisition and owned-game launch. */
(() => {
'use strict';

const V = window.Views;
const Cloud = window.StratusCloud;
if (!V || !Cloud) return;
const { el, escapeHtml, ICON } = V;

const WISH_KEY = 'xbox.stratus.wishlist.v1';
const FILTERS = [
  ['all', 'All games'],
  ['Action', 'Action'],
  ['Adventure', 'Adventure'],
  ['RPG', 'RPG'],
  ['Shooting', 'Shooter'],
  ['Fighting', 'Fighting'],
  ['Simulation', 'Simulation'],
  ['Indie', 'Indie']
];

let games = [];
let mode = 'home';
let filter = 'all';
let query = '';
let product = null;
let lastRoot = null;
let heroGame = null;

const lower = value => String(value || '').toLowerCase();
const profileId = () => String(window.State?.data?.profileId || 'p1');

function readWish(){
  try {
    const all = JSON.parse(localStorage.getItem(WISH_KEY) || '{}');
    return Array.isArray(all?.[profileId()]) ? all[profileId()] : [];
  } catch { return []; }
}
function writeWish(rows){
  try {
    const all = JSON.parse(localStorage.getItem(WISH_KEY) || '{}');
    all[profileId()] = rows;
    localStorage.setItem(WISH_KEY, JSON.stringify(all));
  } catch {}
}
function wished(game){ return readWish().includes(String(game?.gameKey || game)); }
function toggleWish(game){
  const key = String(game.gameKey);
  const rows = readWish();
  const i = rows.indexOf(key);
  if (i >= 0) rows.splice(i, 1); else rows.unshift(key);
  writeWish(rows);
  return i < 0;
}

function byTag(tag){
  if (tag === 'all') return games.slice();
  return games.filter(g => g.tags.some(t => lower(t) === lower(tag)));
}
function matching(){
  const q = lower(query).trim();
  let list = byTag(filter);
  if (mode === 'wishlist'){
    const keys = new Set(readWish());
    list = list.filter(g => keys.has(String(g.gameKey)));
  }
  if (mode === 'owned') list = list.filter(g => Cloud.owns(g));
  if (!q) return list;
  return list.filter(game => lower(`${game.name} ${game.description} ${game.tags.join(' ')}`).includes(q));
}

function shuffled(seed, source = games){
  const copy = source.slice();
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function storeCard(game, { wide=false } = {}){
  const btn = el('button', `store-game${wide ? ' wide' : ''}`);
  btn.dataset.nav = '';
  btn.dataset.storeKey = game.gameKey;
  btn.dataset.ringRadius = '.25rem';
  btn.setAttribute('aria-label', game.name);

  const art = el('span', 'store-cover');
  const img = document.createElement('img');
  img.src = wide ? (game.image || game.cover) : (game.cover || game.image);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  art.append(img);

  const owned = Cloud.owns(game);
  if (owned) art.append(el('span', 'store-owned-badge', 'OWNED'));
  art.append(el('span', 'store-cloud-badge', `${ICON?.cloud || ''}<span>Cloud</span>`));

  const meta = el('span', 'store-game-meta');
  meta.append(
    el('span', 'store-game-title', escapeHtml(game.name)),
    el('span', 'store-game-price', owned ? 'Owned' : 'Free'),
    el('span', 'store-game-sub', escapeHtml(game.tags.slice(0, 2).join(' • ') || 'Cloud gaming'))
  );
  btn.append(art, meta);
  btn._navActivate = () => openProduct(game);
  return btn;
}

function paintHero(root, game){
  if (!root || !game) return;
  heroGame = game;
  const hero = root.querySelector('.xstore-hero');
  const art = root.querySelector('.xstore-hero-art');
  const title = root.querySelector('.xstore-hero-title');
  const desc = root.querySelector('.xstore-hero-desc');
  const price = root.querySelector('.xstore-hero-price');
  const meta = root.querySelector('.xstore-hero-meta');
  const action = root.querySelector('.xstore-hero-action');
  if (hero) hero.dataset.gameKey = game.gameKey;
  if (art) art.style.backgroundImage = `url("${game.image || game.cover}")`;
  if (title) title.textContent = game.name;
  if (desc) desc.textContent = game.description || 'Play instantly from the cloud.';
  if (price) price.textContent = Cloud.owns(game) ? 'YOU OWN THIS' : 'FREE';
  if (meta) meta.textContent = `${game.tags.slice(0, 3).join(' • ') || 'Cloud gaming'}  •  Stratus Cloud`;
  if (action) action.textContent = Cloud.owns(game) ? 'Play with cloud gaming' : 'View game';
}

function shelf(title, subtitle, list, opts = {}){
  const section = el('section', 'xstore-shelf');
  const head = el('div', 'xstore-shelf-head');
  const copy = el('div');
  copy.append(el('h2', 'xstore-shelf-title', escapeHtml(title)));
  if (subtitle) copy.append(el('div', 'xstore-shelf-sub', escapeHtml(subtitle)));
  head.append(copy);
  if (opts.count) head.append(el('div', 'xstore-shelf-count', `${list.length} games`));
  section.append(head);
  const row = el('div', 'xstore-row');
  list.forEach(game => row.append(storeCard(game, { wide:!!opts.wide })));
  section.append(row);
  return section;
}

function buildRail(root){
  const rail = el('aside', 'xstore-rail');
  rail.innerHTML = `
    <div class="xstore-brand"><span class="xstore-brand-icon">${ICON.store}</span><span>Microsoft Store</span></div>
    <nav class="xstore-nav" aria-label="Store navigation"></nav>
    <div class="xstore-rail-foot">XBOX</div>`;
  const nav = rail.querySelector('.xstore-nav');
  const rows = [
    ['home', 'Home', 'home'],
    ['games', 'Games', 'games'],
    ['search', 'Search', 'search'],
    ['wishlist', 'Wish list', 'pin'],
    ['owned', 'Owned games', 'library']
  ];
  rows.forEach(([id, label, icon]) => {
    const btn = el('button', 'xstore-nav-btn' + (mode === id ? ' active' : ''));
    btn.dataset.nav = '';
    btn.dataset.storeMode = id;
    btn.innerHTML = `<span class="xstore-nav-icon">${ICON[icon] || ICON.grid}</span><span>${escapeHtml(label)}</span>`;
    btn._navActivate = () => switchMode(id, root);
    nav.append(btn);
  });
  return rail;
}

function buildTop(root, label){
  const top = el('header', 'xstore-top');
  top.innerHTML = `
    <div class="xstore-breadcrumb">Store &nbsp;/&nbsp; <strong>${escapeHtml(label)}</strong></div>
    <div class="xstore-top-actions">
      <span class="xstore-account">xboxtest</span>
      <span class="xstore-cart">${ICON.store}<b>0</b></span>
    </div>`;
  return top;
}

function renderHome(root){
  const content = el('div', 'xstore-content');
  content.append(buildTop(root, 'Home'));

  const hero = el('section', 'xstore-hero');
  hero.innerHTML = `
    <div class="xstore-hero-art"></div>
    <div class="xstore-hero-shade"></div>
    <div class="xstore-hero-copy">
      <div class="xstore-hero-kicker">Featured game</div>
      <h1 class="xstore-hero-title"></h1>
      <div class="xstore-hero-meta"></div>
      <p class="xstore-hero-desc"></p>
      <div class="xstore-hero-price"></div>
      <button class="xstore-hero-action" data-nav>View game</button>
    </div>`;
  const action = hero.querySelector('.xstore-hero-action');
  action._navActivate = () => heroGame && (Cloud.owns(heroGame) ? Cloud.play(heroGame).catch(showCloudError) : openProduct(heroGame));
  content.append(hero);

  const featured = shuffled(29).slice(0, 7);
  const newGames = games.slice(0, 10);
  const actionGames = byTag('Action').slice(0, 10);
  const adventure = byTag('Adventure').slice(0, 10);
  const owned = games.filter(g => Cloud.owns(g)).slice(0, 10);

  if (featured.length) content.append(shelf('Featured', 'Great games to play right now', featured));
  if (owned.length) content.append(shelf('From your library', 'Ready to stream', owned));
  if (newGames.length) content.append(shelf('New games', 'Recently added to cloud gaming', newGames));
  if (actionGames.length) content.append(shelf('Top free games', 'Included free in this project', actionGames));
  if (adventure.length) content.append(shelf('Explore new worlds', 'Adventure games', adventure));

  root.querySelector('.xstore-main').append(content);
  paintHero(root, featured[0] || games[0]);
}

function renderBrowse(root, label = 'Games'){
  const content = el('div', 'xstore-content');
  content.append(buildTop(root, label));

  const heading = el('div', 'xstore-gallery-head');
  heading.append(
    el('h1', 'xstore-gallery-title', escapeHtml(label)),
    el('div', 'xstore-gallery-count', `${matching().length.toLocaleString()} games`)
  );
  content.append(heading);

  if (mode === 'games'){
    const filters = el('nav', 'xstore-filters');
    FILTERS.forEach(([id, text]) => {
      const btn = el('button', 'xstore-filter' + (filter === id ? ' active' : ''), escapeHtml(text));
      btn.dataset.nav = '';
      btn._navActivate = () => { filter = id; renderShell(root); };
      filters.append(btn);
    });
    content.append(filters);
  }

  if (mode === 'search'){
    const wrap = el('div', 'xstore-search-wrap');
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'xstore-search';
    search.placeholder = 'Search games, add-ons, and more';
    search.value = query;
    search.setAttribute('aria-label', 'Search Microsoft Store');
    search.addEventListener('input', () => {
      query = search.value;
      const grid = content.querySelector('.xstore-grid');
      const count = content.querySelector('.xstore-gallery-count');
      const list = matching();
      if (count) count.textContent = `${list.length.toLocaleString()} games`;
      if (grid){
        grid.innerHTML = '';
        list.forEach(g => grid.append(storeCard(g)));
        if (!list.length) grid.append(el('div', 'xstore-empty', 'No results found.'));
        window.Nav?.repaint?.();
      }
    });
    wrap.append(`<span>${ICON.search}</span>`, search);
    // append() treats strings literally; replace the first child with real icon HTML
    wrap.innerHTML = `<span class="xstore-search-icon">${ICON.search}</span>`;
    wrap.append(search);
    content.append(wrap);
  }

  const list = matching();
  const grid = el('div', 'xstore-grid');
  list.forEach(game => grid.append(storeCard(game)));
  if (!list.length){
    const msg = mode === 'wishlist' ? 'Your wish list is empty.' : mode === 'owned' ? 'You do not own any cloud games yet.' : 'No games found.';
    grid.append(el('div', 'xstore-empty', msg));
  }
  content.append(grid);
  root.querySelector('.xstore-main').append(content);
}

function modeLabel(){
  if (mode === 'games') return 'Games';
  if (mode === 'search') return 'Search';
  if (mode === 'wishlist') return 'Wish list';
  if (mode === 'owned') return 'Owned games';
  return 'Home';
}

function renderShell(root){
  if (!root) return;
  lastRoot = root;
  closeProduct();
  root.classList.add('reference-store');
  root.innerHTML = '';
  const shell = el('div', 'xstore-shell');
  shell.append(buildRail(root), el('main', 'xstore-main'));
  root.append(shell);
  if (mode === 'home') renderHome(root);
  else renderBrowse(root, modeLabel());
  window.Nav?.repaint?.();
  requestAnimationFrame(() => {
    const target = mode === 'home' ? '.xstore-hero-action' : '.store-game';
    window.Nav?.focusIn?.(root, target);
  });
}

function switchMode(next, root = lastRoot){
  mode = next;
  if (next !== 'search') query = '';
  filter = 'all';
  renderShell(root);
}

function showCloudError(err){
  window.Sound?.error?.();
  window.App?.toast?.('Cloud gaming', err?.message || 'Could not start this game.');
}

function closeProduct(){
  if (!product) return;
  const node = product;
  product = null;
  try { window.Nav?.popLayer?.(); } catch {}
  node.remove();
  window.Nav?.restore?.();
}

function refreshProductOwnership(node, game){
  const owned = Cloud.owns(game);
  node.classList.toggle('owned', owned);
  const status = node.querySelector('.xproduct-license');
  if (status) status.textContent = owned ? 'You own this game' : 'Get this game for your account';
  const price = node.querySelector('.xproduct-price');
  if (price) price.textContent = owned ? 'Owned' : 'Free';
  const acquire = node.querySelector('[data-store-acquire]');
  if (acquire){
    acquire.textContent = owned ? 'PLAY WITH CLOUD GAMING' : 'GET  •  FREE';
    acquire.classList.toggle('play', owned);
  }
}

function openProduct(game){
  closeProduct();
  const root = lastRoot || document.getElementById('view-store');
  if (!root) return;

  const node = el('div', 'xproduct');
  node.innerHTML = `
    <div class="xproduct-art" style="background-image:url('${escapeHtml(game.image || game.cover)}')"></div>
    <div class="xproduct-scrim"></div>
    <div class="xproduct-body">
      <div class="xproduct-cover-wrap"><img class="xproduct-cover" src="${escapeHtml(game.cover || game.image)}" alt=""></div>
      <div class="xproduct-copy">
        <div class="xproduct-type">XBOX CLOUD GAME</div>
        <h1 class="xproduct-title">${escapeHtml(game.name)}</h1>
        <div class="xproduct-meta">${escapeHtml(game.tags.slice(0,4).join(' • ') || 'Cloud gaming')} &nbsp; • &nbsp; Stratus Cloud</div>
        <div class="xproduct-cloud">☁ &nbsp; Cloud playable</div>
        <p class="xproduct-desc">${escapeHtml(game.description || 'Play instantly from the cloud.')}</p>
        <div class="xproduct-price"></div>
        <div class="xproduct-license"></div>
        <div class="xproduct-actions">
          <button class="xproduct-action primary" data-nav data-store-acquire></button>
          <button class="xproduct-action" data-nav data-store-wish>${wished(game) ? 'REMOVE FROM WISH LIST' : 'ADD TO WISH LIST'}</button>
          <button class="xproduct-action icon-only" data-nav data-store-back aria-label="Back">${ICON.back}</button>
        </div>
        <div class="xproduct-note">No download required. Stream this game from My games & apps after you get it.</div>
      </div>
    </div>`;

  const acquire = node.querySelector('[data-store-acquire]');
  acquire._navActivate = async () => {
    if (!Cloud.owns(game)){
      Cloud.acquire(game);
      refreshProductOwnership(node, game);
      window.Sound?.select?.();
      window.App?.toast?.('Added to your library', game.name);
      window.CloudLibrary?.refresh?.();
      window.Nav?.repaint?.();
      window.Nav?.focus?.(acquire, { silent:true });
      return;
    }
    try { await Cloud.play(game); } catch (err){ showCloudError(err); }
  };

  const wish = node.querySelector('[data-store-wish]');
  wish._navActivate = () => {
    const now = toggleWish(game);
    wish.textContent = now ? 'REMOVE FROM WISH LIST' : 'ADD TO WISH LIST';
    window.App?.toast?.(now ? 'Added to wish list' : 'Removed from wish list', game.name);
  };
  node.querySelector('[data-store-back]')._navActivate = closeProduct;

  root.append(node);
  product = node;
  refreshProductOwnership(node, game);
  window.Nav?.pushLayer?.(node);
  window.Nav?.focusFirst?.('.xproduct-action.primary');
}

async function render(root){
  if (!root) return;
  lastRoot = root;
  root.classList.add('reference-store');
  root.innerHTML = '<div class="xstore-loading">Microsoft Store<br><span>Loading…</span></div>';
  try {
    games = await Cloud.loadCatalogue();
    renderShell(root);
  } catch (err){
    root.innerHTML = `<div class="xstore-loading error">Microsoft Store<br><span>Could not load Store: ${escapeHtml(err?.message || 'Unknown error')}</span></div>`;
  }
}

window.addEventListener('nav:focus', event => {
  const target = event.detail?.el;
  const card = target?.closest?.('#view-store .store-game');
  if (!card) return;
  const game = games.find(item => item.gameKey === card.dataset.storeKey);
  if (game && mode === 'home') paintHero(lastRoot, game);
});

window.addEventListener('nav:button', event => {
  if (event.detail?.button === 'b' && product){ closeProduct(); return; }
  if (event.detail?.button === 'x' && document.body.dataset.view === 'store' && !product){
    switchMode('search');
  }
});

// Mouse and touch use the same activation callbacks as controller A.
document.addEventListener('click', event => {
  const target = event.target.closest?.('#view-store [data-nav]');
  if (!target || typeof target._navActivate !== 'function') return;
  event.preventDefault();
  target._navActivate(target);
});

window.addEventListener('stratus:library-change', () => {
  if (lastRoot && document.body.dataset.view === 'store' && !product) renderShell(lastRoot);
});

window.XboxStore = {
  render,
  openProduct,
  closeProduct,
  switchMode,
  get productOpen(){ return !!product; },
  get games(){ return games.slice(); }
};
})();
