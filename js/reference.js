/* Xbox Home/Guide reference pass.
   Home-critical artwork is pinned to direct image URLs so the first screen
   does not depend on a runtime search API. */
(() => {
'use strict';

const V = window.Views;
if (!V) return;
const { el, escapeHtml, ICON } = V;

const EDGE_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg';
const FORZA_CLEAN = 'https://gaming-cdn.com/images/news/articles/13710/cover/forza-horizon-5-hat-auf-ps5-schon-2-millionen-spielkopien-verkauft-cover687427dc70621.jpg';
const SERIES_XS_BADGE = 'https://cms-assets.xboxservices.com/assets/fc/80/fc801b4c-fd95-4a10-8f03-da193e5792df.svg?n=Xbox-Series-X_Icons_768_Optimized_96x42_01.svg';

/* The wallpaper is deliberately separate from the Forza tile art. The old
   build used the retail key art as the wallpaper, which baked an enormous
   FORZA HORIZON 5 logo behind the system navigation. */
const ART = {
  'Forza Horizon 5': {
    cover: 'https://xboxwire.thesourcemediaassets.com/sites/2/2021/11/ForzaHorizon5_KeyArt_Horiz_RGB_Final.jpg',
    landscape: FORZA_CLEAN,
    hero: FORZA_CLEAN
  },
  'Subnautica 2': {
    cover: 'https://static.actugaming.net/media/2024/10/subnautica-2-jaquette.jpg'
  },
  'Hollow Knight: Silksong': {
    cover: 'https://hollowknight.wiki/w/Special:Redirect/file/SilksongPromo1.png'
  },
  'Microsoft Edge': { cover: EDGE_LOGO },
  'Mortal Kombat 1': {
    cover: 'https://images.pushsquare.com/7ce51d0661507/mortal-kombat-1-cover.cover_large.jpg'
  },
  'Roblox': {
    cover: 'https://m.media-amazon.com/images/I/715MvilCPGL.jpg'
  },
  'Fortnite': {
    cover: 'https://static.thcdn.com/productimg/1600/1600/11492349-4314494124984020.jpg'
  },
  'Cyberpunk 2077': {
    cover: 'https://store-images.s-microsoft.com/image/apps.47379.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.89bb995b-b066-4a53-9fe4-0260ce07e894?h=900&q=95&w=600',
    landscape: 'https://store-images.s-microsoft.com/image/apps.34838.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.1463028d-79fa-46e5-9fc2-63203992a4dc?h=720&q=95&w=1280',
    hero: 'https://store-images.s-microsoft.com/image/apps.34838.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.1463028d-79fa-46e5-9fc2-63203992a4dc?h=1080&q=95&w=1920'
  },
  'Minecraft Dungeons II': {
    landscape: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/homepage_discover_our_games_mc_dungeons_ii_key_art_864x864.jpg',
    cover: 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/homepage_discover_our_games_mc_dungeons_ii_key_art_864x864.jpg'
  },
  'Onimusha: Way of the Sword': {
    landscape: 'https://prcdn.freetls.fastly.net/release_image/13450/5749/13450-5749-b7598adbebf47b9e843dde5a75a2021d-1200x630.png?auto=webp&fit=bounds&format=jpeg&height=1260&width=2400',
    cover: 'https://prcdn.freetls.fastly.net/release_image/13450/5749/13450-5749-b7598adbebf47b9e843dde5a75a2021d-1200x630.png?auto=webp&fit=bounds&format=jpeg&height=1260&width=2400'
  },
  'BlizzCon 2026': {
    landscape: 'https://pliki.ppe.pl/storage/1cc680bbd7391274e9bf/1cc680bbd7391274e9bf.png',
    cover: 'https://pliki.ppe.pl/storage/1cc680bbd7391274e9bf/1cc680bbd7391274e9bf.png'
  }
};

const SGDB = 'https://www.steamgriddb.com/api/v2';
const CACHE_KEY = 'xbox.web.reference-art.v4';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch {}
const saveCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} };

