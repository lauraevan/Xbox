/* ═══════════════════════════════════════════════════════════
   VIEWS — home, library, Game Pass, search, settings.
   Every visual here is drawn from geometry or from artwork the
   manifest points at; nothing is baked into the repo.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ───────── icon set (original geometry) ───────── */
const ICON = {
  play:    '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z"/></svg>',
  pin:     '<svg viewBox="0 0 24 24"><path d="M14 2 9.6 6.4l-4.3 1.2 11.1 11.1 1.2-4.3L22 10z M8.6 15.4 3 21"/></svg>',
  plus:    '<svg viewBox="0 0 24 24"><path class="s" d="M12 5v14M5 12h14"/></svg>',
  grid:    '<svg viewBox="0 0 24 24"><path class="s" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>',
  brush:   '<svg viewBox="0 0 24 24"><path class="s" d="M3 17.5 13.8 6.7l3.5 3.5L6.5 21H3zM15.5 5l2.4-2.4a1.6 1.6 0 0 1 2.3 0l1.2 1.2a1.6 1.6 0 0 1 0 2.3L19 8.5z"/></svg>',
  pad:     '<svg viewBox="0 0 24 24"><path class="s" d="M7.5 7h9a5.5 5.5 0 0 1 5.4 4.4l.8 4.3A2.7 2.7 0 0 1 20 19a2.7 2.7 0 0 1-2.1-1L16.4 16H7.6L6.1 18A2.7 2.7 0 0 1 4 19a2.7 2.7 0 0 1-2.7-3.3l.8-4.3A5.5 5.5 0 0 1 7.5 7z"/><path class="s" d="M7 10.4v3M5.5 11.9h3M16 11h.01M18 13h.01"/></svg>',
  trophy:  '<svg viewBox="0 0 24 24"><path class="s" d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5a2.5 2.5 0 0 1-2.5 4M9.5 14h5l.7 4.2H8.8zM7.5 20h9"/></svg>',
  person:  '<svg viewBox="0 0 24 24"><circle class="s" cx="12" cy="8" r="4"/><path class="s" d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  party:   '<svg viewBox="0 0 24 24"><circle class="s" cx="9" cy="8" r="3.4"/><path class="s" d="M2.8 19a6.2 6.2 0 0 1 12.4 0M16 5.2a3.4 3.4 0 0 1 0 6.6M18.4 19a6.3 6.3 0 0 0-2.6-5.1"/></svg>',
  bell:    '<svg viewBox="0 0 24 24"><path class="s" d="M12 3a6 6 0 0 0-6 6c0 4-1.5 5.5-1.5 5.5h15S18 13 18 9a6 6 0 0 0-6-6zM10 18a2 2 0 0 0 4 0"/></svg>',
  capture: '<svg viewBox="0 0 24 24"><rect class="s" x="3" y="6" width="18" height="13" rx="2.4"/><circle class="s" cx="12" cy="12.5" r="3.4"/><path class="s" d="M8.6 6l1.4-2.2h4L15.4 6"/></svg>',
  power:   '<svg viewBox="0 0 24 24"><path class="s" d="M12 3.5v8M6.8 6.4a7.5 7.5 0 1 0 10.4 0"/></svg>',
  gear:    '<svg viewBox="0 0 24 24"><path class="s" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z"/><circle class="s" cx="12" cy="12" r="2.9"/></svg>',
  home:    '<svg viewBox="0 0 24 24"><path class="s" d="M3.5 10.5 12 3.5l8.5 7M5.8 9.2V20h12.4V9.2"/></svg>',
  search:  '<svg viewBox="0 0 24 24"><circle class="s" cx="10.5" cy="10.5" r="6.5"/><path class="s" d="m15.4 15.4 5.6 5.6"/></svg>',
  store:   '<svg viewBox="0 0 24 24"><path class="s" d="M4 8h16l-1.2 11.2A2 2 0 0 1 16.8 21H7.2a2 2 0 0 1-2-1.8L4 8zM8.6 8V6a3.4 3.4 0 0 1 6.8 0v2"/></svg>',
  clock:   '<svg viewBox="0 0 24 24"><circle class="s" cx="12" cy="12" r="8.6"/><path class="s" d="M12 7v5.3l3.3 2"/></svg>',
  back:    '<svg viewBox="0 0 24 24"><path class="s" d="M10 5 3.5 12 10 19M3.5 12H20"/></svg>',
  info:    '<svg viewBox="0 0 24 24"><circle class="s" cx="12" cy="12" r="8.6"/><path class="s" d="M12 11v5.5M12 7.8h.01"/></svg>',
  link:    '<svg viewBox="0 0 24 24"><path class="s" d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.3 1.3M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.3-1.3"/></svg>'
};

