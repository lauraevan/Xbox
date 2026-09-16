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

/* ───────── icon set ─────────
   Fluent UI System Icons (MIT, Microsoft) via js/icons.js. Named here by
   role so call sites read as intent rather than as glyph names. */
const ICON = new Proxy({
  play:'play', pin:'pin', plus:'add', grid:'grid', brush:'paint_brush',
  pad:'games', trophy:'trophy', person:'person', party:'people',
  bell:'alert', capture:'screenshot', power:'power', gear:'settings',
  home:'home', search:'search', store:'shopping_bag', clock:'clock',
  back:'arrow_left', link:'link', chevron:'chevron_right',
  library:'library', apps:'apps_list', mic:'mic', micOff:'mic_off'
}, {
  get: (map, key) => (key in map ? window.Icons.icon(map[key]) : '')
});

/* ───────── cover art with graceful degradation ─────────
   Loading goes through js/media.js, which walks a chain of mirrors on a
   bounded queue and retries. Until it lands (or if it never does) the
   tile shows a deterministic coloured plate rather than a grey hole. */
function coverArt(game, opts = {}){
  const wrap = el('span', 'tile-art');

  const hue = window.Media.placeholderHue(game.id + game.name);
  const plate = el('span', 'cover-plate');
  plate.style.setProperty('--h', hue);
  plate.append(el('span', 'cover-initials', escapeHtml(initials(game.name))));

  const img = el('img', 'cover');
  img.alt = '';
  img.decoding = 'async';

  wrap.append(plate, img);

  const cancel = window.Media.loadCover(game.coverFile, img, {
    priority: opts.priority,
    onFail: () => { img.remove(); wrap.classList.add('art-missing'); }
  });
  wrap._cancelCover = cancel;
  return wrap;
}