async function sgdb(kind, name){
  const key = window.Artwork?.key;
  if (!key || !name) return null;
  const ck = `${kind}:${String(name).toLowerCase()}`;
  if (cache[ck]) return cache[ck];
  try {
    const headers = { Authorization: `Bearer ${key}` };
    const search = await fetch(`${SGDB}/search/autocomplete/${encodeURIComponent(name)}`, { headers });
    if (!search.ok) return null;
    const found = (await search.json())?.data || [];
    if (!found.length) return null;
    const id = found[0].id;
    const endpoint = kind === 'hero'
      ? `${SGDB}/heroes/game/${id}`
      : `${SGDB}/grids/game/${id}`;
    const res = await fetch(endpoint, { headers });
    if (!res.ok) return null;
    const list = (await res.json())?.data || [];
    let pick;
    if (kind === 'hero') pick = list.find(a => a.width / a.height > 2.15) || list[0];
    else if (kind === 'landscape') pick = list.find(a => a.width / a.height > 1.55) || list.find(a => a.width > a.height) || list[0];
    else pick = list.find(a => a.height / a.width > 1.15) || list[0];
    if (!pick?.url) return null;
    cache[ck] = pick.url;
    saveCache();
    return pick.url;
  } catch { return null; }
}

function primaryArt(name, kind){
  const row = ART[name];
  if (!row) return '';
  return row[kind] || row.cover || row.landscape || row.hero || '';
}

function loadArt(img, name, kind = 'cover', explicitFallback = ''){
  img.alt = '';
  img.decoding = 'async';
  img.loading = 'eager';
  const primary = primaryArt(name, kind) || explicitFallback;
  if (primary){
    img.src = primary;
    img.classList.add('loaded');
  }

  let triedSecondary = false;
  const secondary = async () => {
    if (triedSecondary) return;
    triedSecondary = true;
    const url = await sgdb(kind, name);
    if (url && url !== img.src){
      img.src = url;
      img.classList.add('loaded');
    }
  };
  img.addEventListener('error', secondary, { once:true });
  if (!primary) secondary();
}

function realGame(name){
  const target = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  return window.Catalog.all().find(g =>
    String(g.name).toLowerCase().replace(/[^a-z0-9]/g, '') === target
  ) || null;
}

function activate(name){
  const game = realGame(name);
  if (game) window.App.openDetail(game);
  else window.App.setView('library');
}

const ROW = [
  { name:'Forza Horizon 5', hero:true, badge:'X|S' },
  { name:'Subnautica 2', badge:'GAME PASS  X|S' },
  { name:'Hollow Knight: Silksong', badge:'GAME PASS  X|S' },
  { name:'Microsoft Edge', className:'edge-tile' },
  { name:'Mortal Kombat 1', badge:'X|S' },
  { name:'Roblox' },
  { name:'Fortnite', badge:'X|S' }
];

function refTile(def){
  const btn = el('button', `tile ref-tile ${def.hero ? 'tile-hero ref-hero' : 'tile-sm'} ${def.className || ''}`);
  btn.dataset.nav = '';
  btn.dataset.refTitle = def.name;
  btn.dataset.ringRadius = '.08rem';
  btn.setAttribute('aria-label', def.name);

  const face = el('span', 'tile-face');
  const art = el('span', 'ref-art');
  const img = el('img', 'cover loaded');
  loadArt(img, def.name, 'cover');
  art.append(img);
  face.append(art);

  if (def.badge){
    if (def.badge.includes('X|S')){
      const badge = el('span', 'ref-platform ref-platform-xs');
      const badgeImg = el('img', 'ref-platform-xs-img');
      badgeImg.src = SERIES_XS_BADGE;
      badgeImg.alt = '';
      badgeImg.loading = 'eager';
      badgeImg.decoding = 'async';
      badge.append(badgeImg);
      face.append(badge);
    }
  }

  btn.append(face, el('span', 'tile-label', escapeHtml(def.name)));
  btn._navActivate = () => activate(def.name);
  return btn;
}

const FRIENDS_MARK = `
<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="23" cy="24" r="7"></circle>
  <circle cx="43" cy="24" r="7"></circle>
  <path d="M8 48c0-9 6-14 15-14s15 5 15 14"></path>
  <path d="M29 48c0-9 5-14 14-14s13 5 13 14"></path>
</svg>`;

