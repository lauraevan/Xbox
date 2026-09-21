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
let checkout = null;
let lastRoot = null;
let selectedHomeGame = null;
let autoRotateTimer = null;
const BROWSE_BATCH = 36;
let browseVisible = 0;
let browseObserver = null;
let browseLoadNext = null;
let browseRenderToken = 0;
let searchTimer = null;

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
  if (mode === 'deals') list = list.filter(g => !!dealFor(g));
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

function dealFor(game){
  const key = String(game?.gameKey || game?.name || '');
  let hash = 2166136261;
  for (const ch of key){
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  if (hash % 5 === 0) return null;

  const discounts = [20, 30, 40, 50, 60, 70];
  const bases = [19.99, 29.99, 39.99, 49.99, 59.99, 69.99];
  const discount = discounts[hash % discounts.length];
  const was = bases[(hash >>> 3) % bases.length];
  const raw = was * (1 - discount / 100);
  const now = Math.max(4.99, Math.floor(raw) + .99);
  return { discount, was, now };
}

const money = value => `${Number(value).toFixed(2)}`;

function cardImage(game, wide){ return wide ? (game.image || game.cover) : (game.cover || game.image); }

function storeCard(game, { compact=false, wide=false, deal=false } = {}){
  const offer = deal ? dealFor(game) : null;
  const cls = (compact ? 'store-game store-compact' : wide ? 'store-game store-wide' : 'store-game store-grid-card')
    + (offer ? ' store-deal-card' : '');
  const btn = el('button', cls);
  btn.classList.add('store-card-enter');
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
  img.addEventListener('load', () => img.classList.add('ready'), { once:true });
  if (img.complete) requestAnimationFrame(() => img.classList.add('ready'));
  try { img.fetchPriority = 'low'; } catch {}
  art.append(img);

  if (offer && !Cloud.owns(game)) art.append(el('span', 'store-deal-badge', `SAVE ${offer.discount}%`));
  if (Cloud.owns(game)) art.append(el('span', 'store-owned-badge', 'OWNED'));
  const cloud = el('span', 'store-cloud-mark', CLOUD_ICON);
  cloud.title = 'Cloud playable';
  art.append(cloud);

  const meta = el('span', 'store-game-meta');
  meta.append(el('span', 'store-game-title', escapeHtml(game.name)));

  if (offer && !Cloud.owns(game)){
    const price = el('span', 'store-game-price store-price-deal');
    price.append(
      el('span', 'store-price-old', money(offer.was)),
      el('strong', 'store-price-new', money(offer.now))
    );
    meta.append(price);
  } else {
    meta.append(el('span', 'store-game-price', Cloud.owns(game) ? 'Owned' : 'Free'));
  }

  if (!compact) meta.append(el('span', 'store-game-sub', escapeHtml(game.tags.slice(0, 2).join(' • ') || 'Cloud gaming')));
  btn.append(art, meta);
  btn._navActivate = () => openProduct(game);
  return btn;
}

function leadCard(game){
  const btn = el('button', 'store-game store-lead store-card-enter');
  btn.dataset.nav = '';
  btn.dataset.storeKey = game.gameKey;
  btn.dataset.ringRadius = '.45rem';
  btn.setAttribute('aria-label', game.name);
  const art = el('span', 'store-lead-art');
  const img = document.createElement('img');
  img.src = game.image || game.cover;
  img.alt = '';
  img.loading = 'eager';
  img.decoding = 'async';
  img.addEventListener('load', () => img.classList.add('ready'), { once:true });
  if (img.complete) requestAnimationFrame(() => img.classList.add('ready'));
  try { img.fetchPriority = 'high'; } catch {}
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
    { id:'deals', icon:'store', label:'Deals & specials' },
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
  const feature = root.querySelector('.xstore-feature');
  const detail = root.querySelector('.xstore-selected');
  const title = root.querySelector('.xstore-selected-title');
  const rating = root.querySelector('.xstore-selected-rating');
  const genre = root.querySelector('.xstore-selected-genre');
  const price = root.querySelector('.xstore-selected-price');
  const offer = root.querySelector('.xstore-selected-offer');
  const art = game.image || game.cover || '';
  const { rating:stars, reviews } = starsFor(game);

  if (feature && art){
    feature.style.setProperty('--feature-art', `url("${art.replace(/"/g,'\\\"')}")`);
    feature.classList.remove('selection-changed');
    void feature.offsetWidth;
    feature.classList.add('selection-changed');
  }

  if (title) title.textContent = game.name;
  if (rating) rating.innerHTML = `<span class="xstore-stars">★★★★★</span><b>${stars}</b><span>${reviews}</span>`;
  if (genre) genre.textContent = (game.tags[0] || 'GAME').toUpperCase();
  if (price) price.textContent = Cloud.owns(game) ? 'Owned' : 'Free';
  if (offer) offer.textContent = Cloud.owns(game) ? 'Ready to play with cloud gaming' : 'Get it free, then play from your library';

  if (detail){
    detail.classList.remove('selection-changed');
    requestAnimationFrame(() => detail.classList.add('selection-changed'));
  }
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

function hasAnyTag(game, tags){
  const set = new Set((game?.tags || []).map(lower));
  return tags.some(tag => set.has(lower(tag)));
}

function mixByTags(seed, tags, fallbackSeed=seed){
  const pool = games.filter(game => hasAnyTag(game, tags));
  return shuffled(seed, pool.length >= 6 ? pool : shuffled(fallbackSeed)).slice(0, 9);
}

function dailySeed(){
  const now = new Date();
  return Number(`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`);
}

function stopAutoRows(){
  if (autoRotateTimer !== null){
    cancelAnimationFrame(autoRotateTimer);
    autoRotateTimer = null;
  }
}

function startAutoRows(root){
  /* Static rows are deliberate. The old implementation cloned every card in
     every shelf and ran a requestAnimationFrame loop forever, which doubled
     Store DOM/image work and hurt low-end devices. */
  stopAutoRows();
}

function shelf(title, list, { wide=false, subtitle='', auto=true, kicker='DISCOVER' } = {}){
  const section = el('section', 'xstore-shelf');
  const head = el('div', 'xstore-shelf-head');
  const copy = el('div');
  copy.append(el('div', 'xstore-shelf-kicker', escapeHtml(kicker)));
  copy.append(el('h2', 'xstore-shelf-title', escapeHtml(title)));
  if (subtitle) copy.append(el('div', 'xstore-shelf-sub', escapeHtml(subtitle)));
  head.append(copy);
  section.append(head);
  const row = el('div', `xstore-row${wide ? ' wide' : ''}`);
  row.dataset.storeStatic = '1';
  list.forEach(game => row.append(storeCard(game, { compact:!wide, wide })));
  section.append(row);
  return section;
}

function dealPromo(game, featured=false){
  const offer = dealFor(game);
  if (!offer) return null;

  const btn = el('button', `xstore-deal-promo${featured ? ' featured' : ''}`);
  btn.dataset.nav = '';
  btn.dataset.storeKey = game.gameKey;
  btn.dataset.ringRadius = '.7rem';
  btn.setAttribute('aria-label', `${game.name}, save ${offer.discount} percent`);

  const art = el('span', 'xstore-deal-promo-art');
  art.style.backgroundImage = `url("${game.image || game.cover || ''}")`;

  const copy = el('span', 'xstore-deal-promo-copy');
  copy.innerHTML = `
    <span class="xstore-deal-save">SAVE ${offer.discount}%</span>
    <span class="xstore-deal-name">${escapeHtml(game.name)}</span>
    <span class="xstore-deal-prices"><del>${money(offer.was)}</del><strong>${money(offer.now)}</strong></span>
    ${featured ? '<span class="xstore-deal-note">Featured Store deal</span>' : ''}`;

  btn.append(art, copy);
  btn._navActivate = () => openProduct(game);
  return btn;
}

function buildDeals(list){
  const section = el('section', 'xstore-deals');
  const head = el('div', 'xstore-deals-head');
  head.innerHTML = `
    <div>
      <div class="xstore-deals-kicker">MICROSOFT STORE</div>
      <h2>Deals & specials</h2>
      <p>Big savings on games picked for Xbox.</p>
    </div>
    <span class="xstore-deals-callout">SAVE UP TO 70%</span>`;
  section.append(head);

  const eligible = list.filter(game => dealFor(game)).slice(0, 5);
  const grid = el('div', 'xstore-deals-grid');
  if (eligible[0]){
    const hero = dealPromo(eligible[0], true);
    if (hero) grid.append(hero);
  }

  const side = el('div', 'xstore-deals-side');
  eligible.slice(1).forEach(game => {
    const tile = dealPromo(game, false);
    if (tile) side.append(tile);
  });
  grid.append(side);
  section.append(grid);
  return section;
}

function renderHome(root){
  const content = el('div', 'xstore-content xstore-discovery-home');
  root.querySelector('.xstore-main').append(content);

  const featured = shuffled(37).slice(0, 5);
  buildHomeGallery(root, featured);

  const deals = shuffled(211).filter(game => dealFor(game)).slice(0, 6);
  const recommended = shuffled(401).slice(0, 7);
  const quickPlay = mixByTags(509, ['Easy','Casual','Arcade','Indie'], 510).slice(0, 7);
  const actionShooter = mixByTags(613, ['Action','Shooting','Fighting'], 614).slice(0, 7);
  const racingDriving = mixByTags(719, ['Racing','Sports','Simulation'], 720).slice(0, 7);
  const owned = games.filter(g => Cloud.owns(g)).slice(0, 7);

  content.append(buildDeals(deals));
  content.append(shelf('Games we recommend', recommended, {
    subtitle:'Hand-picked from the cloud catalogue',
    kicker:'FOR YOU',
    wide:true,
    auto:false
  }));
  content.append(shelf('Quick play', quickPlay, {
    subtitle:'Jump in fast without overthinking it',
    kicker:'PLAY NOW',
    wide:true,
    auto:false
  }));
  if (owned.length) content.append(shelf('Continue from your library', owned, {
    subtitle:'Ready to stream',
    kicker:'YOUR GAMES',
    wide:true,
    auto:false
  }));
  content.append(shelf('Action & shooter', actionShooter, {
    kicker:'HIGH ENERGY',
    wide:true,
    auto:false
  }));
  content.append(shelf('Racing & driving', racingDriving, {
    wide:true,
    kicker:'FULL SPEED',
    auto:false
  }));

  /* Off-screen shelves are intentionally omitted. Games, Deals, Search and
     Owned still expose the complete catalogue without making Store Home
     render ~100 cards at once. */
}

function stopBrowseAutoload(){
  browseObserver?.disconnect?.();
  browseObserver = null;
  browseLoadNext = null;
}

function appendBrowseBatch(content, list, token){
  if (token !== browseRenderToken || !content?.isConnected) return;
  const grid = content.querySelector('.xstore-grid');
  const sentinel = grid?.querySelector('.xstore-autoload-sentinel');
  if (!grid || !sentinel) return;

  const start = browseVisible;
  const end = Math.min(list.length, start + BROWSE_BATCH);
  if (end <= start){
    sentinel.remove();
    stopBrowseAutoload();
    return;
  }

  const frag = document.createDocumentFragment();
  list.slice(start, end).forEach((game, index) => {
    const card = storeCard(game, { deal:mode === 'deals' });
    card.style.setProperty('--store-delay', `${Math.min(index, 14) * 14}ms`);
    frag.append(card);
  });
  grid.insertBefore(frag, sentinel);
  browseVisible = end;

  if (browseVisible >= list.length){
    sentinel.classList.add('done');
    setTimeout(() => sentinel.remove(), 160);
    stopBrowseAutoload();
  }
  window.Nav?.repaint?.();
}

function armBrowseAutoload(content, list, token){
  const grid = content.querySelector('.xstore-grid');
  const sentinel = grid?.querySelector('.xstore-autoload-sentinel');
  if (!grid || !sentinel || browseVisible >= list.length) return;

  let loading = false;
  browseLoadNext = () => {
    if (loading || token !== browseRenderToken || browseVisible >= list.length) return;
    loading = true;
    sentinel.classList.add('loading');
    requestAnimationFrame(() => {
      appendBrowseBatch(content, list, token);
      loading = false;
      sentinel.classList.remove('loading');
    });
  };

  if ('IntersectionObserver' in window){
    browseObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) browseLoadNext?.();
    }, {
      root:content,
      rootMargin:'900px 0px 1100px',
      threshold:0
    });
    browseObserver.observe(sentinel);
  } else {
    const pump = () => {
      if (token !== browseRenderToken || browseVisible >= list.length) return;
      browseLoadNext?.();
      setTimeout(pump, 60);
    };
    setTimeout(pump, 60);
  }
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
      browseVisible = 0;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (input.isConnected) renderBrowseGrid(content);
      }, 110);
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
  stopBrowseAutoload();
  const token = ++browseRenderToken;
  const grid = content.querySelector('.xstore-grid');
  const count = content.querySelector('.xstore-page-count');
  if (!grid) return;

  const list = matching();
  browseVisible = 0;
  if (count) count.textContent = `${list.length.toLocaleString()} games`;
  grid.replaceChildren();

  if (!list.length){
    const msg = mode === 'wishlist' ? 'Your wish list is empty.' : mode === 'owned' ? 'You do not own any cloud games yet.' : 'No games found.';
    grid.append(el('div', 'xstore-empty', msg));
    window.Nav?.repaint?.();
    return;
  }

  const sentinel = el('div','xstore-autoload-sentinel');
  sentinel.setAttribute('aria-hidden','true');
  sentinel.innerHTML = '<span></span><span></span><span></span>';
  grid.append(sentinel);

  appendBrowseBatch(content, list, token);
  armBrowseAutoload(content, list, token);
}
function modeLabel(){
  if (mode === 'games') return 'Games';
  if (mode === 'deals') return 'Deals & specials';
  if (mode === 'search') return 'Search';
  if (mode === 'wishlist') return 'Wish list';
  if (mode === 'owned') return 'Owned games';
  return 'Store';
}

