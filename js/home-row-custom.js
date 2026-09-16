/* Home recent-row correction + direct launch / owned-library behavior. */
(() => {
'use strict';

const HOME = document.getElementById('view-home');
if (!HOME) return;

const Cloud = () => window.StratusCloud;
const COVER = {
  'Grand Theft Auto V': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3240220/library_600x900.jpg',
  'Elden Ring': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg',
  'Red Dead Redemption 2': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1174180/library_600x900.jpg',
  'Minecraft': 'https://upload.wikimedia.org/wikipedia/en/b/b6/Minecraft_2024_cover_art.png'
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
  const img = tile.querySelector('.ref-art img');
  if (img){
    img.src = COVER[def.to];
    img.alt = '';
    img.classList.add('loaded');
    img.style.objectFit = 'cover';
  }
  if (face) ensureBadge(face, def.badge);
  tile._navActivate = () => activateTitle(def.to);
}

function wireAllGameTiles(){
  HOME.querySelectorAll('.ref-tile[data-ref-title]').forEach(tile => {
    const title = tile.dataset.refTitle;
    if (!title || tile.dataset.homeDirectLaunch === title) return;
    tile.dataset.homeDirectLaunch = title;
    tile._navActivate = () => activateTitle(title);
  });
}

function ownedCard(game){
  const btn = document.createElement('button');
  btn.className = 'console-poster';
  btn.dataset.nav = '';
  btn.dataset.ownedStoreGame = game.gameKey;
  btn.dataset.ringRadius = '.55rem';
  btn.setAttribute('aria-label', game.name);
  btn.innerHTML = `
    <span class="console-poster-art">
      <img src="${esc(game.cover || game.image)}" alt="" loading="lazy" decoding="async">
      <span class="console-cloud-pill"><span>☁</span><span>CLOUD</span></span>
    </span>
    <span class="console-poster-name">${esc(game.name)}</span>
    <span class="console-poster-meta">Owned • Ready to play</span>`;
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
  root.classList.add('console-page-view');
  root.dataset.storeOwnedLibrary = '1';

  const shell = document.createElement('div');
  shell.className = 'console-shell console-library';

  const side = document.createElement('aside');
  side.className = 'console-side';
  side.innerHTML = `
    <div class="console-side-brand">My games &amp; apps</div>
    <nav class="console-side-list">
      <button class="console-side-item active" data-nav><span class="console-side-icon">▦</span><span>Full library</span></button>
      <button class="console-side-item" data-nav data-owned-store-open><span class="console-side-icon">▣</span><span>Microsoft Store</span></button>
    </nav>`;

  const main = document.createElement('main');
  main.className = 'console-main';
  main.innerHTML = `
    <header class="console-page-head">
      <div><div class="console-page-kicker">XBOX</div><h1>Full library</h1><p>Games you got from Microsoft Store</p></div>
      <div class="console-head-actions"><span class="console-head-profile">xboxtest</span></div>
    </header>
    <div class="console-grid-head"><h2>${owned.length} owned game${owned.length === 1 ? '' : 's'}</h2><span>Ready to play</span></div>`;

  if (owned.length){
    const grid = document.createElement('section');
    grid.className = 'console-poster-grid';
    owned.forEach(game => grid.append(ownedCard(game)));
    main.append(grid);
  } else {
    const empty = document.createElement('div');
    empty.className = 'console-empty';
    empty.innerHTML = '<h2>Your library is empty</h2><p>Get a free cloud game from Microsoft Store and it will show up here.</p>';
    const browse = document.createElement('button');
    browse.className = 'btn primary';
    browse.dataset.nav = '';
    browse.textContent = 'BROWSE MICROSOFT STORE';
    browse._navActivate = () => window.App?.setView?.('store');
    empty.append(browse);
    main.append(empty);
  }

  shell.append(side, main);
  root.append(shell);

  const storeBtn = root.querySelector('[data-owned-store-open]');
  if (storeBtn) storeBtn._navActivate = () => window.App?.setView?.('store');
  window.Nav?.repaint?.();
  window.Nav?.focusIn?.(root, owned.length ? '.console-poster' : '.btn.primary');
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
  face.append(mosaic);
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

function patchHome(){
  if (!HOME.querySelector('.ref-strip')) return;
  SWAPS.forEach(patchTile);
  wireAllGameTiles();
  ensureLibraryTile();
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

  const owned = event.target.closest?.('#view-library [data-owned-store-game], #view-library [data-owned-store-open]');
  if (owned && typeof owned._navActivate === 'function'){
    event.preventDefault();
    owned._navActivate(owned);
  }
});

patchHome();
})();