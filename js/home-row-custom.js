/* Home recent-row correction + direct launch / owned-library behavior. */
(() => {
'use strict';

const HOME = document.getElementById('view-home');
if (!HOME) return;

const Cloud = () => window.StratusCloud;

/* These are real files committed into this repo. Home no longer depends on
   SteamGridDB / remote hotlinks for the seven games in the main row. */
const COVER = {
  'Forza Horizon 5': 'assets/game-art/forza-horizon-5-cover.jpg',
  'Grand Theft Auto V': 'assets/game-art/gta-v-cover.jpg',
  'Hollow Knight: Silksong': 'assets/game-art/silksong-cover.png',
  'Elden Ring': 'assets/game-art/elden-ring-cover.jpg',
  'Red Dead Redemption 2': 'assets/game-art/rdr2-cover.jpg',
  'Minecraft': 'https://store-images.s-microsoft.com/image/apps.53095.13850085746326678.06e2dc5c-7997-46e9-a8e6-0e48b57cb13b.419e3c9d-9dd3-4a28-a9f3-a12350215871?h=1024&q=95&w=1024',
  'Fortnite': 'assets/game-art/fortnite-cover.jpg'
};

const HERO = {
  'Forza Horizon 5': 'assets/game-art/forza-horizon-5-hero.jpg',
  'Grand Theft Auto V': 'assets/game-art/gta-v-hero.jpg',
  'Hollow Knight: Silksong': 'assets/game-art/silksong-hero.jpg',
  'Elden Ring': 'assets/game-art/elden-ring-hero.jpg',
  'Red Dead Redemption 2': 'assets/game-art/rdr2-hero.jpg',
  'Minecraft': 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/NewKeyArt_Header.jpg',
  'Fortnite': 'assets/game-art/fortnite-hero.jpg'
};

const SWAPS = [
  { from:'Subnautica 2', to:'Grand Theft Auto V', badge:'X|S' },
  { from:'Microsoft Edge', to:'Elden Ring', badge:'X|S' },
  { from:'Mortal Kombat 1', to:'Red Dead Redemption 2', badge:'X|S' },
  { from:'Roblox', to:'Minecraft', badge:'X|S' }
];

const CLOUD_ALIASES = {
  'Forza Horizon 5': ['forza horizon 5'],
  'Grand Theft Auto V': ['grand theft auto v','gta v','gta 5','grand theft auto 5'],
  'Hollow Knight: Silksong': ['hollow knight silksong','silksong'],
  'Elden Ring': ['elden ring'],
  'Red Dead Redemption 2': ['red dead redemption 2','rdr2'],
  'Minecraft': ['minecraft'],
  'Fortnite': ['fortnite']
};

const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);

function canonicalTitle(value){
  const key = norm(value);
  return Object.keys(COVER).find(title => {
    if (norm(title) === key) return true;
    return (CLOUD_ALIASES[title] || []).some(alias => norm(alias) === key);
  }) || null;
}

/* Keep the global artwork API for the rest of the catalogue, but short-circuit
   these Home games to repo-local files so a failed API/CDN can never paint a
   question-mark placeholder over the dashboard. */
if (window.Artwork?.hero && !window.Artwork.__homeLocalArt){
  const originalHero = window.Artwork.hero.bind(window.Artwork);
  window.Artwork.hero = name => {
    const title = canonicalTitle(name);
    return title && HERO[title] ? Promise.resolve(HERO[title]) : originalHero(name);
  };
  window.Artwork.__homeLocalArt = true;
}

function localGame(title){
  const names = [title, ...(CLOUD_ALIASES[title] || [])].map(norm);
  return window.Catalog?.all?.().find(game => names.includes(norm(game.name))) || null;
}

async function cloudGame(title){
  try {
    const list = await Cloud()?.loadCatalogue?.();
    if (!Array.isArray(list)) return null;
    const names = [title, ...(CLOUD_ALIASES[title] || [])].map(norm);
    return list.find(game => names.includes(norm(game.name))) || null;
  } catch { return null; }
}

function launchLocal(game){
  if (!game) return false;
  window.App?.openDetail?.(game);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const play = document.querySelector('#detail .btn.primary');
    if (typeof play?._navActivate === 'function') play._navActivate(play);
  }));
  return true;
}