function renderShell(root){
  if (!root) return;
  stopAutoRows();
  stopBrowseAutoload();
  lastRoot = root;
  closeProduct();
  root.classList.add('reference-store');

  let shell = root.querySelector(':scope > .xstore-shell');
  let main = shell?.querySelector('.xstore-main');

  if (!shell || !main){
    root.innerHTML = '';
    shell = el('div', 'xstore-shell');
    main = el('main', 'xstore-main');
    shell.append(buildRail(root), main);
    root.append(shell);
  } else {
    main.replaceChildren();
    shell.querySelectorAll('.xstore-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.storeMode === mode);
    });
  }

  if (mode === 'home') renderHome(root);
  else renderBrowse(root, modeLabel());

  const content = main.querySelector('.xstore-content');
  if (content){
    content.classList.remove('store-page-enter');
    requestAnimationFrame(() => content.classList.add('store-page-enter'));
  }

  window.Nav?.repaint?.();
  requestAnimationFrame(() => {
    const target = mode === 'home' ? '.store-lead' : mode === 'search' ? '.xstore-search' : '.store-game';
    if (mode === 'search') root.querySelector('.xstore-search')?.focus?.();
    else window.Nav?.focusIn?.(root, target);
  });
}

function switchMode(next, root = lastRoot){
  if (!root || mode === next) return;
  mode = next;
  if (next !== 'search') query = '';
  filter = 'all';
  browseVisible = 0;
  clearTimeout(searchTimer);
  renderShell(root);
}