/* ───────── cover art with graceful degradation ───────── */
function coverArt(game, sizes){
  const wrap = el('span', 'tile-art');
  const fallback = el('span', 'cover-fallback', escapeHtml(game.name.slice(0, 2).toUpperCase()));
  const img = el('img', 'cover');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  if (sizes) img.sizes = sizes;

  let triedMirror = false;
  img.addEventListener('load', () => { img.classList.add('loaded'); fallback.remove(); });
  img.addEventListener('error', () => {
    if (!triedMirror && game.coverAlt && game.coverAlt !== game.cover){
      triedMirror = true; img.src = game.coverAlt;
    } else img.remove();
  });
  img.src = game.cover;

  wrap.append(fallback, img);
  return wrap;
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* ───────── tiles ───────── */
function tile(game, kind = 'sm'){
  const btn = el('button', `tile tile-${kind}`);
  btn.dataset.nav = '';
  btn.dataset.gameId = game.id;
  btn.setAttribute('aria-label', game.name);
  btn.append(coverArt(game));

  if (game.tag)
    btn.append(el('span', `tile-badge ${game.tag.cls}`, game.tag.badge));
  if (window.State.isPinned(game.id))
    btn.append(el('span', 'tile-pin', ICON.pin.replace('class="s"', '')));

  btn.append(el('span', 'tile-label', escapeHtml(game.name)));
  btn._navActivate = () => window.App.openDetail(game);
  return btn;
}

function gridItem(game){
  const btn = el('button', 'grid-item');
  btn.dataset.nav = '';
  btn.dataset.gameId = game.id;
  btn.setAttribute('aria-label', game.name);
  btn.append(coverArt(game));
  if (game.tag) btn.append(el('span', `tile-badge ${game.tag.cls}`, game.tag.badge));
  btn.append(el('span', 'tile-label', escapeHtml(game.name)));
  btn._navActivate = () => window.App.openDetail(game);
  return btn;
}

/* ═══════════════ HOME ═══════════════ */
function renderHome(root){
  root.innerHTML = '';

  const hero = el('div', 'hero');
  hero.innerHTML =
    `<div class="hero-eyebrow" id="heroKicker"></div>
     <h1 class="hero-title" id="heroTitle"></h1>
     <div class="hero-meta" id="heroMeta"></div>`;
  root.append(hero);

  /* ── the tile rail ── */
  const rail  = el('div', 'rail');
  const strip = el('div', 'rail-strip');

  const pinned  = window.State.pins().map(id => window.Catalog.get(id)).filter(Boolean);
  const recents = window.State.recentIds().map(id => window.Catalog.get(id)).filter(Boolean);
  const feature = window.Catalog.featured();

  // the hero tile is whatever you touched last, otherwise a featured pick
  const headline = recents[0] || pinned[0] || feature[0] || window.Catalog.all()[0];
  if (headline) strip.append(tile(headline, 'hero'));

  const seen = new Set(headline ? [headline.id] : []);
  const queue = [...pinned, ...recents, ...feature, ...window.Catalog.seededShuffle(window.Catalog.standard(), 91)];
  for (const g of queue){
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    strip.append(tile(g, 'sm'));
    if (seen.size > 24) break;
  }

  const add = el('button', 'tile tile-sm tile-add', ICON.plus);
  add.dataset.nav = '';
  add.setAttribute('aria-label', 'See all games');
  add._navActivate = () => window.App.setView('library');
  strip.append(add);

  rail.append(strip);
  root.append(rail);

  /* ── spotlight cards ── */
  const cards = el('div', 'cards');
  const mosaic = window.Catalog.seededShuffle(window.Catalog.all(), 13).slice(0, 4);

  cards.append(
    makeCard({
      label: 'Browse your games',
      mosaic,
      onActivate: () => window.App.setView('library')
    }),
    makeCard({
      label: 'Customize your Home',
      grad: 'grad-a',
      illus: ICON.brush,
      onActivate: () => window.App.setView('settings', { section:'personalization' })
    }),
    makeCard({
      label: feature[1]?.name || 'Game Pass',
      art: feature[1]?.cover,
      artAlt: feature[1]?.coverAlt,
      chip: 'GAME PASS',
      grad: 'grad-b',
      onActivate: () => feature[1] ? window.App.openDetail(feature[1]) : window.App.setView('pass')
    }),
    makeCard({
      label: 'Play like a Pro',
      grad: 'grad-e',
      illus: ICON.pad,
      onActivate: () => window.App.setView('settings', { section:'devices' })
    })
  );
  root.append(cards);

  updateHero(headline);
}

function makeCard({ label, mosaic, art, artAlt, chip, grad, illus, onActivate }){
  const btn = el('button', 'card');
  btn.dataset.nav = '';
  btn.setAttribute('aria-label', label);

  if (grad) btn.classList.add(grad);

  if (mosaic){
    const m = el('div', 'card-mosaic');
    mosaic.forEach(g => {
      const cell = el('div');
      const img = el('img');
      img.alt = ''; img.loading = 'lazy';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      img.addEventListener('error', () => {
        if (g.coverAlt && img.src !== g.coverAlt) img.src = g.coverAlt;
        else img.remove();
      });
      img.src = g.cover;
      cell.append(img);
      m.append(cell);
    });
    btn.append(m);
  } else if (art){
    const wrap = el('div', 'card-art');
    const img = el('img');
    img.alt = ''; img.loading = 'lazy';
    img.addEventListener('error', () => { if (artAlt && img.src !== artAlt) img.src = artAlt; else wrap.remove(); });
    img.src = art;
    wrap.append(img);
    btn.append(wrap);
  } else if (illus){
    btn.append(el('div', 'card-illus', illus));
  }

  btn.append(el('div', 'card-scrim'));
  if (chip) btn.append(el('div', 'card-chip', escapeHtml(chip)));
  btn.append(el('div', 'card-label', escapeHtml(label)));
  btn._navActivate = onActivate;
  return btn;
}

function updateHero(game){
  const hero = $('.hero');
  if (!hero) return;
  if (!game || window.State.settings.heroText === false){ hero.classList.remove('show'); return; }
  $('#heroKicker').textContent = game.featured ? 'Featured' : (game.tag ? game.tag.label : 'Jump back in');
  $('#heroTitle').textContent  = game.name;
  $('#heroMeta').innerHTML =
    `<span>${escapeHtml(game.author)}</span><span class="dot"></span>` +
    `<span>${window.State.isPinned(game.id) ? 'Pinned' : 'Ready to play'}</span>`;
  hero.classList.add('show');
}

/* ═══════════════ LIBRARY ═══════════════ */
const LIBRARY_TABS = [
  { id:'recent',    label:'Recently played' },
  { id:'all',       label:'All games' },
  { id:'pinned',    label:'Pinned' },
  { id:'ports',     label:'Ports',     tag:'port' },
  { id:'flash',     label:'Flash',     tag:'flash' },
  { id:'emulators', label:'Emulators', tag:'emulator' },
  { id:'apps',      label:'Apps',      tag:'tools' }
];

let libraryTab = null;   // resolved on first render

/** Open on "Recently played" once there is history, otherwise the full list. */
function defaultLibraryTab(){
  return window.State.recentIds().length ? 'recent' : 'all';
}

function libraryItems(tabId){
  const C = window.Catalog, S = window.State;
  switch (tabId){
    case 'recent': return S.recentIds().map(id => C.get(id)).filter(Boolean);
    case 'pinned': return S.pins().map(id => C.get(id)).filter(Boolean);
    case 'all':    return C.alphabetical();
    default: {
      const tab = LIBRARY_TABS.find(t => t.id === tabId);
      return tab?.tag ? C.byTag(tab.tag) : [];
    }
  }
}

function renderLibrary(root){
  if (!libraryTab) libraryTab = defaultLibraryTab();
  root.innerHTML = '';
  const page = el('div', 'page');

  const head = el('div', 'page-head');
  head.append(
    el('h1', 'page-title', 'My games &amp; apps'),
    el('p', 'page-sub', `${window.Catalog.count().toLocaleString()} titles ready to stream`)
  );
  page.append(head);

  const pivots = el('div', 'pivots');
  LIBRARY_TABS.forEach(tab => {
    const btn = el('button', 'pivot' + (tab.id === libraryTab ? ' active' : ''), escapeHtml(tab.label));
    btn.dataset.nav = '';
    btn._navActivate = () => {
      libraryTab = tab.id;
      renderLibrary(root);
      window.Nav.focusFirst('.pivot.active');
    };
    pivots.append(btn);
  });
  page.append(pivots);

  const scroll = el('div', 'page-scroll');
  const grid = el('div', 'grid');
  scroll.append(grid);
  page.append(scroll);
  root.append(page);

  const items = libraryItems(libraryTab);
  if (!items.length){
    scroll.innerHTML = '';
    scroll.append(el('div', 'empty',
      `${ICON.grid}<div>Nothing here yet.<br>Play something and it will show up.</div>`));
    return;
  }
  paginate(grid, scroll, items);
}

/** Feed long lists in slices so a 700-tile grid never blocks the first paint. */
function paginate(grid, scroll, items, size = 60){
  let shown = 0;
  const sentinel = el('div');
  sentinel.style.height = '1px';

  function more(){
    const slice = items.slice(shown, shown + size);
    slice.forEach(g => grid.append(gridItem(g)));
    shown += slice.length;
    if (shown >= items.length) observer.disconnect();
    else grid.append(sentinel);
    window.Nav.repaint();
  }

  const observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)){ sentinel.remove(); more(); }
  }, { root: scroll, rootMargin: '600px' });

  more();
  observer.observe(sentinel);
}

