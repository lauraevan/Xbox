/* Home recent-row correction + direct launch / owned-library behavior. */
(() => {
'use strict';

const HOME = document.getElementById('view-home');
if (!HOME) return;

const Cloud = () => window.StratusCloud;
const SERIES_XS_BADGE = 'https://cms-assets.xboxservices.com/assets/fc/80/fc801b4c-fd95-4a10-8f03-da193e5792df.svg?n=Xbox-Series-X_Icons_768_Optimized_96x42_01.svg';

/* These are real files committed into this repo. Home no longer depends on
   SteamGridDB / remote hotlinks for the seven games in the main row. */
const COVER = {
  'Forza Horizon 5': 'assets/game-art/forza-horizon-5-cover.jpg',
  'Grand Theft Auto V': 'assets/game-art/gta-v-cover.jpg',
  'Hollow Knight: Silksong': 'assets/game-art/silksong-cover.png',
  'Elden Ring': 'assets/game-art/elden-ring-cover.jpg',
  'Red Dead Redemption 2': 'assets/game-art/rdr2-cover.jpg',
  'Minecraft': 'assets/game-art/minecraft-cover-boxart.jpg',
  'Fortnite': 'assets/game-art/fortnite-cover.jpg',
  'Cyberpunk 2077': 'https://store-images.s-microsoft.com/image/apps.47379.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.89bb995b-b066-4a53-9fe4-0260ce07e894?h=900&q=95&w=600'
};

const HERO = {
  'Forza Horizon 5': 'assets/game-art/forza-horizon-5-hero.jpg',
  'Grand Theft Auto V': 'assets/game-art/gta-v-hero.jpg',
  'Hollow Knight: Silksong': 'assets/game-art/silksong-hero.jpg',
  'Elden Ring': 'assets/game-art/elden-ring-hero.jpg',
  'Red Dead Redemption 2': 'assets/game-art/rdr2-hero.jpg',
  'Minecraft': 'assets/game-art/minecraft-hero-keyart.jpg',
  'Fortnite': 'assets/game-art/fortnite-hero.jpg',
  'Cyberpunk 2077': 'https://store-images.s-microsoft.com/image/apps.34838.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.1463028d-79fa-46e5-9fc2-63203992a4dc?h=1080&q=95&w=1920'
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
  'Fortnite': ['fortnite'],
  'Cyberpunk 2077': ['cyberpunk 2077','cyberpunk2077']
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

let preview = null;
let previewTitle = null;

function closeGamePreview(){
  if (!preview) return;
  const node = preview;
  preview = null;
  previewTitle = null;
  node.classList.add('out');
  setTimeout(() => node.remove(), 180);
  try { window.Nav?.popLayer?.(); } catch {}
  requestAnimationFrame(() => window.Nav?.repaint?.());
}

function previewFact(icon, label, value){
  const row = document.createElement('div');
  row.className = 'home-game-preview-fact';
  row.innerHTML = `
    <span class="home-game-preview-fact-icon">${icon || ''}</span>
    <span><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`;
  return row;
}

async function openGamePreview(title){
  closeGamePreview();
  window.Sound?.gameSelect?.();

  const [cloud, local] = await Promise.all([
    cloudGame(title),
    Promise.resolve(localGame(title))
  ]);

  const game = cloud || local || { name:title };
  const known = canonicalTitle(title) || title;
  const cover = COVER[known] || game.cover || game.image || '';
  const hero = HERO[known] || game.image || game.cover || cover;
  const tags = Array.isArray(game.tags) ? game.tags.filter(Boolean).slice(0, 4) : [];
  const provider = cloud ? 'Xbox Cloud' : (game.author || 'Xbox');
  const availability = cloud ? 'Cloud playable' : 'Ready to play';
  const descriptionText = String(
    game.description ||
    game.desc ||
    game.summary ||
    game.overview ||
    ''
  ).trim();
  const layer = document.createElement('section');
  layer.className = 'home-game-preview';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', `${title} game information`);

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'home-game-preview-scrim';
  scrim.setAttribute('aria-label', 'Close game information');
  scrim.addEventListener('click', closeGamePreview);

  const card = document.createElement('div');
  card.className = 'home-game-preview-card';

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'home-game-preview-share';
  share.dataset.nav = '';
  share.dataset.ringRadius = '.8rem';
  share.setAttribute('aria-label', `Share ${title}`);
  share.title = 'Share';
  share.innerHTML = window.Icons?.icon?.('share') || '';
  share._navActivate = async () => {
    const url = location.href;
    const text = descriptionText
      ? descriptionText.replace(/\s+/g, ' ').slice(0, 180)
      : `Check out ${title} on Xbox.`;
    try {
      if (navigator.share){
        await navigator.share({ title, text, url });
        return;
      }
      if (navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(url);
        window.App?.toast?.('Share link copied', title);
        return;
      }
      throw new Error('Share is not supported');
    } catch (err){
      if (err?.name === 'AbortError') return;
      window.App?.toast?.('Share unavailable', 'Could not open sharing on this device.');
    }
  };
  share.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    share._navActivate();
  });

  const visual = document.createElement('div');
  visual.className = 'home-game-preview-visual';
  visual.style.backgroundImage = hero ? `url("${hero}")` : '';
  visual.innerHTML = '<span class="home-game-preview-visual-shade"></span>';

  const coverWrap = document.createElement('div');
  coverWrap.className = 'home-game-preview-cover';
  if (cover){
    const img = document.createElement('img');
    img.src = cover;
    img.alt = '';
    img.decoding = 'async';
    coverWrap.append(img);
  }

  const info = document.createElement('div');
  info.className = 'home-game-preview-info';

  const kicker = document.createElement('div');
  kicker.className = 'home-game-preview-kicker';
  kicker.textContent = provider;

  const heading = document.createElement('h2');
  heading.textContent = title;

  const description = document.createElement('p');
  description.className = 'home-game-preview-description';
  description.textContent = descriptionText || `Play ${title} from your Xbox library.`;

  const chips = document.createElement('div');
  chips.className = 'home-game-preview-chips';
  [availability, ...tags].slice(0, 5).forEach(text => {
    const chip = document.createElement('span');
    chip.textContent = text;
    chips.append(chip);
  });

  const facts = document.createElement('div');
  facts.className = 'home-game-preview-facts';
  facts.append(
    previewFact(window.Views?.ICON?.play || '', 'Play', cloud ? 'Stream instantly' : 'Launch locally'),
    previewFact(window.Views?.ICON?.games || '', 'Type', cloud ? 'Cloud game' : 'Game'),
    previewFact(window.Views?.ICON?.person || '', 'Provider', provider)
  );

  const actions = document.createElement('div');
  actions.className = 'home-game-preview-actions';

  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'home-game-preview-start';
  start.dataset.nav = '';
  start.dataset.ringRadius = '.9rem';
  start.innerHTML = `${window.Views?.ICON?.play || ''}<span>Start</span>`;
  let startHandled = false;
  start._navActivate = async event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (startHandled) return;
    startHandled = true;
    start.disabled = true;
    start.setAttribute('aria-busy', 'true');
    const selected = previewTitle;
    closeGamePreview();
    if (selected) await activateTitle(selected);
  };
  /* iOS/iPadOS can lose the delayed synthetic click when this modal removes
     itself during activation. Handle the primary touch pointer directly and
     keep click for mouse, keyboard, accessibility, and older browsers. */
  start.addEventListener('pointerup', event => {
    if (event.isPrimary !== false && (event.pointerType === 'touch' || event.pointerType === 'pen'))
      void start._navActivate(event);
  });
  start.addEventListener('click', event => void start._navActivate(event));

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'home-game-preview-close';
  close.dataset.nav = '';
  close.dataset.ringRadius = '.9rem';
  close.innerHTML = `${window.Views?.ICON?.close || window.Views?.ICON?.back || ''}<span>Exit</span>`;
  close._navActivate = closeGamePreview;
  close.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeGamePreview();
  });

  actions.append(start, close);
  info.append(kicker, heading, description, chips, facts, actions);
  card.append(visual, coverWrap, info, share);
  layer.append(scrim, card);
  document.body.append(layer);

  preview = layer;
  previewTitle = title;
  window.Nav?.pushLayer?.(layer);
  requestAnimationFrame(() => {
    window.Nav?.focusIn?.(layer, '.home-game-preview-start');
  });
}

