/* Pixel-accuracy pass for the Xbox Home/Guide reference. Loaded after views.js
   and guide.js but before app.js so App captures this Home renderer. */
(() => {
'use strict';

const V = window.Views;
if (!V) return;
const { el, escapeHtml, ICON } = V;

const SGDB = 'https://www.steamgriddb.com/api/v2';
const CACHE_KEY = 'xbox.web.reference-art.v2';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch {}

const saveCache = () => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

const keyFor = (kind, name) => `${kind}:${String(name).toLowerCase()}`;

async function sgdb(kind, name){
  const key = window.Artwork?.key;
  if (!key || !name) return null;
  const ck = keyFor(kind, name);
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
    const art = (await res.json())?.data || [];
    let pick = null;
    if (kind === 'hero'){
      pick = art.find(a => a.width / a.height > 2.2) || art[0];
    } else if (kind === 'landscape'){
      pick = art.find(a => a.width / a.height > 1.7) || art.find(a => a.width > a.height) || art[0];
    } else {
      pick = art.find(a => a.height / a.width > 1.25) || art[0];
    }
    if (!pick?.url) return null;
    cache[ck] = pick.url;
    saveCache();
    return pick.url;
  } catch { return null; }
}

function loadArt(img, name, kind = 'cover', fallback = ''){
  img.alt = '';
  img.decoding = 'async';
  img.loading = 'eager';
  if (fallback) img.src = fallback;
  sgdb(kind, name).then(url => {
    if (!url) return;
    const probe = new Image();
    probe.onload = () => { img.src = url; img.classList.add('loaded'); };
    probe.src = url;
  });
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

const EDGE_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg';

const ROW = [
  { name:'Forza Horizon 5', hero:true },
  { name:'Subnautica 2' },
  { name:'Hollow Knight: Silksong' },
  { name:'Microsoft Edge', fallback:EDGE_LOGO, className:'edge-tile' },
  { name:'Mortal Kombat 1' },
  { name:'Roblox' },
  { name:'Fortnite' }
];

function refTile(def){
  const btn = el('button', `tile ref-tile ${def.hero ? 'tile-hero ref-hero' : 'tile-sm'} ${def.className || ''}`);
  btn.dataset.nav = '';
  btn.dataset.refTitle = def.name;
  btn.setAttribute('aria-label', def.name);
  const face = el('span', 'tile-face');
  const art = el('span', 'ref-art');
  const img = el('img', 'cover loaded');
  loadArt(img, def.name, 'cover', def.fallback || '');
  art.append(img);
  face.append(art);
  if (def.name !== 'Microsoft Edge'){
    const badge = el('span', 'ref-platform', def.name === 'Forza Horizon 5' ? 'X|S' : '');
    if (badge.textContent) face.append(badge);
  }
  btn.append(face, el('span', 'tile-label', escapeHtml(def.name)));
  btn._navActivate = () => activate(def.name);
  return btn;
}

function friendsTile(){
  const btn = el('button', 'tile tile-wide ref-friends');
  btn.dataset.nav = '';
  btn.setAttribute('aria-label', 'Friends & community');
  const face = el('span', 'tile-face');
  face.innerHTML = `<span class="ref-friends-icon">${ICON.party}</span>`;
  btn.append(face, el('span', 'tile-label', 'Friends & community'));
  btn._navActivate = () => window.App.setView('library');
  return btn;
}

function refCard({ label, sub, artName, chip, cls, fallback }){
  const btn = el('button', `card ref-card ${cls || ''}`);
  btn.dataset.nav = '';
  btn.setAttribute('aria-label', label);

  if (cls === 'card-store'){
    const icon = el('div', 'ref-store-icon', ICON.store);
    btn.append(icon);
  } else {
    const wrap = el('div', 'ref-card-art');
    const img = el('img', 'cover loaded');
    loadArt(img, artName || label, 'landscape', fallback || '');
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
  const token = String(Date.now());
  document.body.dataset.referenceBackdrop = token;
  Promise.all([
    sgdb('landscape', 'Forza Horizon 5'),
    sgdb('hero', 'Forza Horizon 5')
  ]).then(([landscape, hero]) => {
    if (document.body.dataset.referenceBackdrop !== token) return;
    const url = landscape || hero;
    if (!url) return;
    const layer = document.getElementById('bgA');
    const other = document.getElementById('bgB');
    if (!layer) return;
    layer.style.backgroundImage = `url("${url}")`;
    layer.classList.add('on', 'wide', 'reference-wide');
    other?.classList.remove('on');
  });
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
    refCard({ label:'BlizzCon 2026', sub:'Watch the show', artName:'Overwatch 2' })
  );
  root.append(cards);

  [...strip.children, ...cards.children].forEach((n, i) => n.style.setProperty('--i', i));
  setReferenceBackdrop();
}

V.renderHome = renderReferenceHome;

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

})();