/* ═══════════════ GAME PASS ═══════════════ */
function renderPass(root){
  root.innerHTML = '';
  window.State.unlock('pass');

  const page = el('div', 'page');
  const scroll = el('div', 'page-scroll');

  const shelves = window.Catalog.shelves();
  const spotlight = shelves[0]?.items[Math.floor(Math.random() * Math.min(shelves[0].items.length, 12))]
                 || window.Catalog.all()[0];

  /* ── spotlight banner ── */
  const heroBtn = el('button', 'gp-hero');
  heroBtn.dataset.nav = '';
  heroBtn.dataset.ringRadius = '0.6rem';
  const art = el('div', 'gp-hero-art');
  const img = el('img');
  img.alt = ''; img.src = spotlight.cover;
  img.addEventListener('error', () => { if (img.src !== spotlight.coverAlt) img.src = spotlight.coverAlt; });
  art.append(img);
  heroBtn.append(art, el('div', 'gp-hero-scrim'));
  heroBtn.append(el('div', 'gp-hero-copy',
    `<div class="gp-hero-kicker">Game Pass &middot; Featured</div>
     <div class="gp-hero-title">${escapeHtml(spotlight.name)}</div>
     <div class="gp-hero-meta">${escapeHtml(spotlight.author)} &nbsp;&middot;&nbsp; Play instantly, no install</div>
     <div class="gp-play">${ICON.play} Play</div>`));
  heroBtn._navActivate = () => window.App.openDetail(spotlight);
  scroll.append(heroBtn);

  /* ── shelves ── */
  shelves.forEach(shelf => {
    const rail = el('div', 'rail');
    const head = el('div', 'rail-head');
    head.append(
      el('h2', 'rail-title', escapeHtml(shelf.title)),
      el('span', 'rail-count', `${shelf.items.length}`)
    );
    const strip = el('div', 'rail-strip');
    shelf.items.slice(0, 30).forEach(g => strip.append(tile(g, 'sm')));
    rail.append(head, strip);
    scroll.append(rail);
  });

  /* ── studios ── */
  const studios = window.Catalog.studios().slice(0, 6);
  studios.forEach(([name, items]) => {
    const rail = el('div', 'rail');
    const head = el('div', 'rail-head');
    head.append(el('h2', 'rail-title', escapeHtml(name)), el('span', 'rail-count', `${items.length}`));
    const strip = el('div', 'rail-strip');
    items.slice(0, 30).forEach(g => strip.append(tile(g, 'sm')));
    rail.append(head, strip);
    scroll.append(rail);
  });

  page.append(scroll);
  root.append(page);
}