function ensureBadge(face, text){
  face.querySelectorAll('.ref-platform, .ref-gamepass-badge').forEach(node => node.remove());
  if (!text) return;

  if (text.includes('X|S')){
    const badge = document.createElement('span');
    badge.className = 'ref-platform ref-platform-xs';

    const img = document.createElement('img');
    img.className = 'ref-platform-xs-img';
    img.src = SERIES_XS_BADGE;
    img.alt = '';
    img.loading = 'eager';
    img.decoding = 'async';

    badge.append(img);
    face.append(badge);
  }
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
  // every tile in the row crops the same way; a per-title exception made
  // this one letterbox onto a plate while its neighbours ran full bleed
  img.style.objectFit = 'cover';
  img.style.objectPosition = 'center center';
  img.style.background = '';
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
  tile._navActivate = () => openGamePreview(def.to);
}

function wireAllGameTiles(){
  HOME.querySelectorAll('.ref-tile[data-ref-title]').forEach(tile => {
    const title = canonicalTitle(tile.dataset.refTitle) || tile.dataset.refTitle;
    if (!title) return;

    setTileArtwork(tile, title);

    if (tile.dataset.homeDirectLaunch !== title){
      tile.dataset.homeDirectLaunch = title;
      tile._navActivate = () => openGamePreview(title);
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
  /* Use the real My games & apps renderer instead of replacing the page with
     a Stratus-only list. The normal library already receives cloud ownership
     from cloud-library.js, so this keeps one source of truth. */
  window.App?.setView?.('library');
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const root = document.getElementById('view-library');
  if (!root || root.hidden) return;
  root.classList.remove('owned-only-library');
  delete root.dataset.storeOwnedLibrary;

  window.Nav?.repaint?.();
  try { window.Nav?.focusIn?.(root, '.console-poster'); } catch {}
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
  plus.textContent = '+';

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
  if (!strip || strip.querySelector('[data-home-library-mosaic="1"]')) return;

  const anchor =
    strip.querySelector('.ref-tile[data-ref-title="Cyberpunk 2077"]') ||
    strip.querySelector('.ref-friends') ||
    [...strip.querySelectorAll('.ref-tile[data-ref-title]')].at(-1);

  if (anchor) anchor.insertAdjacentElement('afterend', makeLibraryTile());
  else strip.append(makeLibraryTile());
}

function removeFortniteFromHome(){
  HOME.querySelectorAll('.ref-tile[data-ref-title]').forEach(tile => {
    if (norm(tile.dataset.refTitle) === norm('Fortnite')) tile.remove();
  });
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
  removeFortniteFromHome();
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

/* Preview is a real navigation layer. Capture B before App.goBack so it closes
   this panel instead of changing the underlying Home route. */
window.addEventListener('nav:button', event => {
  if (!preview || event.detail?.button !== 'b') return;
  event.stopImmediatePropagation?.();
  closeGamePreview();
}, true);

patchHome();
})();