function friendsTile(){
  const btn = refTile({ name:'Friends & community' });
  btn.classList.add('ref-friends');
  btn.removeAttribute('data-ref-title');
  const face = btn.querySelector('.tile-face');
  if (face) face.innerHTML = `<span class="ref-friends-icon">${FRIENDS_MARK}</span>`;
  btn._navActivate = () => window.Guide?.open?.('people');
  return btn;
}

function refCard({ label, sub, artName, chip, cls }){
  const btn = el('button', `card ref-card ${cls || ''}`);
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '.08rem';
  if (artName) btn.dataset.artName = artName;
  btn.setAttribute('aria-label', label);

  if (cls === 'card-store'){
    const wrap = el('div', 'ref-card-art ref-store-art synapse-store-art');
    const icon = el('span', 'synapse-store-icon');
    icon.innerHTML = window.Icons?.icon?.('shopping_bag') || '';
    const name = el('span', 'synapse-store-name', escapeHtml(label));
    wrap.append(icon, name);
    btn.append(wrap);
  } else {
    const wrap = el('div', 'ref-card-art');
    const img = el('img', 'cover loaded');
    loadArt(img, artName || label, 'landscape');
    if (artName === 'Onimusha: Way of the Sword') img.style.objectPosition = 'center 22%';
    if (artName === 'BlizzCon 2026') img.style.objectPosition = 'center 29%';
    wrap.append(img);
    btn.append(wrap);
  }

  if (chip) btn.append(el('div', 'card-chip', escapeHtml(chip)));
  if (cls !== 'card-store'){
    btn.append(el('div', 'card-label',
      escapeHtml(label) + (sub ? `<span class="sub">${escapeHtml(sub)}</span>` : '')));
  }
  btn._navActivate = () => artName ? activate(artName) : window.App.setView('pass');
  return btn;
}

function setReferenceBackdrop(){
  document.body.dataset.homeNeutral = 'true';
  const a = document.getElementById('bgA');
  const b = document.getElementById('bgB');

  [a, b].forEach(layer => {
    if (!layer) return;
    layer.style.backgroundImage = 'none';
    layer.style.backgroundPosition = 'center center';
    delete layer.dataset.dynamicTitle;
    delete layer.dataset.wallpaper;
    layer.classList.remove('on', 'wide', 'reference-wide');
  });

  document.body.style.background = '#000';
}

let focusEpoch = 0;
function focusReferenceChrome(){
  const epoch = ++focusEpoch;
  const enforce = () => {
    if (epoch !== focusEpoch) return;
    if (document.body.dataset.view && document.body.dataset.view !== 'home') return;
    const start = window.State?.settings?.homeStartFocus || 'profile';
    if (start === 'first-game'){
      const firstGame = document.querySelector('#view-home .ref-strip .ref-tile[data-ref-title]:not([hidden])');
      if (firstGame){
        window.Nav?.focus?.(firstGame, { silent:true });
        return;
      }
    }
    const profile = document.querySelector('.profile[data-nav], .profile');
    if (profile) window.Nav?.focus?.(profile, { silent:true });
  };

  requestAnimationFrame(() => requestAnimationFrame(enforce));
  setTimeout(enforce, 120);
  setTimeout(enforce, 650);
}

function renderReferenceHome(root){
  root.innerHTML = '';
  root.classList.add('reference-home');

  const rail = el('div', 'rail ref-rail');
  const strip = el('div', 'rail-strip ref-strip');
  ROW.forEach(def => strip.append(refTile(def)));
  strip.append(refTile({ name:'Cyberpunk 2077', badge:'X|S' }));
  rail.append(strip);
  root.append(rail);

  const cards = el('div', 'cards ref-cards');
  cards.append(
    refCard({ label:'Synapse Store', cls:'card-store' }),
    refCard({ label:'Minecraft Dungeons II', sub:'Add to Play Later', artName:'Minecraft Dungeons II', chip:'GAME PASS' }),
    refCard({ label:'Onimusha: Way of the Sword', sub:'Available now', artName:'Onimusha: Way of the Sword' }),
    refCard({ label:'BlizzCon 2026', sub:'Watch the show', artName:'BlizzCon 2026' })
  );
  root.append(cards);

  [...strip.children, ...cards.children].forEach((n, i) => n.style.setProperty('--i', i));
  setReferenceBackdrop();
  focusReferenceChrome();
}

V.renderHome = renderReferenceHome;