/* ═══════════════ SEARCH ═══════════════ */
const KEY_ROWS = [
  '1234567890',
  'QWERTYUIOP',
  'ASDFGHJKL-',
  'ZXCVBNM.\'&'
];
let searchQuery = '';

function renderSearch(root){
  root.innerHTML = '';
  const wrap = el('div', 'search-wrap');

  /* ── left: field + on-screen keyboard ── */
  const left = el('div', 'search-left');
  const field = el('div', 'search-field');
  field.innerHTML = ICON.search;
  const input = el('input', 'search-input');
  input.type = 'text';
  input.placeholder = 'Search games and apps';
  input.value = searchQuery;
  input.setAttribute('aria-label', 'Search games and apps');
  field.append(input);
  left.append(field);

  const kb = el('div', 'keyboard');
  KEY_ROWS.forEach(row => [...row].forEach(ch => {
    const k = el('button', 'key', escapeHtml(ch));
    k.dataset.nav = '';
    k._navActivate = () => { setQuery(searchQuery + ch); };
    kb.append(k);
  }));

  const space = el('button', 'key xwide', 'SPACE');
  space.dataset.nav = '';
  space._navActivate = () => setQuery(searchQuery + ' ');

  const back = el('button', 'key wide', 'DELETE');
  back.dataset.nav = '';
  back._navActivate = () => setQuery(searchQuery.slice(0, -1));

  const clear = el('button', 'key wide', 'CLEAR');
  clear.dataset.nav = '';
  clear._navActivate = () => setQuery('');

  const close = el('button', 'key xwide', 'DONE');
  close.dataset.nav = '';
  close._navActivate = () => window.Nav.focusFirst('.result-grid .grid-item');

  kb.append(space, back, clear, close);
  left.append(kb);

  /* ── right: live results ── */
  const right = el('div', 'search-right');
  const results = el('div', 'result-grid');
  const status = el('p', 'page-sub', 'Start typing to search the catalogue.');
  right.append(status, results);

  wrap.append(left, right);
  root.append(wrap);

  function setQuery(next){
    searchQuery = next.slice(0, 40);
    input.value = searchQuery;
    draw();
  }

  function draw(){
    results.innerHTML = '';
    const q = searchQuery.trim();
    if (!q){
      status.textContent = 'Start typing to search the catalogue.';
      const picks = window.Catalog.seededShuffle(window.Catalog.all(), 5).slice(0, 18);
      status.textContent = 'Suggested for you';
      picks.forEach(g => results.append(gridItem(g)));
      window.Nav.repaint();
      return;
    }
    const found = window.Catalog.search(q);
    status.textContent = found.length
      ? `${found.length} result${found.length === 1 ? '' : 's'} for "${q}"`
      : `No results for "${q}"`;
    found.slice(0, 60).forEach(g => results.append(gridItem(g)));
    if (found.length) window.State.unlock('search');
    window.Nav.repaint();
  }

  input.addEventListener('input', () => { searchQuery = input.value; draw(); });
  draw();
}