async function activateTitle(title){
  const cloud = await cloudGame(title);
  if (cloud){
    try {
      if (!Cloud()?.owns?.(cloud)){
        Cloud()?.acquire?.(cloud);
        window.App?.toast?.('Added to your library', cloud.name);
      }
      await Cloud()?.play?.(cloud);
      return;
    } catch (err){
      window.App?.toast?.('Cloud gaming', err?.message || 'Could not start game.');
      return;
    }
  }

  const local = localGame(title);
  if (launchLocal(local)) return;
  window.App?.toast?.('Game unavailable', `${title} is not currently available in the connected catalogue.`);
}

function ensureBadge(face, text){
  let badge = face.querySelector('.ref-platform');
  if (!text){ badge?.remove(); return; }
  if (!badge){
    badge = document.createElement('span');
    badge.className = 'ref-platform';
    face.append(badge);
  }
  badge.textContent = text;
}

function setTileArtwork(tile, title){
  const src = COVER[title];
  if (!src) return;
  const img = tile.querySelector('.ref-art img');
  if (!img) return;
  if (img.getAttribute('src') !== src) img.src = src;
  img.alt = '';
  img.loading = 'eager';
  img.decoding = 'async';
  img.classList.add('loaded');
  img.style.objectFit = 'cover';
}

function patchTile(def){
  const tile = HOME.querySelector(`.ref-tile[data-ref-title="${CSS.escape(def.from)}"]`);
  if (!tile || tile.dataset.homeSwap === def.to) return;
  tile.dataset.homeSwap = def.to;
  tile.dataset.refTitle = def.to;
  tile.setAttribute('aria-label', def.to);
  tile.classList.remove('edge-tile');

  const label = tile.querySelector('.tile-label');
  if (label) label.textContent = def.to;
  const face = tile.querySelector('.tile-face');
  setTileArtwork(tile, def.to);
  if (face) ensureBadge(face, def.badge);
  tile._navActivate = () => activateTitle(def.to);
}

function wireAllGameTiles(){
  HOME.querySelectorAll('.ref-tile[data-ref-title]').forEach(tile => {
    const title = canonicalTitle(tile.dataset.refTitle) || tile.dataset.refTitle;
    if (!title) return;

    setTileArtwork(tile, title);

    if (tile.dataset.homeDirectLaunch !== title){
      tile.dataset.homeDirectLaunch = title;
      tile._navActivate = () => activateTitle(title);
    }
  });
}

function ownedCard(game){
  const btn = document.createElement('button');
  btn.className = 'console-poster owned-only-card';
  btn.dataset.nav = '';
  btn.dataset.ownedStoreGame = game.gameKey;
  btn.dataset.ringRadius = '.55rem';
  btn.setAttribute('aria-label', game.name);

  const known = canonicalTitle(game.name);
  const cover = (known && COVER[known]) || game.cover || game.image || '';
  btn.innerHTML = `
    <span class="console-poster-art">
      <img src="${esc(cover)}" alt="" loading="lazy" decoding="async">
    </span>`;
  btn._navActivate = async () => {
    try { await Cloud()?.play?.(game); }
    catch (err){ window.App?.toast?.('Cloud gaming', err?.message || 'Could not start game.'); }
  };
  return btn;
}

