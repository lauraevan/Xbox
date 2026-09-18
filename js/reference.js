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

/* The wallpaper is deliberately separate from the Forza tile art. The old
   build used the retail key art as the wallpaper, which baked an enormous
   FORZA HORIZON 5 logo behind the system navigation. */
const ART = {
  'Forza Horizon 5': {
    cover: 'assets/game-art/forza-horizon-5-cover.jpg',
    landscape: 'assets/game-art/forza-horizon-5-hero.jpg',
    hero: 'assets/game-art/forza-horizon-5-hero.jpg'
  },
  'Grand Theft Auto V': {
    cover: 'assets/game-art/gta-v-cover.jpg',
    landscape: 'assets/game-art/gta-v-hero.jpg',
    hero: 'assets/game-art/gta-v-hero.jpg'
  },
  'Hollow Knight: Silksong': {
    cover: 'assets/game-art/silksong-cover.png',
    landscape: 'assets/game-art/silksong-hero.jpg',
    hero: 'assets/game-art/silksong-hero.jpg'
  },
  'Elden Ring': {
    cover: 'assets/game-art/elden-ring-cover.jpg',
    landscape: 'assets/game-art/elden-ring-hero.jpg',
    hero: 'assets/game-art/elden-ring-hero.jpg'
  },
  'Red Dead Redemption 2': {
    cover: 'assets/game-art/rdr2-cover.jpg',
    landscape: 'assets/game-art/rdr2-hero.jpg',
    hero: 'assets/game-art/rdr2-hero.jpg'
  },
  'Minecraft': {
    cover: 'assets/game-art/minecraft-cover.webp',
    landscape: 'assets/game-art/minecraft-hero.png',
    hero: 'assets/game-art/minecraft-hero.png'
  },
  'Fortnite': {
    cover: 'assets/game-art/fortnite-cover.jpg',
    landscape: 'assets/game-art/fortnite-hero.jpg',
    hero: 'assets/game-art/fortnite-hero.jpg'
  },
  'Subnautica 2': {
    cover: 'https://static.actugaming.net/media/2024/10/subnautica-2-jaquette.jpg'
  },
  'Microsoft Edge': { cover: EDGE_LOGO },
  'Mortal Kombat 1': {
    cover: 'https://images.pushsquare.com/7ce51d0661507/mortal-kombat-1-cover.cover_large.jpg'
  },
  'Roblox': {
    cover: 'https://m.media-amazon.com/images/I/715MvilCPGL.jpg'
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
}

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
  { name:'Grand Theft Auto V', badge:'X|S' },
  { name:'Hollow Knight: Silksong', badge:'GAME PASS  X|S' },
  { name:'Elden Ring', badge:'X|S' },
  { name:'Red Dead Redemption 2', badge:'X|S' },
  { name:'Minecraft', badge:'X|S' },
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
  const primary = primaryArt(def.name, 'cover');

  if (primary){
    const resolved = new URL(primary, document.baseURI).href;
    const bg = `url("${resolved}")`;
    face.style.setProperty('background-image', bg, 'important');
    face.style.setProperty('background-size', 'cover', 'important');
    face.style.setProperty('background-position', 'center', 'important');
    face.style.setProperty('background-repeat', 'no-repeat', 'important');
    art.style.setProperty('background-image', bg, 'important');
    art.style.setProperty('background-size', 'cover', 'important');
    art.style.setProperty('background-position', 'center', 'important');
    art.style.setProperty('background-repeat', 'no-repeat', 'important');
  }

  loadArt(img, def.name, 'cover');
  art.append(img);
  face.append(art);

  if (def.badge) face.append(el('span', 'ref-platform', def.badge));

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
  const btn = el('button', 'tile tile-wide ref-friends');
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '.08rem';
  btn.setAttribute('aria-label', 'Friends & community');
  const face = el('span', 'tile-face');
  face.innerHTML = `<span class="ref-friends-icon">${FRIENDS_MARK}</span>`;
  btn.append(face, el('span', 'tile-label', 'Friends & community'));
  btn._navActivate = () => window.App.setView('library');
  return btn;
}