/* ═══════════════ SETTINGS ═══════════════ */
const SETTINGS_SECTIONS = [
  { id:'profile',         label:'Profile' },
  { id:'personalization', label:'Personalization' },
  { id:'achievements',    label:'Achievements' },
  { id:'devices',         label:'Devices & connections' },
  { id:'system',          label:'System' }
];
let settingsSection = 'profile';

const ACCENTS = ['#4ade4a', '#2a7de1', '#d13aa0', '#e8860f', '#8b5cf6', '#e8403a', '#14b8a6', '#f4f4f5'];

function srow({ name, desc, value, control, onActivate }){
  const btn = el('button', 'srow');
  btn.dataset.nav = '';
  const text = el('div', 'srow-text');
  text.append(el('div', 'srow-name', escapeHtml(name)));
  if (desc) text.append(el('div', 'srow-desc', escapeHtml(desc)));
  btn.append(text);
  if (control) btn.append(control);
  else if (value != null) btn.append(el('div', 'srow-value', escapeHtml(value)));
  btn._navActivate = () => onActivate?.(btn);
  return btn;
}

function toggleControl(on){
  return el('div', 'toggle' + (on ? ' on' : ''));
}

function renderSettings(root, opts = {}){
  if (opts.section) settingsSection = opts.section;
  root.innerHTML = '';

  const wrap = el('div', 'settings-wrap');
  const nav = el('div', 'settings-nav');
  SETTINGS_SECTIONS.forEach(sec => {
    const btn = el('button', 'snav' + (sec.id === settingsSection ? ' active' : ''), escapeHtml(sec.label));
    btn.dataset.nav = '';
    btn._navActivate = () => { settingsSection = sec.id; renderSettings(root); window.Nav.focusFirst('.snav.active'); };
    nav.append(btn);
  });

  const body = el('div', 'settings-body');
  const S = window.State, set = S.settings;

  if (settingsSection === 'profile'){
    body.append(el('h2', 'page-title', 'Profile'));
    body.append(srow({
      name:'Gamertag', desc:'The name other players see', value:S.data.gamertag,
      onActivate: () => window.App.promptGamertag()
    }));
    body.append(srow({
      name:'Avatar', desc:'Generate a new profile mark', value:'Shuffle',
      onActivate: () => { S.rerollAvatar(); window.App.syncProfile(); }
    }));
    body.append(srow({ name:'Gamerscore', desc:'Earned across this console', value:String(S.gamerscore) }));
    body.append(srow({ name:'Games played', desc:'Distinct titles launched', value:String(S.playedCount()) }));
    body.append(srow({
      name:'Membership', desc:'Ultimate — every title in the catalogue',
      value:S.data.tier
    }));
  }

  if (settingsSection === 'personalization'){
    body.append(el('h2', 'page-title', 'Personalization'));

    const swatches = el('div', 'swatches');
    ACCENTS.forEach(hex => {
      const s = el('button', 'swatch' + (set.accent === hex ? ' on' : ''));
      s.dataset.nav = '';
      s.dataset.ringShape = 'circle';
      s.style.background = hex;
      s.setAttribute('aria-label', `Accent ${hex}`);
      s._navActivate = () => {
        S.setSetting('accent', hex);
        document.documentElement.style.setProperty('--accent', hex);
        S.unlock('theme');
        renderSettings(root);
        window.Nav.focusFirst('.swatch.on');
      };
      swatches.append(s);
    });
    const accentRow = el('div', 'srow');
    accentRow.append(el('div', 'srow-text',
      '<div class="srow-name">Accent colour</div><div class="srow-desc">Tints focus and highlights</div>'), swatches);
    body.append(accentRow);

    body.append(srow({
      name:'Theme', desc:'Light or dark system chrome', value: set.theme === 'dark' ? 'Dark' : 'Light',
      onActivate: () => {
        const next = set.theme === 'dark' ? 'light' : 'dark';
        S.setSetting('theme', next);
        document.body.dataset.theme = next;
        renderSettings(root); window.Nav.focusFirst();
      }
    }));
    body.append(srow({
      name:'Background', desc:'Use game art behind the dashboard',
      control: toggleControl(set.background === 'dynamic'),
      onActivate: () => {
        const next = set.background === 'dynamic' ? 'plain' : 'dynamic';
        S.setSetting('background', next);
        document.body.dataset.bg = next;
        renderSettings(root); window.Nav.focusFirst();
      }
    }));
    body.append(srow({
      name:'Title details on home', desc:'Show the focused game above the tiles',
      control: toggleControl(set.heroText !== false),
      onActivate: () => { S.setSetting('heroText', set.heroText === false); renderSettings(root); window.Nav.focusFirst(); }
    }));
    body.append(srow({
      name:'Navigation sounds', desc:'Audio feedback while moving around',
      control: toggleControl(set.sounds),
      onActivate: () => { S.setSetting('sounds', !set.sounds); renderSettings(root); window.Nav.focusFirst(); }
    }));
    body.append(srow({
      name:'Reduce motion', desc:'Shorten animations across the console',
      control: toggleControl(set.motion === 'reduced'),
      onActivate: () => {
        const next = set.motion === 'reduced' ? 'full' : 'reduced';
        S.setSetting('motion', next);
        document.documentElement.dataset.motion = next;
        renderSettings(root); window.Nav.focusFirst();
      }
    }));
    body.append(srow({
      name:'CRT overlay', desc:'A faint scanline pass over everything',
      control: toggleControl(set.scanline),
      onActivate: () => {
        S.setSetting('scanline', !set.scanline);
        $('#scanline').hidden = !set.scanline;
        renderSettings(root); window.Nav.focusFirst();
      }
    }));
    body.append(srow({
      name:'24-hour clock', desc:'Show the system clock in 24-hour time',
      control: toggleControl(set.clock24),
      onActivate: () => { S.setSetting('clock24', !set.clock24); window.App.tickClock(); renderSettings(root); window.Nav.focusFirst(); }
    }));
  }

  if (settingsSection === 'achievements'){
    const unlocked = S.unlockedCount(), total = S.ACHIEVEMENTS.length;
    body.append(el('h2', 'page-title', 'Achievements'));
    body.append(el('p', 'page-sub', `${unlocked} of ${total} unlocked · ${S.gamerscore} Gamerscore`));
    const list = el('div', 'ach-list');
    list.style.marginTop = '2rem';
    S.ACHIEVEMENTS.forEach(a => {
      const done = S.isUnlocked(a.id);
      const row = el('div', `ach ${done ? 'unlocked' : 'locked'}`);
      row.append(el('div', 'ach-badge', ICON.trophy));
      row.append(el('div', null,
        `<div class="ach-name">${escapeHtml(a.name)}</div>
         <div class="ach-desc">${escapeHtml(done ? a.desc : 'Locked · ' + a.desc)}</div>`));
      row.append(el('div', 'ach-score', String(a.score)));
      list.append(row);
    });
    body.append(list);
  }

  if (settingsSection === 'devices'){
    body.append(el('h2', 'page-title', 'Devices &amp; connections'));
    const pads = (navigator.getGamepads?.() || []).filter(Boolean);
    body.append(srow({
      name:'Controller', desc: pads.length ? pads[0].id : 'Connect a controller and press a button',
      value: pads.length ? 'Connected' : 'Not detected'
    }));
    body.append(srow({
      name:'Microphone', desc:'Mute state shown in the system bar',
      control: toggleControl(!set.micMuted),
      onActivate: () => {
        S.setSetting('micMuted', !set.micMuted);
        document.body.dataset.mic = set.micMuted ? 'muted' : 'live';
        renderSettings(root); window.Nav.focusFirst();
      }
    }));
    body.append(srow({ name:'Display', desc:'Rendering resolution follows the browser window',
      value:`${window.innerWidth}×${window.innerHeight}` }));
    body.append(srow({ name:'Input map', desc:'D-pad or left stick moves, A selects, B backs out, Guide opens the overlay',
      value:'Standard' }));
  }

  if (settingsSection === 'system'){
    body.append(el('h2', 'page-title', 'System'));
    body.append(srow({ name:'Catalogue source', desc: window.Catalog.state.source || 'unknown',
      value:`${window.Catalog.count()} titles` }));
    body.append(srow({ name:'Storage', desc:'Profile, pins and achievements are stored in this browser',
      value:'Local' }));
    body.append(srow({
      name:'Restart console', desc:'Replay the boot sequence',
      value:'Restart', onActivate: () => location.reload()
    }));
    body.append(srow({
      name:'Reset profile', desc:'Clears gamerscore, pins, recents and settings',
      value:'Reset',
      onActivate: () => window.App.confirmReset()
    }));
    body.append(srow({ name:'About', desc:'A dashboard replica built for the browser', value:'v1.0' }));
  }

  wrap.append(nav, body);
  root.append(wrap);
}

window.Views = {
  ICON, coverArt, tile, gridItem, escapeHtml, el,
  renderHome, renderLibrary, renderPass, renderSearch, renderSettings,
  updateHero
};
})();
