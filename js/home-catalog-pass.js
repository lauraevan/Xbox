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
    <svg class="waves-svg" viewBox="0 0 1920 3240" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient id="wavesLime" x1="0" y1="0" x2="1" y2=".25">
          <stop offset="0" stop-color="#b6f13a"/>
          <stop offset=".28" stop-color="#8ad11e"/>
          <stop offset=".62" stop-color="#4aaa1d"/>
          <stop offset="1" stop-color="#1b6e16"/>
        </linearGradient>
        <linearGradient id="wavesGreen" x1="0" y1=".1" x2="1" y2=".8">
          <stop offset="0" stop-color="#4b9f1a"/>
          <stop offset=".36" stop-color="#187923"/>
          <stop offset=".74" stop-color="#086424"/>
          <stop offset="1" stop-color="#063f18"/>
        </linearGradient>
        <linearGradient id="wavesDeep" x1="0" y1="1" x2="1" y2=".1">
          <stop offset="0" stop-color="#163c12"/>
          <stop offset=".5" stop-color="#074b18"/>
          <stop offset="1" stop-color="#022810"/>
        </linearGradient>
        <linearGradient id="wavesShade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#102c0e"/>
          <stop offset="1" stop-color="#001e0b"/>
        </linearGradient>

        <g id="wavesScene">
          <rect width="1920" height="1080" fill="#001d07"/>

          <!-- cropped upper ribbon exactly like the Waves reference -->
          <g>
            <path d="M560 -145 C770 -35 1005 34 1275 46 C1510 56 1725 28 1950 -52 L1950 118 C1730 184 1505 205 1267 190 C990 173 744 97 520 -18 Z" fill="url(#wavesShade)" opacity=".92"/>
            <path d="M650 -132 C850 -35 1060 22 1284 31 C1497 40 1704 20 1930 -44 L1930 53 C1706 118 1500 139 1284 130 C1041 120 815 61 610 -39 Z" fill="url(#wavesGreen)" opacity=".9"/>
            <path d="M735 -115 C904 -36 1086 7 1288 14 C1482 20 1689 0 1912 -54 L1912 -2 C1689 57 1495 76 1292 69 C1077 61 882 18 700 -65 Z" fill="url(#wavesLime)" opacity=".72"/>
          </g>

          <!-- large rounded lower bend -->
          <g>
            <path d="M-180 470 C-112 700 -8 858 177 946 C360 1034 607 1023 828 968 C1050 913 1211 794 1370 676 C1495 583 1617 523 1768 510 C1862 502 1940 514 2010 542 L2010 874 C1892 826 1774 808 1648 824 C1473 845 1330 918 1178 1008 C1000 1113 803 1194 590 1218 C327 1248 96 1197 -78 1089 C-238 990 -338 842 -393 675 Z" fill="url(#wavesShade)" opacity=".95"/>
            <path d="M-150 520 C-80 716 30 850 212 925 C392 1000 616 986 827 931 C1048 873 1215 758 1375 646 C1507 553 1625 505 1763 493 C1868 484 1947 499 2018 531 L2018 777 C1905 735 1790 720 1666 735 C1494 756 1348 821 1196 904 C1018 1001 823 1073 611 1093 C351 1118 127 1075 -43 981 C-201 894 -298 764 -353 612 Z" fill="url(#wavesDeep)" opacity=".98"/>
            <path d="M-121 567 C-51 729 59 833 238 892 C414 950 625 930 828 875 C1048 816 1211 709 1380 606 C1517 522 1631 483 1758 474 C1870 466 1953 487 2025 524 L2025 691 C1910 654 1801 643 1682 657 C1513 677 1365 734 1216 807 C1041 892 846 953 638 969 C381 988 159 952 -7 874 C-163 801 -258 691 -315 567 Z" fill="url(#wavesGreen)"/>
            <path d="M-97 612 C-23 742 82 821 255 861 C424 901 631 878 828 826 C1042 769 1202 670 1387 573 C1525 501 1638 468 1756 461 C1872 454 1957 482 2030 526 L2030 614 C1914 583 1810 576 1698 591 C1532 612 1385 662 1234 728 C1060 804 866 858 661 869 C408 883 191 855 29 791 C-126 730 -219 641 -277 535 Z" fill="url(#wavesLime)" opacity=".95"/>
          </g>
        </g>
      </defs>

      <use class="waves-scene waves-scene-a" href="#wavesScene" y="0"/>
      <use class="waves-scene waves-scene-b" href="#wavesScene" y="1080"/>
      <use class="waves-scene waves-scene-c" href="#wavesScene" y="2160"/>
    </svg>
  `;
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