function showCloudError(err){
  window.Sound?.error?.();
  window.App?.toast?.('Cloud gaming', err?.message || 'Could not start this game.');
}

function closeCheckout(){
  if (!checkout) return;
  const node = checkout;
  checkout = null;
  node.classList.add('out');
  setTimeout(() => node.remove(), 160);
  try { window.Nav?.popLayer?.(); } catch {}
  requestAnimationFrame(() => window.Nav?.repaint?.());
}

function closeProduct(){
  closeCheckout();
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
  const offer = dealFor(game);
  if (ownership) ownership.textContent = owned
    ? 'You own this'
    : offer ? `Store deal • Save ${offer.discount}%` : 'Available to get';
  if (price){
    if (owned){
      price.textContent = 'Owned';
    } else if (offer){
      price.innerHTML = `<del class="xproduct-price-old">${money(offer.was)}</del><strong class="xproduct-price-now">${money(offer.now)}</strong>`;
    } else {
      price.textContent = 'Free';
    }
  }
  if (acquire){
    acquire.textContent = owned
      ? 'PLAY WITH CLOUD GAMING'
      : offer ? `BUY ${money(offer.now)}` : 'GET';
    acquire.classList.toggle('play', owned);
  }
}

async function enrichProductDetails(node, game){
  const rich = await window.GameDetails?.get?.(game);
  if (!rich || !node?.isConnected || node.dataset.richDetails === '1') return;
  node.dataset.richDetails = '1';

  const hero = rich.hero || rich.screenshots?.[0] || rich.cover || game.image || game.cover || '';
  const cover = rich.cover || game.cover || game.image || '';
  const art = node.querySelector('.xproduct-art');
  const coverImg = node.querySelector('.xproduct-cover');
  const publisher = node.querySelector('.xproduct-publisher');
  const rating = node.querySelector('.xproduct-rating');
  const desc = node.querySelector('.xproduct-desc');

  if (art && hero) art.style.backgroundImage = `url("${hero}")`;
  if (coverImg && cover) coverImg.src = cover;

  const dev = Array.isArray(rich.developers) ? rich.developers.filter(Boolean) : [];
  const pubs = Array.isArray(rich.publishers) ? rich.publishers.filter(Boolean) : [];
  if (publisher){
    const studio = dev.join(', ') || pubs.join(', ') || 'Stratus Cloud';
    publisher.textContent = studio;
  }

  if (rating && Number.isFinite(Number(rich.rating))){
    rating.innerHTML = `<span>★★★★★</span><b>${Math.round(Number(rich.rating))}</b><small>/ 100</small>`;
  }

  const copyText = String(rich.summary || rich.description || game.description || '').trim();
  if (desc && copyText) desc.textContent = copyText;

  const details = document.createElement('section');
  details.className = 'xproduct-rich-details';

  const facts = document.createElement('div');
  facts.className = 'xproduct-rich-facts';
  const rows = [
    ['Release', rich.releaseDate],
    ['Developer', dev.join(', ')],
    ['Publisher', pubs.join(', ')],
    ['Platforms', (rich.platforms || []).filter(value => value && !/^trailer for\b/i.test(String(value))).join(' · ')],
    ['Genres', (rich.genres || []).filter(Boolean).join(' · ')],
    ['Modes', (rich.gameModes || []).filter(Boolean).join(' · ')],
    ['Themes', (rich.themes || []).filter(Boolean).join(' · ')],
    ['Franchise', (rich.franchises || []).filter(Boolean).join(' · ')]
  ].filter(([,value]) => String(value || '').trim());

  rows.forEach(([label,value]) => {
    const row = document.createElement('div');
    row.className = 'xproduct-rich-fact';
    row.innerHTML = `<small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong>`;
    facts.append(row);
  });
  if (facts.childElementCount) details.append(facts);

  const screenshots = Array.isArray(rich.screenshots) ? rich.screenshots.filter(Boolean) : [];
  if (screenshots.length){
    const head = document.createElement('div');
    head.className = 'xproduct-rich-head';
    head.innerHTML = `<strong>Screenshots</strong><span>${screenshots.length} local</span>`;

    const rail = document.createElement('div');
    rail.className = 'xproduct-rich-gallery';

    const selectShot = (src,button) => {
      if (art) art.style.backgroundImage = `url("${src}")`;
      rail.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
      button?.classList.add('selected');
    };

    screenshots.forEach((src,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'xproduct-rich-shot' + (index === 0 ? ' selected' : '');
      button.dataset.nav = '';
      button.dataset.ringRadius = '.5rem';
      button.setAttribute('aria-label', `Screenshot ${index + 1} of ${screenshots.length}`);
      button.innerHTML = `<img src="${escapeHtml(src)}" alt="" loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async">`;
      button._navActivate = () => selectShot(src,button);
      button.addEventListener('click',event => {
        event.preventDefault();
        event.stopPropagation();
        button._navActivate();
      });
      button.addEventListener('pointerenter',() => selectShot(src,button));
      button.addEventListener('focus',() => button.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'}));
      rail.append(button);
    });

    details.append(head,rail);
  }

  const copy = node.querySelector('.xproduct-copy');
  if (copy && details.childElementCount){
    const cloudRow = copy.querySelector('.xproduct-cloud-row');
    if (cloudRow) cloudRow.insertAdjacentElement('beforebegin',details);
    else copy.append(details);
  }

  window.Nav?.repaint?.();
}

function openCheckout(game, productNode, acquireButton){
  closeCheckout();

  const offer = dealFor(game);
  const priceText = offer ? money(offer.now) : 'Free';
  const oldPrice = offer ? money(offer.was) : '';
  const confirmLabel = offer ? `BUY ${priceText}` : 'GET';

  const layer = el('div', 'xcheckout');
  layer.innerHTML = `
    <button class="xcheckout-scrim" aria-label="Cancel purchase"></button>
    <section class="xcheckout-panel" role="dialog" aria-modal="true" aria-label="Confirm purchase">
      <div class="xcheckout-head">
        <div class="xcheckout-kicker">MICROSOFT STORE</div>
        <h2>Buy game</h2>
      </div>
      <div class="xcheckout-game">
        <img src="${escapeHtml(game.cover || game.image)}" alt="">
        <div>
          <strong>${escapeHtml(game.name)}</strong>
          <span>Standard Edition · Digital</span>
        </div>
      </div>
      <div class="xcheckout-line">
        <span>Item</span>
        <span>${oldPrice ? `<del>${oldPrice}</del>` : ''}<strong>${priceText}</strong></span>
      </div>
      <div class="xcheckout-line total">
        <span>Total</span>
        <span><strong>${priceText}</strong></span>
      </div>
      <div class="xcheckout-profile">
        <span class="xcheckout-profile-dot"></span>
        <div><strong>xboxtest</strong><small>Purchasing for this Xbox profile</small></div>
      </div>
      <div class="xcheckout-note">${offer ? 'Demo Store checkout. No real payment is processed.' : 'No payment required. This game will be added to My games & apps.'}</div>
      <div class="xcheckout-actions">
        <button class="xcheckout-confirm" data-nav data-checkout-confirm>${confirmLabel}</button>
        <button class="xcheckout-cancel" data-nav data-checkout-cancel>CANCEL</button>
      </div>
    </section>`;

  const finish = () => {
    Cloud.acquire(game);
    refreshProductOwnership(productNode, game);
    window.Sound?.select?.();
    window.App?.toast?.('Added to your library', game.name);
    window.CloudLibrary?.refresh?.();
    closeCheckout();
    requestAnimationFrame(() => {
      window.Nav?.repaint?.();
      window.Nav?.focus?.(acquireButton, { silent:true });
    });
  };

  const confirm = layer.querySelector('[data-checkout-confirm]');
  const cancel = layer.querySelector('[data-checkout-cancel]');
  confirm._navActivate = finish;
  cancel._navActivate = closeCheckout;
  layer.querySelector('.xcheckout-scrim').addEventListener('click', closeCheckout);
  confirm.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    finish();
  });
  cancel.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeCheckout();
  });

  productNode.append(layer);
  checkout = layer;
  window.Nav?.pushLayer?.(layer);
  requestAnimationFrame(() => window.Nav?.focusIn?.(layer, '[data-checkout-confirm]'));
}