function refCard({ label, sub, artName, chip, cls }){
  const btn = el('button', `card ref-card ${cls || ''}`);
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '.08rem';
  if (artName) btn.dataset.artName = artName;
  btn.setAttribute('aria-label', label);

  if (cls === 'card-store'){
    btn.append(el('div', 'ref-store-icon', ICON.store));
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
  btn.append(el('div', 'card-label',
    escapeHtml(label) + (sub ? `<span class="sub">${escapeHtml(sub)}</span>` : '')));
  btn._navActivate = () => artName ? activate(artName) : window.App.setView('pass');
  return btn;
}

function setReferenceBackdrop(){
  const layer = document.getElementById('bgA');
  const other = document.getElementById('bgB');
  if (!layer) return;
  const url = primaryArt('Forza Horizon 5', 'hero');
  layer.style.backgroundImage = `url("${url}")`;
  layer.style.backgroundPosition = 'center top';
  layer.classList.add('on', 'wide', 'reference-wide');
  other?.classList.remove('on');
}

let focusEpoch = 0;
function focusReferenceHero(root){
  const epoch = ++focusEpoch;
  const enforce = () => {
    if (epoch !== focusEpoch) return;
    if (document.body.dataset.view && document.body.dataset.view !== 'home') return;
    const hero = root.querySelector('.ref-hero');
    if (hero) window.Nav?.focus?.(hero, { silent:true });
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
  strip.append(friendsTile());
  rail.append(strip);
  root.append(rail);

  const cards = el('div', 'cards ref-cards');
  cards.append(
    refCard({ label:'Browse the store', cls:'card-store' }),
    refCard({ label:'Minecraft Dungeons II', sub:'Add to Play Later', artName:'Minecraft Dungeons II', chip:'GAME PASS' }),
    refCard({ label:'Onimusha: Way of the Sword', sub:'Available now', artName:'Onimusha: Way of the Sword' }),
    refCard({ label:'BlizzCon 2026', sub:'Watch the show', artName:'BlizzCon 2026' })
  );
  root.append(cards);

  [...strip.children, ...cards.children].forEach((n, i) => n.style.setProperty('--i', i));
  setReferenceBackdrop();
  focusReferenceHero(root);
}

V.renderHome = renderReferenceHome;

/* Re-anchor once more when the stage becomes visible after the boot clip. */
const stage = document.getElementById('stage');
if (stage){
  new MutationObserver(() => {
    if (!stage.hidden && document.body.dataset.view === 'home'){
      const home = document.getElementById('view-home');
      if (home) focusReferenceHero(home);
    }
  }).observe(stage, { attributes:true, attributeFilter:['hidden'] });
}

const XBOX_MARK = `
<svg class="xbox-guide-mark" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-5.9 4.25c1.85-1.16 3.73-1.2 5.9.14-1.42.97-2.76 2.22-4.02 3.73A18.8 18.8 0 0 0 6.1 6.25Zm11.8 0a18.8 18.8 0 0 0-1.88 3.87c-1.26-1.51-2.6-2.76-4.02-3.73 2.17-1.34 4.05-1.3 5.9-.14ZM5.02 9.18c2.02 1.55 4.35 4.15 6.98 7.8 2.63-3.65 4.96-6.25 6.98-7.8.66 1.53.75 3.2.23 5.02A7.5 7.5 0 0 1 12 19.5a7.5 7.5 0 0 1-7.21-5.3 7.1 7.1 0 0 1 .23-5.02Z"/>
</svg>`;

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
  { name:'Forza Horizon 5', art:'Forza Horizon 5' },
  { name:'Subnautica 2 (Game Preview)', art:'Subnautica 2' },
  { name:'Hollow Knight: Silksong', art:'Hollow Knight: Silksong' },
  { name:'Microsoft Edge', art:'Microsoft Edge' }
];

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
    if (def.art){
      const box = row.querySelector('.grow-icon');
      if (box){
        box.classList.remove('glyph');
        box.innerHTML = '';
        const img = el('img', 'cover loaded');
        img.style.cssText = 'width:100%;height:100%;object-fit:cover';
        loadArt(img, def.art, 'cover');
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
