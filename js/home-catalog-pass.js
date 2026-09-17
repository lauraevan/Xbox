/* Below-fold Home catalogue.
   The existing Home renderer is not replaced or resized. This pass only
   appends a catalogue exactly one viewport below it. */
(() => {
'use strict';

const HOME = document.getElementById('view-home');
const Cloud = window.StratusCloud;
if (!HOME || !Cloud) return;

const LOCAL_COVERS = {
  'forzahorizon5':'assets/game-art/forza-horizon-5-cover.jpg',
  'grandtheftautov':'assets/game-art/gta-v-cover.jpg',
  'gtav':'assets/game-art/gta-v-cover.jpg',
  'hollowknightsilksong':'assets/game-art/silksong-cover.png',
  'silksong':'assets/game-art/silksong-cover.png',
  'eldenring':'assets/game-art/elden-ring-cover.jpg',
  'reddeadredemption2':'assets/game-art/rdr2-cover.jpg',
  'rdr2':'assets/game-art/rdr2-cover.jpg',
  'minecraft':'assets/game-art/minecraft-cover-user.jpg?v=2',
  'fortnite':'assets/game-art/fortnite-cover.jpg'
};

const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);

let list = null;
let loading = null;
let armed = false;

function coverFor(game){
  return LOCAL_COVERS[norm(game?.name)] || game?.cover || game?.image || '';
}

function initials(name){
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0,2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

function cardFor(game){
  const btn = document.createElement('button');
  btn.className = 'home-catalog-game';
  if (norm(game?.name) === 'minecraft') btn.classList.add('minecraft');
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '.45rem';
  btn.dataset.homeCatalogKey = game.gameKey;
  btn.setAttribute('aria-label', `${game.name}, ${Cloud.owns(game) ? 'owned' : 'add to My games and apps'}`);

  const owned = Cloud.owns(game);
  if (owned) btn.classList.add('owned');

  const art = document.createElement('span');
  art.className = 'home-catalog-art';

  const fallback = document.createElement('span');
  fallback.className = 'home-catalog-fallback';
  fallback.textContent = initials(game.name);

  const img = document.createElement('img');
  img.src = coverFor(game);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => img.remove(), { once:true });

  const platform = document.createElement('span');
  platform.className = 'home-catalog-platform';
  platform.textContent = 'GAME PASS  X|S';

  const cloud = document.createElement('span');
  cloud.className = 'home-catalog-cloud';
  cloud.setAttribute('aria-hidden','true');
  cloud.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7.4 18.4a4.8 4.8 0 0 1-.7-9.55A6.35 6.35 0 0 1 18.9 10.8a3.8 3.8 0 0 1-.7 7.6H7.4Z"/></svg>';

  const badge = document.createElement('span');
  badge.className = 'home-catalog-owned';
  badge.textContent = 'OWNED';

  const name = document.createElement('span');
  name.className = 'home-catalog-name';
  name.textContent = game.name;

  const action = document.createElement('span');
  action.className = 'home-catalog-action';
  action.textContent = owned ? 'In My games & apps' : 'Add to My games & apps';

  art.append(fallback, img, platform, cloud, badge, name);
  btn.append(art, action);

  btn._navActivate = () => {
    if (Cloud.owns(game)){
      btn.classList.add('owned');
      action.textContent = 'In My games & apps';
      btn.setAttribute('aria-label', `${game.name}, owned`);
      window.App?.toast?.('Already in your library', game.name);
      return;
    }

    const added = Cloud.acquire(game);
    if (added){
      btn.classList.add('owned');
      action.textContent = 'In My games & apps';
      btn.setAttribute('aria-label', `${game.name}, owned`);
      window.Sound?.select?.();
      window.App?.toast?.('Added to My games & apps', game.name);
      window.CloudLibrary?.refresh?.();
    }
  };

  return btn;
}


function rowSection(titleText, games, extraClass=''){
  const section = document.createElement('section');
  section.className = 'home-catalog-row-section ' + extraClass;

  const title = document.createElement('h3');
  title.className = 'home-catalog-row-title';
  title.textContent = titleText;

  const rail = document.createElement('div');
  rail.className = 'home-catalog-row';
  games.filter(Boolean).forEach(game => rail.append(cardFor(game)));

  section.append(title, rail);
  return section;
}

function newGamesFeature(games){
  const section = document.createElement('section');
  section.className = 'home-new-games-section';

  const copy = document.createElement('div');
  copy.className = 'home-new-games-copy';
  const title = document.createElement('h3');
  title.textContent = 'New games';
  const more = document.createElement('button');
  more.className = 'home-catalog-more';
  more.dataset.nav = '';
  more.dataset.ringRadius = '.75rem';
  more.textContent = 'SHOW MORE';
  more._navActivate = () => document.querySelector('.sysnav-btn[data-view="store"]')?.click?.();
  copy.append(title, more);

  const rail = document.createElement('div');
  rail.className = 'home-new-games-rail';
  games.filter(Boolean).slice(0,4).forEach(game => rail.append(cardFor(game)));

  section.append(copy, rail);
  return section;
}

const APPS = [
  {
    name:'Netflix',
    cls:'netflix',
    logo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Netflix_2015_logo.svg'
  },
  {
    name:'Prime Video',
    cls:'prime',
    logo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Prime_Video_logo_(2024).svg'
  },
  {
    name:'YouTube',
    cls:'youtube',
    logo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/YouTube_Logo_2017.svg'
  },
  {
    name:'Nitrado',
    cls:'nitrado',
    logo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nitrado_yellow.png'
  },
  {
    name:'Media Gallery',
    cls:'gallery',
    localIcon:true
  },
  {
    name:'GPORTAL',
    cls:'gportal',
    logo:'https://www.g-portal.com/favicon.ico',
    wordmark:'GPORTAL'
  }
];

function essentialApps(){
  const section = document.createElement('section');
  section.className = 'home-apps-section';

  const title = document.createElement('h3');
  title.className = 'home-catalog-row-title';
  title.textContent = 'Essential apps';

  const row = document.createElement('div');
  row.className = 'home-apps-row';

  APPS.forEach(app => {
    const btn = document.createElement('button');
    btn.className = 'home-app-card app-' + app.cls;
    btn.dataset.nav = '';
    btn.dataset.ringRadius = '.7rem';
    btn.setAttribute('aria-label', app.name);

    if (app.logo){
      const img = document.createElement('img');
      img.className = 'home-app-logo';
      img.src = app.logo;
      img.alt = app.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.append(img);
    }

    if (app.localIcon){
      const mark = document.createElement('span');
      mark.className = 'home-app-gallery-mark';
      mark.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M11 17h42v31H11z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M18 41l10-11 7 7 6-6 9 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><circle cx="42" cy="26" r="4" fill="currentColor"/></svg>';
      btn.append(mark);
    }

    if (app.wordmark){
      const word = document.createElement('span');
      word.className = 'home-app-wordmark';
      word.textContent = app.wordmark;
      btn.append(word);
    }

    btn._navActivate = () => window.App?.toast?.('Essential app', app.name);
    row.append(btn);
  });

  section.append(title, row);
  return section;
}

function wavesMarkup(){
  const wrap = document.createElement('div');
  wrap.className = 'home-series-waves';
  wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML = `
    <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="waveA" x1="0" y1="0" x2="1" y2=".2">
          <stop offset="0" stop-color="#061a0b"/>
          <stop offset=".25" stop-color="#0a4f19"/>
          <stop offset=".52" stop-color="#107c10"/>
          <stop offset=".8" stop-color="#2ecb48"/>
          <stop offset="1" stop-color="#6ef05d"/>
        </linearGradient>
        <linearGradient id="waveB" x1="0" y1=".2" x2="1" y2=".8">
          <stop offset="0" stop-color="#031007"/>
          <stop offset=".42" stop-color="#0b5d1e"/>
          <stop offset=".74" stop-color="#19a537"/>
          <stop offset="1" stop-color="#44db53"/>
        </linearGradient>
        <linearGradient id="waveC" x1="0" y1="1" x2="1" y2=".1">
          <stop offset="0" stop-color="#020b05"/>
          <stop offset=".46" stop-color="#0b4516"/>
          <stop offset=".76" stop-color="#12852a"/>
          <stop offset="1" stop-color="#31c747"/>
        </linearGradient>
      </defs>

      <rect width="1920" height="1080" fill="#020704"/>

      <g class="xwave xwave-back" opacity=".88">
        <path d="M-250 55 C180 245 365 390 655 433 C990 483 1225 315 1490 180 C1710 68 1940 52 2195 112 L2195 290 C1928 235 1738 254 1546 354 C1256 505 1009 648 646 587 C323 533 107 371 -270 197 Z" fill="url(#waveC)"/>
      </g>

      <g class="xwave xwave-mid" opacity=".94">
        <path d="M-280 187 C100 360 347 500 671 522 C1017 546 1208 402 1477 288 C1717 186 1940 197 2195 279 L2195 469 C1943 379 1732 369 1538 450 C1243 573 1021 727 646 690 C326 658 62 507 -286 351 Z" fill="url(#waveB)"/>
      </g>

      <g class="xwave xwave-front">
        <path d="M-320 351 C40 481 290 634 632 654 C966 673 1186 548 1464 451 C1713 363 1938 389 2194 489 L2194 665 C1937 566 1735 554 1535 624 C1241 727 1020 845 645 817 C305 790 34 640 -336 513 Z" fill="url(#waveA)"/>
      </g>

      <g class="xwave xwave-highlight" opacity=".23">
        <path d="M-240 259 C111 406 357 549 672 565 C1010 581 1219 445 1484 338 C1719 243 1931 255 2174 335" fill="none" stroke="#8cff77" stroke-width="12" stroke-linecap="round"/>
        <path d="M-245 449 C95 573 332 703 640 719 C954 735 1197 619 1465 525 C1707 440 1937 461 2176 545" fill="none" stroke="#72ef68" stroke-width="8" stroke-linecap="round"/>
      </g>
    </svg>`;
  return wrap;
}

function shell(){
  const drawer = document.createElement('section');
  drawer.className = 'home-catalog-drawer';
  drawer.setAttribute('aria-label','Game catalogue');

  const head = document.createElement('div');
  head.className = 'home-catalog-head';
  head.innerHTML = `
    <div>
      <h2 class="home-catalog-title">Games</h2>
      <div class="home-catalog-sub">Choose a game to add it to My games & apps</div>
    </div>
    <div class="home-catalog-count"></div>`;

  const body = document.createElement('div');
  body.className = 'home-catalog-body';
  body.innerHTML = '<div class="home-catalog-loading">Loading games…</div>';

  drawer.append(wavesMarkup(), head, body);
  return drawer;
}

function ensureMounted(){
  if (!HOME.classList.contains('reference-home')) return;

  if (!HOME.querySelector('.home-catalog-spacer')){
    const spacer = document.createElement('div');
    spacer.className = 'home-catalog-spacer';
    spacer.setAttribute('aria-hidden','true');
    HOME.append(spacer);
  }

  if (!HOME.querySelector('.home-catalog-drawer')){
    HOME.append(shell());
  }

  if (!armed){
    armed = true;
    HOME.addEventListener('scroll', onHomeScroll, { passive:true });
  }
}

async function loadGames(){
  if (list) return list;
  if (loading) return loading;

  loading = (async () => {
    const rows = await Cloud.loadCatalogue();
    list = Array.isArray(rows) ? rows : [];
    return list;
  })().finally(() => { loading = null; });

  return loading;
}

async function renderCatalogue(){
  const drawer = HOME.querySelector('.home-catalog-drawer');
  if (!drawer || drawer.dataset.loaded === '1') return;

  drawer.dataset.loaded = '1';
  const body = drawer.querySelector('.home-catalog-body');
  const count = drawer.querySelector('.home-catalog-count');

  try {
    const rows = await loadGames();
    if (!drawer.isConnected) return;

    count.textContent = `${rows.length.toLocaleString()} games`;
    body.innerHTML = '';

    const recent = rows.slice(0,6);
    const paid = rows.slice(6,12).length ? rows.slice(6,12) : rows.slice(0,6);
    const newGames = rows.slice(12,16).length ? rows.slice(12,16) : rows.slice(0,4);
    const popular = rows.slice(16,22).length ? rows.slice(16,22) : rows.slice(0,6);

    body.append(
      rowSection('Recently added – Game Pass', recent, 'home-recent-row'),
      rowSection('Top paid games', paid, 'home-paid-row'),
      newGamesFeature(newGames),
      essentialApps(),
      rowSection('Popular with Game Pass', popular, 'home-popular-row')
    );

    window.Nav?.repaint?.();
  } catch (err){
    drawer.dataset.loaded = '0';
    body.innerHTML = `<div class="home-catalog-error">Could not load games: ${esc(err?.message || 'Unknown error')}</div>`;
  }
}

function onHomeScroll(){
  /* The catalogue remains entirely out of sight at scrollTop 0. The first
     intentional downward motion starts loading it. */
  if (HOME.scrollTop > 0) renderCatalogue();
  const waves = HOME.querySelector('.home-series-waves');
  if (waves) waves.style.setProperty('--wave-scroll', String(HOME.scrollTop));
}

function refreshOwnedState(game){
  const card = HOME.querySelector(`.home-catalog-game[data-home-catalog-key="${CSS.escape(String(game?.gameKey || ''))}"]`);
  if (!card) return;
  card.classList.add('owned');
  const action = card.querySelector('.home-catalog-action');
  if (action) action.textContent = 'In My games & apps';
}

window.addEventListener('stratus:library-change', event => {
  refreshOwnedState(event.detail?.game);
});

window.addEventListener('nav:focus', event => {
  const card = event.detail?.el?.closest?.('.home-catalog-game');
  if (!card) return;
  card.scrollIntoView({ block:'nearest', inline:'nearest', behavior:'smooth' });
});

document.addEventListener('click', event => {
  const card = event.target.closest?.('#view-home .home-catalog-game, #view-home .home-catalog-more, #view-home .home-app-card');
  if (!card || typeof card._navActivate !== 'function') return;
  event.preventDefault();
  card._navActivate(card);
});

/* Home can be repainted by the existing renderer. Re-attach only the
   below-fold pieces afterward and leave every original child untouched. */
let queued = false;
new MutationObserver(() => {
  if (queued || HOME.querySelector('.home-catalog-drawer')) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    ensureMounted();
  });
}).observe(HOME, { childList:true });

new MutationObserver(() => {
  if (!HOME.hidden){
    HOME.scrollTop = 0;
    ensureMounted();
  }
}).observe(HOME, { attributes:true, attributeFilter:['hidden'] });

ensureMounted();
})();