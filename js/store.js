/* Full Microsoft Store-style cloud catalogue, backed by Stratus. */
(() => {
'use strict';

const V = window.Views;
const Cloud = window.StratusCloud;
if (!V || !Cloud) return;
const { el, escapeHtml } = V;

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
let filter = 'all';
let query = '';
let product = null;
let lastRoot = null;

const lower = value => String(value || '').toLowerCase();

function filtered(){
  const q = lower(query).trim();
  return games.filter(game => {
    const category = filter === 'all' || game.tags.some(tag => lower(tag) === lower(filter));
    if (!category) return false;
    if (!q) return true;
    return lower(`${game.name} ${game.description} ${game.tags.join(' ')}`).includes(q);
  });
}

function updateCount(root, count){
  const node = root.querySelector('.store-count');
  if (node) node.textContent = `${count.toLocaleString()} games`;
}

function updateHero(root, game){
  if (!root || !game) return;
  const hero = root.querySelector('.store-hero');
  const art = root.querySelector('.store-hero-art');
  const title = root.querySelector('.store-hero-title');
  const desc = root.querySelector('.store-hero-desc');
  const tags = root.querySelector('.store-hero-tags');
  if (hero) hero.dataset.gameKey = game.gameKey;
  if (art) art.style.backgroundImage = game.image ? `url("${game.image}")` : `url("${game.cover}")`;
  if (title) title.textContent = game.name;
  if (desc) desc.textContent = game.description || 'Ready to play from the cloud.';
  if (tags) tags.textContent = game.tags.slice(0, 4).join('  •  ') || 'Cloud game';
}

function gameCard(game){
  const btn = el('button', 'store-game');
  btn.dataset.nav = '';
  btn.dataset.storeKey = game.gameKey;
  btn.dataset.ringRadius = '.55rem';
  btn.setAttribute('aria-label', game.name);

  const cover = el('span', 'store-cover');
  const img = document.createElement('img');
  img.src = game.cover || game.image;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  cover.append(img);

  const meta = el('span', 'store-game-meta');
  meta.append(
    el('span', 'store-game-title', escapeHtml(game.name)),
    el('span', 'store-game-sub', escapeHtml(game.tags.slice(0, 2).join(' • ') || 'Cloud game'))
  );
  btn.append(cover, meta);
  btn._navActivate = () => openProduct(game);
  return btn;
}

function renderGrid(root, { preserveFocus=false } = {}){
  const grid = root.querySelector('.store-grid');
  if (!grid) return;
  const items = filtered();
  grid.innerHTML = '';
  updateCount(root, items.length);

  if (!items.length){
    grid.append(el('div', 'store-empty', 'No cloud games match this filter.'));
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(game => frag.append(gameCard(game)));
  grid.append(frag);
  updateHero(root, items[0]);
  window.Nav?.repaint?.();

  if (!preserveFocus && document.body.dataset.view === 'store'){
    requestAnimationFrame(() => window.Nav?.focusIn?.(root, '.store-game'));
  }
}

function buildFilters(root){
  const bar = root.querySelector('.store-filters');
  if (!bar) return;
  FILTERS.forEach(([id, label]) => {
    const btn = el('button', 'store-filter' + (id === filter ? ' active' : ''), escapeHtml(label));
    btn.dataset.nav = '';
    btn.dataset.filter = id;
    btn._navActivate = () => {
      filter = id;
      [...bar.children].forEach(n => n.classList.toggle('active', n === btn));
      renderGrid(root);
    };
    bar.append(btn);
  });
}

function closeProduct(){
  if (!product) return;
  const node = product;
  product = null;
  window.Nav?.popLayer?.();
  node.remove();
  window.Nav?.restore?.();
}

function openProduct(game){
  closeProduct();
  const root = lastRoot || document.getElementById('view-store');
  if (!root) return;

  const node = el('div', 'store-product');
  const art = el('div', 'store-product-art');
  art.style.backgroundImage = game.image ? `url("${game.image}")` : `url("${game.cover}")`;

  const panel = el('div', 'store-product-panel');
  const cover = document.createElement('img');
  cover.className = 'store-product-cover';
  cover.src = game.cover || game.image;
  cover.alt = '';

  const copy = el('div', 'store-product-copy');
  copy.append(
    el('div', 'store-product-kicker', 'CLOUD GAMING'),
    el('h1', 'store-product-title', escapeHtml(game.name)),
    el('div', 'store-product-tags', escapeHtml(game.tags.join(' • ') || 'Cloud game')),
    el('p', 'store-product-desc', escapeHtml(game.description || 'Play this title through Stratus Cloud.'))
  );

  const actions = el('div', 'store-product-actions');
  const play = el('button', 'store-action primary', 'Play with cloud');
  play.dataset.nav = '';
  play._navActivate = () => Cloud.play(game);
  const back = el('button', 'store-action', 'Back');
  back.dataset.nav = '';
  back._navActivate = closeProduct;
  actions.append(play, back);
  copy.append(actions);
  panel.append(cover, copy);
  node.append(art, panel);
  root.append(node);
  product = node;
  window.Nav?.pushLayer?.(node);
  window.Nav?.focusFirst?.('.store-action.primary');
}

async function render(root){
  if (!root) return;
  lastRoot = root;
  root.classList.add('reference-store');
  if (root.dataset.storeBuilt === '1') return;
  root.dataset.storeBuilt = '1';
  root.innerHTML = '';

  const scroll = el('div', 'store-scroll');
  const head = el('div', 'store-head');
  const headText = el('div', 'store-head-copy');
  headText.append(
    el('h1', 'store-title', 'Microsoft Store'),
    el('div', 'store-subtitle', 'Games • Cloud gaming')
  );
  const search = document.createElement('input');
  search.className = 'store-search';
  search.type = 'search';
  search.placeholder = 'Search games';
  search.setAttribute('aria-label', 'Search Store games');
  search.addEventListener('input', () => {
    query = search.value;
    renderGrid(root, { preserveFocus:true });
  });
  head.append(headText, search);

  const hero = el('section', 'store-hero');
  hero.innerHTML = `
    <div class="store-hero-art"></div>
    <div class="store-hero-copy">
      <div class="store-hero-eyebrow">Featured in cloud gaming</div>
      <h2 class="store-hero-title">Loading Store…</h2>
      <p class="store-hero-desc">Loading the Stratus cloud catalogue.</p>
      <div class="store-hero-tags"></div>
    </div>`;

  const filters = el('nav', 'store-filters');
  filters.setAttribute('aria-label', 'Store categories');
  const sectionHead = el('div', 'store-section-head');
  sectionHead.append(el('h2', 'store-section-title', 'Games'), el('div', 'store-count', 'Loading…'));
  const grid = el('div', 'store-grid');

  scroll.append(head, hero, filters, sectionHead, grid);
  root.append(scroll);
  buildFilters(root);

  try {
    games = await Cloud.loadCatalogue();
    renderGrid(root);
  } catch (err){
    grid.innerHTML = '';
    grid.append(el('div', 'store-empty', `Could not load Store: ${escapeHtml(err?.message || 'Unknown error')}`));
    updateCount(root, 0);
  }
}

window.addEventListener('nav:focus', event => {
  const target = event.detail?.el;
  if (!target?.classList?.contains('store-game')) return;
  const game = games.find(item => item.gameKey === target.dataset.storeKey);
  if (game) updateHero(lastRoot, game);
});

window.addEventListener('nav:button', event => {
  if (event.detail?.button === 'b' && product) closeProduct();
});

// Nav.activate handles controller/keyboard A presses. Native pointer taps need
// the same activation path so Store stays fully usable on touch and mouse.
document.addEventListener('click', event => {
  const target = event.target.closest?.('#view-store [data-nav]');
  if (!target || typeof target._navActivate !== 'function') return;
  event.preventDefault();
  target._navActivate(target);
});

window.XboxStore = {
  render,
  openProduct,
  closeProduct,
  get productOpen(){ return !!product; },
  get games(){ return games.slice(); }
};
})();