/** One or two letters, skipping articles and punctuation. */
function initials(name){
  const words = String(name)
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(w => w && !/^(the|a|an|of|and)$/i.test(w));
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* ───────── tiles ───────── */
function tile(game, kind = 'sm'){
  const btn = el('button', `tile tile-${kind}`);
  btn.dataset.nav = '';
  btn.dataset.gameId = game.id;
  btn.setAttribute('aria-label', game.name);

  // the art lives in a fixed square; the label is a bar beneath it that
  // only opens on selection, so the row keeps a common top edge
  const face = el('span', 'tile-face');
  face.append(coverArt(game, { priority: kind === 'hero' }));
  if (game.tag && window.State.settings.tileBadges)
    face.append(el('span', `tile-badge ${game.tag.cls}`, game.tag.badge));
  if (window.State.isPinned(game.id))
    face.append(el('span', 'tile-pin', ICON.pin));

  btn.append(face, el('span', 'tile-label', escapeHtml(game.name)));
  btn._navActivate = () => window.App.openDetail(game);
  return btn;
}

/** A plain tile that carries a glyph rather than cover art. */
function glyphTile(cls, label, glyph, onActivate){
  const btn = el('button', `tile ${cls}`);
  btn.dataset.nav = '';
  btn.setAttribute('aria-label', label);
  const face = el('span', 'tile-face');
  face.innerHTML = glyph;
  btn.append(face, el('span', 'tile-label', escapeHtml(label)));
  btn._navActivate = onActivate;
  return btn;
}

function gridItem(game){
  const btn = el('button', 'grid-item');
  btn.dataset.nav = '';
  btn.dataset.gameId = game.id;
  btn.setAttribute('aria-label', game.name);
  btn.append(coverArt(game, { priority: kind === 'hero' }));
  if (game.tag && window.State.settings.tileBadges)
    btn.append(el('span', `tile-badge ${game.tag.cls}`, game.tag.badge));
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

  strip.append(
    glyphTile('tile-people', 'Friends & clubs', ICON.party,
      () => window.App.toast('Titles available',
        `${window.Catalog.count().toLocaleString()} in your catalogue`, { icon: ICON.party })),
    glyphTile('tile-add', 'See all games', ICON.plus,
      () => window.App.setView('library'))
  );

  rail.append(strip);
  root.append(rail);
  [...strip.children].forEach((n, i) => n.style.setProperty('--i', i));

  /* ── spotlight cards ── */
  const cards = el('div', 'cards');
  const mosaic = window.Catalog.seededShuffle(window.Catalog.all(), 13).slice(0, 4);

  const promo = window.Catalog.seededShuffle(window.Catalog.featured(), 47);
  cards.append(
    makeCard({
      label: 'Browse the store',
      cls: 'card-store',
      illus: ICON.store,
      onActivate: () => window.App.setView('pass')
    }),
    makeCard({
      label: promo[0]?.name || 'Game Pass',
      sub: 'Add to Play Later',
      art: promo[0]?.coverFile,
      chip: 'GAME PASS',
      grad: 'grad-b',
      onActivate: () => promo[0] ? window.App.openDetail(promo[0]) : window.App.setView('pass')
    }),
    makeCard({
      label: promo[1]?.name || 'Recently added',
      sub: 'Available now',
      art: promo[1]?.coverFile,
      grad: 'grad-d',
      onActivate: () => promo[1] ? window.App.openDetail(promo[1]) : window.App.setView('pass')
    }),
    makeCard({
      label: 'Browse your games',
      sub: `${window.Catalog.count().toLocaleString()} titles`,
      mosaic,
      onActivate: () => window.App.setView('library')
    })
  );
  root.append(cards);
  [...cards.children].forEach((n, i) => n.style.setProperty('--i', i + 4));

  updateHero(headline);
}

function makeCard({ label, sub, mosaic, art, artAlt, chip, grad, illus, cls, onActivate }){
  const btn = el('button', 'card');
  btn.dataset.nav = '';
  btn.setAttribute('aria-label', label);

  if (grad) btn.classList.add(grad);
  if (cls) btn.classList.add(cls);

  if (mosaic){
    const m = el('div', 'card-mosaic');
    mosaic.forEach(g => {
      const cell = el('div');
      cell.style.setProperty('--h', window.Media.placeholderHue(g.id + g.name));
      cell.classList.add('mosaic-cell');
      const img = el('img', 'cover');
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      window.Media.loadCover(g.coverFile, img, { priority:true, onFail: () => img.remove() });
      cell.append(img);
      m.append(cell);
    });
    btn.append(m);
  } else if (art){
    const wrap = el('div', 'card-art');
    // one blurred layer to fill the card, one sharp layer anchored right
    const fill  = el('img', 'cover fill');
    const sharp = el('img', 'cover sharp');
    fill.alt = sharp.alt = '';
    window.Media.resolveCover(art, url => {
      fill.src = sharp.src = url;
      fill.classList.add('loaded');
      sharp.classList.add('loaded');
    }, () => wrap.remove());
    wrap.append(fill, sharp);
    btn.append(wrap);
  } else if (illus){
    btn.append(el('div', 'card-illus', illus));
  }

  btn.append(el('div', 'card-scrim'));
  if (chip) btn.append(el('div', 'card-chip', escapeHtml(chip)));
  btn.append(el('div', 'card-label',
    escapeHtml(label) + (sub ? `<span class="sub">${escapeHtml(sub)}</span>` : '')));
  btn._navActivate = onActivate;
  return btn;
}

function updateHero(game){
  const hero = $('.hero');
  if (!hero) return;
  if (!game || !window.State.settings.heroText){ hero.classList.remove('show'); return; }
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
  const img = el('img', 'cover');
  img.alt = '';
  window.Media.loadCover(spotlight.coverFile, img, { onFail: () => art.remove() });
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
  { id:'profile',         label:'Profile & accounts' },
  { id:'personalization', label:'Personalization' },
  { id:'accessibility',   label:'Accessibility' },
  { id:'display',         label:'Display & sound' },
  { id:'devices',         label:'Devices & controller' },
  { id:'network',         label:'Network' },
  { id:'captures',        label:'Captures' },
  { id:'storage',         label:'Storage' },
  { id:'family',          label:'Family settings' },
  { id:'achievements',    label:'Achievements' },
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

/** A row that steps through a fixed list of options on each press. */
function choiceRow({ name, desc, options, value, onPick }){
  const current = options.findIndex(o => o.value === value);
  const label = options[current]?.label ?? String(value);
  return srow({
    name, desc, value: label,
    onActivate: () => onPick(options[(current + 1) % options.length].value)
  });
}

const refresh = root => { renderSettings(root); window.Nav.focusFirst('.srow'); };

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

    body.append(el('div', 'section-label', 'Accounts on this console'));
    S.profiles().forEach(pr => {
      const row = srow({
        name: pr.gamertag,
        desc: pr.active ? 'Signed in' : `${(pr.gamerscore||0).toLocaleString()} Gamerscore`,
        value: pr.active ? 'Active' : 'Switch',
        onActivate: () => {
          if (pr.active) return;
          S.switchProfile(pr.profileId);
          window.App.syncProfile();
          window.App.toast('Signed in', pr.gamertag, { icon: ICON.person });
          window.App.setView('home');
        }
      });
      const badge = el('span', 'avatar');
      badge.style.cssText = 'width:4rem;height:4rem;flex:none';
      const img = el('img'); img.alt = '';
      img.src = pr.active ? S.avatar() : avatarFor(pr.avatarSeed);
      badge.append(img);
      row.insertBefore(badge, row.firstChild);
      body.append(row);
    });

    body.append(srow({
      name:'Add a profile', desc:'Each keeps its own pins, recents and Gamerscore',
      value:'Add',
      onActivate: () => window.App.promptNewProfile()
    }));
    if (S.profiles().length > 1){
      body.append(srow({
        name:'Remove a profile', desc:'Signed-out profiles only',
        value:'Manage',
        onActivate: () => window.App.manageProfiles()
      }));
    }
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
      control: toggleControl(set.heroText === true),
      onActivate: () => { S.setSetting('heroText', !set.heroText); renderSettings(root); window.Nav.focusFirst(); }
    }));
    const art = window.Artwork;
    const stats = art.stats();
    body.append(srow({
      name:'Widescreen artwork',
      desc: `${art.usingDefault ? 'Project key' : 'Your key'} \u00b7 `
          + `${stats.found} of ${stats.looked} titles matched so far`,
      value: art.usingDefault ? 'Use my own' : 'Connected',
      onActivate: () => window.App.promptArtworkKey()
    }));
    if (art.enabled){
      body.append(srow({
        name:'Clear artwork cache', desc:'Forget which titles matched and look again',
        value:'Clear',
        onActivate: () => { art.clearCache(); window.App.toast('Artwork cache cleared');
                            renderSettings(root); window.Nav.focusFirst(); }
      }));
    }
    body.append(srow({
      name:'Tag badges on tiles', desc:'Mark ports, Flash titles and emulators',
      control: toggleControl(set.tileBadges === true),
      onActivate: () => {
        S.setSetting('tileBadges', !set.tileBadges);
        renderSettings(root); window.Nav.focusFirst();
      }
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
    body.append(el('div', 'section-label', 'Button mapping'));
    body.append(el('p', 'page-sub', 'Swap the face buttons if your controller is laid out differently.'));
    body.append(choiceRow({
      name:'Face buttons', desc:'How A and B are read',
      value: set.buttonMap.a,
      options:[{value:'a',label:'Standard (A selects)'},{value:'b',label:'Swapped (B selects)'}],
      onPick: v => {
        S.setSetting('buttonMap', v === 'b' ? { a:'b', b:'a', x:'x', y:'y' }
                                            : { a:'a', b:'b', x:'x', y:'y' });
        refresh(root);
      }
    }));
    body.append(choiceRow({
      name:'Stick sensitivity', desc:'How far the stick travels before it registers',
      value:set.stickDeadzone,
      options:[{value:35,label:'High'},{value:55,label:'Standard'},{value:75,label:'Low'}],
      onPick: v => { S.setSetting('stickDeadzone', v); refresh(root); }
    }));
    body.append(srow({
      name:'Vibration', desc:'Rumble on selection, where the pad supports it',
      control: toggleControl(set.vibration),
      onActivate: () => { S.setSetting('vibration', !set.vibration); refresh(root); }
    }));
    body.append(srow({
      name:'Test vibration', desc:'Fires a short pulse on a connected pad',
      value:'Test', onActivate: () => window.App.testRumble()
    }));
    body.append(srow({ name:'Input map',
      desc:'D-pad or left stick moves, A selects, B backs out, Guide opens the overlay',
      value:'Standard' }));
  }

  if (settingsSection === 'accessibility'){
    body.append(el('h2', 'page-title', 'Accessibility'));
    body.append(el('p', 'page-sub',
      'These apply across the whole console, including inside the guide.'));

    body.append(choiceRow({
      name:'Text size', desc:'Scales every element, not just the type',
      value:set.textScale,
      options:[{value:1,label:'Default'},{value:1.15,label:'Large'},
               {value:1.3,label:'Larger'},{value:.85,label:'Small'}],
      onPick: v => { S.setSetting('textScale', v);
                     document.documentElement.style.setProperty('--text-scale', v);
                     refresh(root); }
    }));
    body.append(choiceRow({
      name:'Colour filter', desc:'Correction for colour vision deficiency',
      value:set.colorFilter,
      options:[{value:'none',label:'Off'},{value:'protanopia',label:'Protanopia'},
               {value:'deuteranopia',label:'Deuteranopia'},{value:'tritanopia',label:'Tritanopia'},
               {value:'mono',label:'Monochrome'}],
      onPick: v => { S.setSetting('colorFilter', v);
                     document.body.dataset.cvd = v; refresh(root); }
    }));
    body.append(srow({
      name:'High contrast', desc:'Solid surfaces, hard edges, no background art',
      control: toggleControl(set.highContrast),
      onActivate: () => { S.setSetting('highContrast', !set.highContrast);
                          document.body.dataset.contrast = set.highContrast ? 'high' : 'normal';
                          refresh(root); }
    }));
    body.append(srow({
      name:'Reduce transparency', desc:'Drops blur and translucency behind panels',
      control: toggleControl(set.reduceTransparency),
      onActivate: () => { S.setSetting('reduceTransparency', !set.reduceTransparency);
                          document.body.dataset.transparency = set.reduceTransparency ? 'reduced' : 'normal';
                          refresh(root); }
    }));
    body.append(srow({
      name:'Reduce motion', desc:'Shortens every animation and skips the boot clip',
      control: toggleControl(set.motion === 'reduced'),
      onActivate: () => { const next = set.motion === 'reduced' ? 'full' : 'reduced';
                          S.setSetting('motion', next);
                          document.documentElement.dataset.motion = next; refresh(root); }
    }));
  }

  if (settingsSection === 'display'){
    body.append(el('h2', 'page-title', 'Display &amp; sound'));

    body.append(srow({
      name:'Night mode', desc:'Warms the picture to cut blue light',
      control: toggleControl(set.nightMode),
      onActivate: () => { S.setSetting('nightMode', !set.nightMode);
                          window.App.applyNightMode(); refresh(root); }
    }));
    body.append(choiceRow({
      name:'Night mode strength', desc:'How warm the veil goes',
      value:set.nightStrength,
      options:[{value:25,label:'Light'},{value:45,label:'Medium'},
               {value:65,label:'Strong'},{value:85,label:'Maximum'}],
      onPick: v => { S.setSetting('nightStrength', v); window.App.applyNightMode(); refresh(root); }
    }));
    body.append(srow({
      name:'Night mode schedule', desc:`Automatic between ${set.nightFrom} and ${set.nightTo}`,
      control: toggleControl(set.nightAuto),
      onActivate: () => { S.setSetting('nightAuto', !set.nightAuto);
                          window.App.applyNightMode(); refresh(root); }
    }));
    body.append(choiceRow({
      name:'Safe area', desc:'Pull the picture in on a panel that overscans',
      value:set.safeArea,
      options:[{value:0,label:'Off'},{value:1,label:'1%'},{value:2,label:'2%'},{value:3,label:'3%'}],
      onPick: v => { S.setSetting('safeArea', v);
                     document.documentElement.style.setProperty('--overscan', v); refresh(root); }
    }));
    body.append(choiceRow({
      name:'Volume', desc:'Level for navigation sounds',
      value:set.volume,
      options:[{value:0,label:'Muted'},{value:35,label:'Low'},
               {value:70,label:'Medium'},{value:100,label:'High'}],
      onPick: v => { S.setSetting('volume', v); window.Sound?.setVolume(v);
                     window.Sound?.select(); refresh(root); }
    }));
    body.append(srow({
      name:'Theme', desc:'Light or dark system chrome',
      value:set.theme === 'dark' ? 'Dark' : 'Light',
      onActivate: () => { const next = set.theme === 'dark' ? 'light' : 'dark';
                          S.setSetting('theme', next); document.body.dataset.theme = next; refresh(root); }
    }));
  }

  if (settingsSection === 'network'){
    body.append(el('h2', 'page-title', 'Network'));
    const info = window.Features.Network.info();
    body.append(srow({ name:'Status', desc:'Browser connection state',
      value: info.online ? 'Online' : 'Offline' }));
    body.append(srow({ name:'Connection', desc:`Round trip ${info.rtt} · ${info.downlink}`,
      value: info.type }));
    body.append(srow({ name:'Data saver', desc:'Skips the boot clip and shrinks images',
      value: info.saveData ? 'On' : 'Off' }));

    body.append(el('div', 'section-label', 'Content mirrors'));
    body.append(el('p', 'page-sub',
      'Cover art and games are fetched from these in order. If art is missing, this says which are reachable.'));

    const results = el('div', 'ach-list');
    results.style.marginTop = '1.2rem';
    body.append(results);

    const run = srow({
      name:'Test connection', desc:'Checks every mirror and the catalogue manifest',
      value:'Start',
      onActivate: async () => {
        results.innerHTML = '';
        const draw = list => {
          results.innerHTML = '';
          list.forEach(r => {
            const row = el('div', `ach ${r.ok ? 'unlocked' : 'locked'}`);
            row.append(el('div', 'ach-badge', r.ok ? ICON.play : ICON.info));
            row.append(el('div', null,
              `<div class="ach-name">${escapeHtml(r.name)}</div>
               <div class="ach-desc">${r.ok ? 'Reachable' : 'No response'}</div>`));
            row.append(el('div', 'ach-score', `${r.ms} ms`));
            results.append(row);
          });
          window.Nav.repaint();
        };
        await window.Features.Network.test(draw);
        const man = await window.Features.Network.manifest();
        const row = el('div', `ach ${man.ok ? 'unlocked' : 'locked'}`);
        row.append(el('div', 'ach-badge', ICON.store));
        row.append(el('div', null,
          `<div class="ach-name">Catalogue manifest</div>
           <div class="ach-desc">${man.ok ? 'Loaded' : 'Failed'} · HTTP ${man.status}</div>`));
        row.append(el('div', 'ach-score', `${man.ms} ms`));
        results.append(row);
        window.Nav.repaint();
      }
    });
    body.insertBefore(run, results);
  }

  if (settingsSection === 'captures'){
    body.append(el('h2', 'page-title', 'Captures'));
    body.append(el('p', 'page-sub', 'Screenshots taken from the guide, stored on this device.'));

    const gallery = el('div', 'grid');
    gallery.style.marginTop = '1.6rem';
    body.append(srow({
      name:'Take a screenshot', desc:'Shares the tab, then saves the frame here',
      value:'Capture', onActivate: () => window.App.screenshot()
    }));
    body.append(gallery);

    window.Features.Captures.list().then(shots => {
      if (!shots.length){
        gallery.replaceWith(el('div', 'empty',
          `${ICON.capture}<div>No captures yet.</div>`));
        window.Nav.repaint();
        return;
      }
      shots.forEach(shot => {
        const item = el('button', 'grid-item');
        item.dataset.nav = '';
        item.setAttribute('aria-label', shot.title);
        const img = el('img', 'cover loaded');
        img.alt = ''; img.src = URL.createObjectURL(shot.blob);
        item.append(img, el('span', 'tile-label', new Date(shot.at).toLocaleString()));
        item._navActivate = () => window.App.captureActions(shot, () => refresh(root));
        gallery.append(item);
      });
      window.Nav.repaint();
    });
  }

  if (settingsSection === 'storage'){
    body.append(el('h2', 'page-title', 'Storage'));
    const list = el('div');
    body.append(list);
    window.Features.Storage.usage().then(u => {
      const F = window.Features.Storage.format;
      list.append(srow({ name:'Used on this device', desc:'Browser storage for this console',
        value: F(u.usage) }));
      list.append(srow({ name:'Available', desc:'Quota the browser grants',
        value: F(u.quota) }));
      list.append(srow({ name:'Profile data', desc:'Gamertag, pins, recents, achievements',
        value: F(u.local) }));
      list.append(srow({ name:'Captures', desc:'Screenshots in the gallery',
        value: F(u.captures) }));
      list.append(srow({ name:'Clear captures', desc:'Deletes every screenshot',
        value:'Clear',
        onActivate: () => window.App.modal({
          title:'Delete all captures?', text:'This cannot be undone.',
          actions:[{ label:'Delete', onSelect: async () => {
                       await window.Features.Captures.clear();
                       window.App.toast('Captures cleared'); refresh(root); } },
                   { label:'Cancel' }]
        })
      }));
      list.append(srow({ name:'Catalogue', desc:'Streamed on demand, nothing stored locally',
        value:`${window.Catalog.count()} titles` }));
      window.Nav.repaint();
    });
  }

  if (settingsSection === 'family'){
    body.append(el('h2', 'page-title', 'Family settings'));
    body.append(el('p', 'page-sub', 'Limits apply to this console and everyone using it.'));

    const used = window.Features.ScreenTime.minutes();
    const limit = set.screenTimeLimit;
    body.append(choiceRow({
      name:'Daily screen time', desc: limit
        ? `${used} of ${limit} minutes used today`
        : `${used} minutes played today`,
      value: limit,
      options:[{value:0,label:'No limit'},{value:30,label:'30 min'},
               {value:60,label:'1 hour'},{value:120,label:'2 hours'}],
      onPick: v => { S.setSetting('screenTimeLimit', v); refresh(root); }
    }));
    body.append(srow({
      name:'Reset today\u2019s timer', desc:'Sets the counter back to zero',
      value:'Reset',
      onActivate: () => { window.Features.ScreenTime.reset();
                          window.App.toast('Screen time reset'); refresh(root); }
    }));

    body.append(el('div', 'section-label', 'Content restrictions'));
    body.append(el('p', 'page-sub', 'Blocked categories are hidden everywhere and cannot be launched.'));
    [['flash','Flash titles'],['emulator','Emulators'],['port','Console ports'],
     ['fnf','Rhythm titles'],['tools','Apps & tools']].forEach(([tag, label]) => {
      body.append(srow({
        name: label, desc: set.blockedTags.includes(tag) ? 'Blocked' : 'Allowed',
        control: toggleControl(!set.blockedTags.includes(tag)),
        onActivate: () => { S.toggleBlockedTag(tag); refresh(root); }
      }));
    });
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

function avatarFor(seed){ return window.State.avatarFor(seed); }

window.Views = {
  ICON, coverArt, tile, gridItem, escapeHtml, el,
  renderHome, renderLibrary, renderPass, renderSearch, renderSettings,
  updateHero
};
})();