async function openOwnedLibrary(){
  let owned = [];
  try { owned = await Cloud()?.ownedGames?.() || []; }
  catch (err){ window.App?.toast?.('My games & apps', err?.message || 'Could not load your library.'); }

  window.App?.setView?.('library');
  await Promise.resolve();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const root = document.getElementById('view-library');
  if (!root || root.hidden) return;
  root.innerHTML = '';
  root.classList.add('console-page-view', 'owned-only-library');
  root.dataset.storeOwnedLibrary = '1';

  const main = document.createElement('main');
  main.className = 'console-main owned-only-main';

  const header = document.createElement('header');
  header.className = 'console-page-head owned-only-head';
  header.innerHTML = '<h1>My games & apps</h1>';
  main.append(header);

  const row = document.createElement('section');
  row.className = 'console-poster-grid owned-only-row';
  row.setAttribute('aria-label', 'Owned games');
  owned.forEach(game => row.append(ownedCard(game)));
  main.append(row);

  root.append(main);

  window.Nav?.repaint?.();
  if (owned.length) window.Nav?.focusIn?.(root, '.console-poster');
}

function makeLibraryTile(){
  const btn = document.createElement('button');
  btn.className = 'tile ref-tile tile-sm ref-library-tile';
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '.58rem';
  btn.dataset.homeLibraryMosaic = '1';
  btn.setAttribute('aria-label', 'My games & apps');

  const face = document.createElement('span');
  face.className = 'tile-face';

  const mosaic = document.createElement('span');
  mosaic.className = 'ref-library-mosaic';
  ['Grand Theft Auto V','Elden Ring','Red Dead Redemption 2','Minecraft'].forEach(title => {
    const img = document.createElement('img');
    img.src = COVER[title];
    img.alt = '';
    img.loading = 'eager';
    img.decoding = 'async';
    mosaic.append(img);
  });

  const plus = document.createElement('span');
  plus.className = 'ref-library-plus';
  plus.setAttribute('aria-hidden','true');
  plus.innerHTML = '<span></span><span></span>';

  face.append(mosaic, plus);
  btn.append(face);

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = 'My games & apps';
  btn.append(label);
  btn._navActivate = openOwnedLibrary;
  return btn;
}

function ensureLibraryTile(){
  const strip = HOME.querySelector('.ref-strip');
  const friends = strip?.querySelector('.ref-friends');
  if (!strip || !friends || strip.querySelector('[data-home-library-mosaic="1"]')) return;
  friends.insertAdjacentElement('afterend', makeLibraryTile());
}

function pinInitialBackdrop(){
  if (document.body.dataset.view && document.body.dataset.view !== 'home') return;
  const layers = [...document.querySelectorAll('.backdrop-layer')];
  const active = layers.find(layer => layer.classList.contains('on'));
  if (!active || active.dataset.dynamicTitle) return;
  active.style.backgroundImage = `url("${HERO['Forza Horizon 5']}")`;
  active.style.backgroundPosition = 'center top';
}

function patchHome(){
  if (!HOME.querySelector('.ref-strip')) return;
  SWAPS.forEach(patchTile);
  wireAllGameTiles();
  ensureLibraryTile();
  pinInitialBackdrop();
}

let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    patchHome();
  });
}).observe(HOME, { childList:true, subtree:true });

document.addEventListener('click', event => {
  const tile = event.target.closest?.('#view-home .ref-tile[data-ref-title], #view-home [data-home-library-mosaic="1"]');
  if (tile && typeof tile._navActivate === 'function'){
    event.preventDefault();
    tile._navActivate(tile);
    return;
  }

  const owned = event.target.closest?.('#view-library [data-owned-store-game]');
  if (owned && typeof owned._navActivate === 'function'){
    event.preventDefault();
    owned._navActivate(owned);
  }
});

let homeFocusResizeTimer = null;
window.addEventListener('nav:focus', event => {
  const tile = event.detail?.el?.closest?.('#view-home .ref-tile');
  if (!tile) return;
  clearTimeout(homeFocusResizeTimer);
  requestAnimationFrame(() => window.Nav?.repaint?.());
  homeFocusResizeTimer = setTimeout(() => window.Nav?.repaint?.(), 190);
});

patchHome();
})();