/* Re-anchor once more when the stage becomes visible after the boot clip. */
const stage = document.getElementById('stage');
if (stage){
  new MutationObserver(() => {
    if (!stage.hidden && document.body.dataset.view === 'home'){
      const home = document.getElementById('view-home');
      if (home) focusReferenceChrome();
    }
  }).observe(stage, { attributes:true, attributeFilter:['hidden'] });
}

const XBOX_MARK = '<img class="xbox-guide-mark" src="assets/pwa/xbox-logo.svg" alt="" aria-hidden="true">';

function tuneGuideTabs(){
  const tabs = document.getElementById('guideTabs');
  if (!tabs) return;
  const list = [...tabs.querySelectorAll('.guide-tab')];
  if (!list.length) return;
  if (!list[0].querySelector('.xbox-guide-mark')) list[0].innerHTML = XBOX_MARK;
  list.slice(6).forEach(btn => btn.classList.add('reference-hidden-tab'));
}

const guideTabs = document.getElementById('guideTabs');
if (guideTabs){
  new MutationObserver(tuneGuideTabs).observe(guideTabs, { childList:true });
  tuneGuideTabs();
}

const GUIDE_REFERENCE_ROWS = [
  { name:'Home', glyph:true },
  { name:'My games & apps', glyph:true },
  { name:'Forza Horizon 5', game:'Forza Horizon 5', cover:'assets/game-art/forza-horizon-5-cover.jpg' },
  { name:'Grand Theft Auto V', game:'Grand Theft Auto V', cover:'assets/game-art/gta-v-cover.jpg' },
  { name:'Hollow Knight: Silksong', game:'Hollow Knight: Silksong', cover:'assets/game-art/silksong-cover.png' },
  { name:'Elden Ring', game:'Elden Ring', cover:'assets/game-art/elden-ring-cover.jpg' }
];

const guideNorm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function launchGuideGame(title){
  const target = guideNorm(title);
  const homeTile = [...document.querySelectorAll('#view-home .ref-tile[data-ref-title]')]
    .find(tile => guideNorm(tile.dataset.refTitle) === target);

  if (typeof homeTile?._navActivate === 'function'){
    window.Guide?.close?.();
    setTimeout(() => homeTile._navActivate(homeTile), 210);
    return;
  }

  const game = window.Catalog?.all?.().find(item => guideNorm(item.name) === target);
  if (!game){
    window.App?.toast?.('Game unavailable', `${title} is not currently available.`);
    return;
  }

  window.Guide?.close?.();
  setTimeout(() => {
    window.App?.openDetail?.(game);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const play = document.querySelector('#detail .btn.primary');
      if (typeof play?._navActivate === 'function') play._navActivate(play);
    }));
  }, 210);
}

function tuneGuideBody(){
  const body = document.getElementById('guideBody');
  if (!body || body.querySelector('.guide-head')) return;
  const rows = [...body.querySelectorAll('.grow')];
  if (rows.length < 2) return;
  const firstName = rows[0].querySelector('.grow-name')?.textContent;
  if (firstName !== 'Home' || rows[0].dataset.referenceGuide === '1') return;

  rows.forEach((row, i) => {
    if (i >= GUIDE_REFERENCE_ROWS.length){ row.style.display = 'none'; return; }
    const def = GUIDE_REFERENCE_ROWS[i];
    row.dataset.referenceGuide = '1';
    const name = row.querySelector('.grow-name');
    const meta = row.querySelector('.grow-meta');
    if (name) name.textContent = def.name;
    if (meta) meta.remove();
    if (def.game){
      row.dataset.guideGame = def.game;
      row.setAttribute('aria-label', def.game);
      row._navActivate = () => launchGuideGame(def.game);
    }

    if (def.cover){
      const box = row.querySelector('.grow-icon');
      if (box){
        box.classList.remove('glyph');
        box.innerHTML = '';
        const img = el('img', 'cover loaded');
        img.alt = '';
        img.loading = 'eager';
        img.decoding = 'async';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover';
        img.src = def.cover;
        box.append(img);
      }
    }
  });
}

const guideBody = document.getElementById('guideBody');
if (guideBody){
  new MutationObserver(tuneGuideBody).observe(guideBody, { childList:true, subtree:true });
  tuneGuideBody();
}

})();