function openProduct(game){
  closeProduct();
  const root = lastRoot || document.getElementById('view-store');
  if (!root) return;

  const { rating, reviews } = starsFor(game);
  const productDeal = dealFor(game);
  const node = el('div', 'xproduct');
  node.innerHTML = `
    <div class="xproduct-art" style="background-image:url('${escapeHtml(game.image || game.cover)}')"></div>
    <div class="xproduct-scrim"></div>
    <button class="xproduct-back" data-nav data-store-back aria-label="Back">${icon('back')}</button>
    <div class="xproduct-body">
      <div class="xproduct-main">
        <div class="xproduct-cover-wrap"><img class="xproduct-cover" src="${escapeHtml(game.cover || game.image)}" alt=""></div>
        <div class="xproduct-copy">
          <div class="xproduct-type">XBOX CLOUD GAME</div>
          <h1 class="xproduct-title">${escapeHtml(game.name)}</h1>
          <div class="xproduct-meta">
            <div class="xproduct-publisher">Stratus Cloud • ${escapeHtml(game.tags[0] || 'Game')}</div>
            <div class="xproduct-rating"><span>★★★★★</span><b>${rating}</b><small>${reviews} ratings</small></div>
          </div>
          <div class="xproduct-badges"><span>Cloud playable</span><span>Controller</span><span>Digital</span></div>
          ${productDeal ? `<div class="xproduct-deal-strip"><b>SAVE ${productDeal.discount}%</b><span>Deals & specials</span></div>` : ''}
          <p class="xproduct-desc">${escapeHtml(game.description || 'Play instantly from the cloud.')}</p>
          <div class="xproduct-cloud-row">${CLOUD_ICON}<span>Streams instantly after purchase. No install required.</span></div>
        </div>
      </div>
      <aside class="xproduct-buy-card">
        <div class="xproduct-buy-kicker">STANDARD EDITION</div>
        <div class="xproduct-buy-title">${escapeHtml(game.name)}</div>
        <div class="xproduct-price"></div>
        <div class="xproduct-ownership"></div>
        <div class="xproduct-buy-rule"></div>
        <div class="xproduct-buy-benefits">
          <span>✓ Play with cloud gaming</span>
          <span>✓ Added to My games & apps</span>
          <span>✓ No download required</span>
        </div>
        <div class="xproduct-actions">
          <button class="xproduct-action primary" data-nav data-store-acquire></button>
          <button class="xproduct-action secondary" data-nav data-store-wish>${wished(game) ? 'REMOVE FROM WISH LIST' : 'ADD TO WISH LIST'}</button>
        </div>
        <div class="xproduct-buy-foot">Digital purchase · Xbox profile: xboxtest</div>
      </aside>
    </div>`;

  const acquire = node.querySelector('[data-store-acquire]');
  acquire._navActivate = async () => {
    if (!Cloud.owns(game)){
      openCheckout(game, node, acquire);
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
  void enrichProductDetails(node, game);
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
  if (!card) return;

  if (mode === 'home'){
    const game = games.find(item => item.gameKey === card.dataset.storeKey);
    if (game) paintHomeSelection(lastRoot, game);
    return;
  }

  const grid = card.closest('.xstore-grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.store-game')];
  const index = cards.indexOf(card);
  if (index >= Math.max(0, cards.length - 10)) browseLoadNext?.();
});

window.addEventListener('nav:button', event => {
  if (event.detail?.button === 'b' && checkout){ closeCheckout(); return; }
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