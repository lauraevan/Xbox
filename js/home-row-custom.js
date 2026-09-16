/* Home recent-row correction.
   Replaces the requested titles and restores the older Xbox "My games & apps"
   collage tile: four installed/recent game covers in one square that opens the library. */
(() => {
'use strict';

const HOME = document.getElementById('view-home');
if (!HOME) return;

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
  'Grand Theft Auto V': ['grand theft auto v','gta v','gta 5','grand theft auto 5'],
  'Elden Ring': ['elden ring'],
  'Red Dead Redemption 2': ['red dead redemption 2','rdr2'],
  'Minecraft': ['minecraft']
};

const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function localGame(title){
  const names = [title, ...(CLOUD_ALIASES[title] || [])].map(norm);
  return window.Catalog?.all?.().find(game => names.includes(norm(game.name))) || null;
}

async function cloudGame(title){
  try {
    const list = await window.StratusCloud?.loadCatalogue?.();
    if (!Array.isArray(list)) return null;
    const names = [title, ...(CLOUD_ALIASES[title] || [])].map(norm);
    return list.find(game => names.includes(norm(game.name))) || null;
  } catch {
    return null;
  }
}

async function activateTitle(title){
  const local = localGame(title);
  if (local){
    window.App?.openDetail?.(local);
    return;
  }

  const cloud = await cloudGame(title);
  if (cloud){
    if (window.StratusCloud?.owns?.(cloud)){
      try { await window.StratusCloud.play(cloud); }
      catch (err){ window.App?.toast?.('Cloud gaming', err?.message || 'Could not start game.'); }
      return;
    }

    window.XboxStoreRoute?.show?.();
    // Store render starts asynchronously; openProduct can mount as soon as the
    // Store surface is visible because it already has the game object here.
    setTimeout(() => window.XboxStore?.openProduct?.(cloud), 80);
    return;
  }

  window.App?.setView?.('library');
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

  btn._navActivate = () => window.App?.setView?.('library');
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

patchHome();
})();