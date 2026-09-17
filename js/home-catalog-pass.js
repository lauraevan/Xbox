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
    <svg viewBox="0 0 1920 2160" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient id="waveA" x1="0" y1="0" x2="1" y2=".2">
          <stop offset="0" stop-color="#061a0b"/>
          <stop offset=".24" stop-color="#0a4f19"/>
          <stop offset=".5" stop-color="#107c10"/>
          <stop offset=".78" stop-color="#2ecb48"/>
          <stop offset="1" stop-color="#6ef05d"/>
        </linearGradient>
        <linearGradient id="waveB" x1="0" y1=".2" x2="1" y2=".8">
          <stop offset="0" stop-color="#031007"/>
          <stop offset=".4" stop-color="#0b5d1e"/>
          <stop offset=".72" stop-color="#19a537"/>
          <stop offset="1" stop-color="#44db53"/>
        </linearGradient>
        <linearGradient id="waveC" x1="0" y1="1" x2="1" y2=".1">
          <stop offset="0" stop-color="#020b05"/>
          <stop offset=".44" stop-color="#0b4516"/>
          <stop offset=".74" stop-color="#12852a"/>
          <stop offset="1" stop-color="#31c747"/>
        </linearGradient>
      </defs>
      <rect width="1920" height="2160" fill="#020704"/>

      <g class="wave-set wave-set-a">
        <g class="xwave xwave-back" opacity=".86">
          <path d="M-260 55 C150 230 370 390 675 428 C1005 470 1238 300 1510 175 C1730 74 1960 63 2200 134 L2200 320 C1930 252 1748 268 1555 355 C1260 489 1010 646 650 594 C318 547 98 389 -280 214 Z" fill="url(#waveC)"/>
        </g>
        <g class="xwave xwave-mid" opacity=".94">
          <path d="M-300 205 C78 362 340 500 678 518 C1014 537 1218 405 1497 295 C1732 202 1955 211 2200 300 L2200 485 C1950 394 1748 389 1544 469 C1244 585 1013 730 644 698 C313 669 58 520 -300 370 Z" fill="url(#waveB)"/>
        </g>
        <g class="xwave xwave-front">
          <path d="M-335 378 C40 492 286 630 642 652 C978 673 1190 556 1475 462 C1718 382 1944 410 2200 510 L2200 684 C1944 590 1738 575 1535 645 C1230 751 1014 852 636 822 C294 796 28 651 -350 527 Z" fill="url(#waveA)"/>
        </g>
        <g class="xwave xwave-highlight" opacity=".18">
          <path d="M-230 281 C112 410 368 539 678 555 C1009 573 1224 438 1495 340 C1737 252 1945 271 2182 347" fill="none" stroke="#9aff85" stroke-width="10" stroke-linecap="round"/>
        </g>
      </g>

      <g class="wave-set wave-set-b" transform="translate(0 925) scale(1 -1) translate(0 -925)" opacity=".88">
        <g class="xwave xwave-back">
          <path d="M-270 1200 C130 1378 365 1518 670 1555 C1000 1596 1248 1440 1515 1320 C1740 1218 1965 1228 2200 1300 L2200 1485 C1930 1418 1748 1435 1550 1520 C1256 1648 1010 1795 650 1747 C320 1702 92 1555 -286 1372 Z" fill="url(#waveC)"/>
        </g>
        <g class="xwave xwave-mid">
          <path d="M-300 1348 C78 1508 345 1642 680 1660 C1018 1678 1219 1551 1499 1442 C1735 1350 1952 1364 2200 1450 L2200 1635 C1951 1546 1746 1541 1540 1620 C1240 1736 1010 1873 642 1842 C312 1814 54 1670 -300 1518 Z" fill="url(#waveB)"/>
        </g>
        <g class="xwave xwave-front">
          <path d="M-345 1512 C24 1628 286 1764 642 1785 C978 1805 1190 1692 1476 1597 C1720 1516 1942 1545 2200 1646 L2200 1823 C1940 1728 1738 1712 1535 1785 C1230 1892 1013 1985 635 1957 C294 1932 20 1784 -352 1664 Z" fill="url(#waveA)"/>
        </g>
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