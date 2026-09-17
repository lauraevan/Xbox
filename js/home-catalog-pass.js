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
  'minecraft':'assets/game-art/minecraft-cover-user.jpg',
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

  const badge = document.createElement('span');
  badge.className = 'home-catalog-owned';
  badge.textContent = 'OWNED';

  art.append(fallback, img, badge);

  const name = document.createElement('span');
  name.className = 'home-catalog-name';
  name.textContent = game.name;

  const action = document.createElement('span');
  action.className = 'home-catalog-action';
  action.textContent = owned ? 'In My games & apps' : 'Add to My games & apps';

  btn.append(art, name, action);

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

  drawer.append(head, body);
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

    const grid = document.createElement('div');
    grid.className = 'home-catalog-grid';
    rows.forEach(game => grid.append(cardFor(game)));
    body.append(grid);

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
  const card = event.target.closest?.('#view-home .home-catalog-game');
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