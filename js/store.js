/* Xbox-console Microsoft Store replica backed by the Stratus cloud catalogue.
   The layout follows the real ten-foot Store: a narrow icon rail, a large
   selected gallery item with adjacent cards, contextual details underneath,
   horizontal discovery rows, full catalogue pages and a rich product page. */
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

const CLOUD_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M7.4 18.5a4.9 4.9 0 0 1-.65-9.76A6.45 6.45 0 0 1 19 10.82a3.85 3.85 0 0 1-.7 7.68H7.4Z"/>
</svg>`;

let games = [];
let mode = 'home';
let filter = 'all';
let query = '';
let product = null;
let lastRoot = null;
let selectedHomeGame = null;

const lower = value => String(value || '').toLowerCase();
const profileId = () => String(window.State?.data?.profileId || 'p1');
const icon = name => ICON?.[name] || ICON?.grid || '';

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

function starsFor(game){
  let n = 0;
  for (const c of String(game.gameKey || game.name)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  const rating = (4.2 + (n % 8) / 10).toFixed(1);
  const reviews = ((n % 124) + 8) * 100;
  return { rating, reviews:reviews >= 1000 ? `${Math.round(reviews / 100) / 10}K` : String(reviews) };
}

function cardImage(game, wide){ return wide ? (game.image || game.cover) : (game.cover || game.image); }

function storeCard(game, { compact=false, wide=false } = {}){
  const cls = compact ? 'store-game store-compact' : wide ? 'store-game store-wide' : 'store-game store-grid-card';
  const btn = el('button', cls);
  btn.dataset.nav = '';
  btn.dataset.storeKey = game.gameKey;
  btn.dataset.ringRadius = '.35rem';
  btn.setAttribute('aria-label', `${game.name}, ${Cloud.owns(game) ? 'owned' : 'free'}`);

  const art = el('span', 'store-cover');
  const img = document.createElement('img');
  img.src = cardImage(game, wide);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  art.append(img);

  if (Cloud.owns(game)) art.append(el('span', 'store-owned-badge', 'OWNED'));
  const cloud = el('span', 'store-cloud-mark', CLOUD_ICON);
  cloud.title = 'Cloud playable';
  art.append(cloud);

  const meta = el('span', 'store-game-meta');
  meta.append(
    el('span', 'store-game-title', escapeHtml(game.name)),
    el('span', 'store-game-price', Cloud.owns(game) ? 'Owned' : 'Free')
  );
  if (!compact) meta.append(el('span', 'store-game-sub', escapeHtml(game.tags.slice(0, 2).join(' • ') || 'Cloud gaming')));
  btn.append(art, meta);
  btn._navActivate = () => openProduct(game);
  return btn;
}

function leadCard(game){
  const btn = el('button', 'store-game store-lead');
  btn.dataset.nav = '';
  btn.dataset.storeKey = game.gameKey;
  btn.dataset.ringRadius = '.45rem';
  btn.setAttribute('aria-label', game.name);
  const art = el('span', 'store-lead-art');
  const img = document.createElement('img');
  img.src = game.image || game.cover;
  img.alt = '';
  img.decoding = 'async';
  art.append(img);
  if (Cloud.owns(game)) art.append(el('span', 'store-owned-badge', 'OWNED'));
  btn.append(art);
  btn._navActivate = () => openProduct(game);
  return btn;
}

function buildRail(root){
  const rail = el('aside', 'xstore-rail');
  const profile = el('button', 'xstore-avatar');
  profile.type = 'button';
  profile.title = 'xboxtest';
  profile.setAttribute('aria-label', 'Profile xboxtest');
  profile.innerHTML = '<span></span>';
  rail.append(profile);

  const nav = el('nav', 'xstore-nav');
  nav.setAttribute('aria-label', 'Microsoft Store');
  const rows = [
    { id:'search', icon:'search', label:'Search' },
    { id:'home', icon:'store', label:'Store home', activeMode:'home' },
    { id:'games', icon:'games', label:'Games' },
    { id:'owned', icon:'library', label:'Owned games' },
    { id:'wishlist', icon:'pin', label:'Wish list', split:true },
    { id:'settings', icon:'gear', label:'Settings', external:true }
  ];

  rows.forEach(row => {
    if (row.split) nav.append(el('div', 'xstore-nav-rule'));
    const btn = el('button', 'xstore-nav-btn');
    const active = !row.external && mode === (row.activeMode || row.id);
    if (active) btn.classList.add('active');
    btn.dataset.nav = '';
    btn.dataset.storeMode = row.id;
    btn.dataset.ringRadius = '.15rem';
    btn.title = row.label;
    btn.setAttribute('aria-label', row.label);
    btn.innerHTML = `<span class="xstore-nav-icon">${icon(row.icon)}</span><span class="xstore-nav-label">${escapeHtml(row.label)}</span>`;
    btn._navActivate = () => {
      if (row.external){ window.App?.setView?.('settings'); return; }
      switchMode(row.id, root);
    };
    nav.append(btn);
  });
  rail.append(nav);

  const help = el('div', 'xstore-rail-foot', 'XBOX');
  rail.append(help);
  return rail;
}

function paintHomeSelection(root, game){
  if (!root || !game) return;
  selectedHomeGame = game;
  const title = root.querySelector('.xstore-selected-title');
  const rating = root.querySelector('.xstore-selected-rating');
  const genre = root.querySelector('.xstore-selected-genre');
  const price = root.querySelector('.xstore-selected-price');
  const offer = root.querySelector('.xstore-selected-offer');
  const { rating:stars, reviews } = starsFor(game);
  if (title) title.textContent = game.name;
  if (rating) rating.innerHTML = `<span class="xstore-stars">★★★★★</span><b>${stars}</b><span>${reviews}</span>`;
  if (genre) genre.textContent = (game.tags[0] || 'GAME').toUpperCase();
  if (price) price.textContent = Cloud.owns(game) ? 'Owned' : 'Free';
  if (offer) offer.textContent = Cloud.owns(game) ? 'Ready to play with cloud gaming' : 'Get it free, then play from your library';
}

function buildHomeGallery(root, list){
  const section = el('section', 'xstore-feature');
  section.innerHTML = `
    <div class="xstore-context">Based on your recent activity</div>
    <div class="xstore-title-row">
      <h1>Top games for you</h1>
      <div class="xstore-hints"><span>◉ QUICK ACTIONS</span><span>ⓧ SEE ALL</span></div>
    </div>`;

  const gallery = el('div', 'xstore-gallery');
  const first = list[0];
  if (first) gallery.append(leadCard(first));
  const small = el('div', 'xstore-gallery-small');
  list.slice(1, 6).forEach(game => small.append(storeCard(game, { compact:true })));
  gallery.append(small);
  section.append(gallery);

  const detail = el('div', 'xstore-selected');
  detail.innerHTML = `
    <div class="xstore-selected-title"></div>
    <div class="xstore-selected-meta">
      <span class="xstore-selected-rating"></span>
      <span class="xstore-selected-genre"></span>
    </div>
    <div class="xstore-selected-buy"><strong class="xstore-selected-price"></strong><span class="xstore-selected-offer"></span></div>`;
  section.append(detail);
  root.querySelector('.xstore-content').append(section);
  paintHomeSelection(root, first);
}

function shelf(title, list, { wide=false, subtitle='' } = {}){
  const section = el('section', 'xstore-shelf');
  const head = el('div', 'xstore-shelf-head');
  const copy = el('div');
  copy.append(el('h2', 'xstore-shelf-title', escapeHtml(title)));
  if (subtitle) copy.append(el('div', 'xstore-shelf-sub', escapeHtml(subtitle)));
  head.append(copy);
  section.append(head);
  const row = el('div', `xstore-row${wide ? ' wide' : ''}`);
  list.forEach(game => row.append(storeCard(game, { compact:!wide, wide })));
  section.append(row);
  return section;
}

function renderHome(root){
  const content = el('div', 'xstore-content');
  root.querySelector('.xstore-main').append(content);

  const featured = shuffled(37).slice(0, 6);
  buildHomeGallery(root, featured);

  const coming = games.slice(0, 7);
  const newGames = shuffled(73).slice(0, 10);
  const actionGames = byTag('Action').slice(0, 10);
  const owned = games.filter(g => Cloud.owns(g)).slice(0, 10);

  content.append(shelf('Games coming soon', coming, { wide:true }));
  if (owned.length) content.append(shelf('From your library', owned, { subtitle:'Ready to play with cloud gaming' }));
  content.append(shelf('New games', newGames));
  content.append(shelf('Most played', actionGames));
}

function renderBrowse(root, label){
  const content = el('div', 'xstore-content xstore-browse');
  const head = el('div', 'xstore-page-head');
  head.append(
    el('div', 'xstore-page-kicker', 'MICROSOFT STORE'),
    el('h1', 'xstore-page-title', escapeHtml(label)),
    el('div', 'xstore-page-count', `${matching().length.toLocaleString()} games`)
  );
  content.append(head);

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
    wrap.innerHTML = `<span class="xstore-search-icon">${icon('search')}</span>`;
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'xstore-search';
    input.placeholder = 'Search games, add-ons, and more';
    input.value = query;
    input.setAttribute('aria-label', 'Search Microsoft Store');
    input.addEventListener('input', () => {
      query = input.value;
      renderBrowseGrid(content);
    });
    wrap.append(input);
    content.append(wrap);
  }

  const grid = el('div', 'xstore-grid');
  content.append(grid);
  root.querySelector('.xstore-main').append(content);
  renderBrowseGrid(content);
}

function renderBrowseGrid(content){
  const grid = content.querySelector('.xstore-grid');
  const count = content.querySelector('.xstore-page-count');
  if (!grid) return;
  const list = matching();
  if (count) count.textContent = `${list.length.toLocaleString()} games`;
  grid.innerHTML = '';
  list.forEach(game => grid.append(storeCard(game)));
  if (!list.length){
    const msg = mode === 'wishlist' ? 'Your wish list is empty.' : mode === 'owned' ? 'You do not own any cloud games yet.' : 'No games found.';
    grid.append(el('div', 'xstore-empty', msg));
  }
  window.Nav?.repaint?.();
}

function modeLabel(){
  if (mode === 'games') return 'Games';
  if (mode === 'search') return 'Search';
  if (mode === 'wishlist') return 'Wish list';
  if (mode === 'owned') return 'Owned games';
  return 'Store';
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
    const target = mode === 'home' ? '.store-lead' : mode === 'search' ? '.xstore-search' : '.store-game';
    if (mode === 'search') root.querySelector('.xstore-search')?.focus?.();
    else window.Nav?.focusIn?.(root, target);
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
  const ownership = node.querySelector('.xproduct-ownership');
  const price = node.querySelector('.xproduct-price');
  const acquire = node.querySelector('[data-store-acquire]');
  if (ownership) ownership.textContent = owned ? 'You own this' : 'Available to get';
  if (price) price.textContent = owned ? 'Owned' : 'Free';
  if (acquire){
    acquire.textContent = owned ? 'PLAY WITH CLOUD GAMING' : 'GET';
    acquire.classList.toggle('play', owned);
  }
}

function openProduct(game){
  closeProduct();
  const root = lastRoot || document.getElementById('view-store');
  if (!root) return;

  const { rating, reviews } = starsFor(game);
  const node = el('div', 'xproduct');
  node.innerHTML = `
    <div class="xproduct-art" style="background-image:url('${escapeHtml(game.image || game.cover)}')"></div>
    <div class="xproduct-scrim"></div>
    <button class="xproduct-back" data-nav data-store-back aria-label="Back">${icon('back')}</button>
    <div class="xproduct-body">
      <div class="xproduct-cover-wrap"><img class="xproduct-cover" src="${escapeHtml(game.cover || game.image)}" alt=""></div>
      <div class="xproduct-copy">
        <div class="xproduct-type">XBOX CLOUD GAME</div>
        <h1 class="xproduct-title">${escapeHtml(game.name)}</h1>
        <div class="xproduct-publisher">Stratus Cloud • ${escapeHtml(game.tags[0] || 'Game')}</div>
        <div class="xproduct-rating"><span>★★★★★</span><b>${rating}</b><small>${reviews} ratings</small></div>
        <div class="xproduct-badges"><span>Cloud playable</span><span>Controller</span><span>Digital</span></div>
        <p class="xproduct-desc">${escapeHtml(game.description || 'Play instantly from the cloud.')}</p>
        <div class="xproduct-price"></div>
        <div class="xproduct-ownership"></div>
        <div class="xproduct-actions">
          <button class="xproduct-action primary" data-nav data-store-acquire></button>
          <button class="xproduct-action" data-nav data-store-wish>${wished(game) ? 'REMOVE FROM WISH LIST' : 'ADD TO WISH LIST'}</button>
        </div>
        <div class="xproduct-cloud-row">${CLOUD_ICON}<span>No install required. After you get this game, it appears in My games & apps and can be streamed immediately.</span></div>
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
  root.innerHTML = '<div class="xstore-loading"><div>Microsoft Store</div><span>Loading…</span></div>';
  try {
    games = await Cloud.loadCatalogue();
    renderShell(root);
  } catch (err){
    root.innerHTML = `<div class="xstore-loading error"><div>Microsoft Store</div><span>Could not load Store: ${escapeHtml(err?.message || 'Unknown error')}</span></div>`;
  }
}

window.addEventListener('nav:focus', event => {
  const target = event.detail?.el;
  const card = target?.closest?.('#view-store .store-game');
  if (!card || mode !== 'home') return;
  const game = games.find(item => item.gameKey === card.dataset.storeKey);
  if (game) paintHomeSelection(lastRoot, game);
});

window.addEventListener('nav:button', event => {
  if (event.detail?.button === 'b' && product){ closeProduct(); return; }
  if (event.detail?.button === 'x' && document.body.dataset.view === 'store' && !product){
    switchMode('games');
  }
});

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