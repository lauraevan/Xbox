/* ═══════════════════════════════════════════════════════════
   CATALOG — loads the zone manifest and normalises it
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const CDN = {
  manifest: 'https://cdn.jsdelivr.net/gh/bestsabplayerox/assets@main/zones.json',
  cover:    'https://cdn.jsdelivr.net/gh/bestsabplayerox/covers@main',
  html:     'https://cdn.jsdelivr.net/gh/bestsabplayerox/html@master'
};

/* jsDelivr is the primary origin; these serve the same trees and act as
   fallbacks when a network refuses the CDN. */
const MIRRORS = {
  manifest: [
    CDN.manifest,
    'https://raw.githubusercontent.com/bestsabplayerox/assets/main/zones.json'
  ],
  cover: [CDN.cover, 'https://raw.githubusercontent.com/bestsabplayerox/covers/main'],
  html:  [CDN.html,  'https://raw.githubusercontent.com/bestsabplayerox/html/master']
};

/* `special` tags in the manifest, mapped to shelf metadata. */
const TAGS = {
  port:     { label:'Port',      badge:'PORT',  cls:'', shelf:'Ports & conversions' },
  flash:    { label:'Flash',     badge:'FLASH', cls:'flash', shelf:'Flash vault' },
  emulator: { label:'Emulator',  badge:'EMU',   cls:'emu', shelf:'Emulators' },
  nes:      { label:'NES',       badge:'NES',   cls:'emu', shelf:'Emulators' },
  n64:      { label:'N64',       badge:'N64',   cls:'emu', shelf:'Emulators' },
  gba:      { label:'GBA',       badge:'GBA',   cls:'emu', shelf:'Emulators' },
  nds:      { label:'DS',        badge:'DS',    cls:'emu', shelf:'Emulators' },
  psx:      { label:'PS1',       badge:'PS1',   cls:'emu', shelf:'Emulators' },
  fnf:      { label:'Rhythm',    badge:'FNF',   cls:'', shelf:'Rhythm' },
  tools:    { label:'App',       badge:'APP',   cls:'', shelf:'Apps & tools' }
};

const state = {
  games: [],
  byId: new Map(),
  featured: [],
  source: null,
  error: null
};

const expand = (tpl, kind) =>
  String(tpl || '')
    .replace('{COVER_URL}', MIRRORS.cover[kind] || CDN.cover)
    .replace('{HTML_URL}',  MIRRORS.html[kind]  || CDN.html);

/** Build both a primary and a fallback URL for a templated path. */
function urls(tpl){
  if (!tpl) return [];
  if (!tpl.startsWith('{')) return [tpl];            // already absolute
  return [0, 1].map(i => String(tpl)
    .replace('{COVER_URL}', MIRRORS.cover[i])
    .replace('{HTML_URL}',  MIRRORS.html[i]));
}

function normalise(raw, index){
  const special = Array.isArray(raw.special) ? raw.special : (raw.special ? [raw.special] : []);
  const tag = special.map(s => TAGS[s]).find(Boolean) || null;
  const coverUrls = urls(raw.cover);
  const playUrls  = urls(raw.url);
  const external  = !String(raw.url || '').startsWith('{');

  return {
    id:        String(raw.id),
    numericId: Number(raw.id),
    name:      raw.name || 'Untitled',
    sortName:  (raw.name || '').replace(/^(the|a|an)\s+/i, '').toLowerCase(),
    author:    raw.author && raw.author !== 'unknown' ? raw.author : 'Independent developer',
    authorLink:raw.authorLink || null,
    cover:     coverUrls[0] || '',
    coverAlt:  coverUrls[1] || '',
    // just the leaf ("173.png"), which js/media.js walks across mirrors
    coverFile: String(raw.cover || '').split('/').pop() || '',
    play:      playUrls[0] || '',
    playAlt:   playUrls[1] || '',
    external,
    featured:  !!raw.featured,
    special,
    tag,
    shelf:     tag ? tag.shelf : 'Games',
    index
  };
}

/** Deterministic pseudo-random so "recommended" shelves stay stable per session. */
function seededShuffle(list, seed){
  const out = list.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--){
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fetchManifest(){
  let lastError = null;
  for (const url of MIRRORS.manifest){
    try {
      const res = await fetch(url, { cache:'default', mode:'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json) || !json.length) throw new Error('empty manifest');
      state.source = url;
      return json;
    } catch (err){ lastError = err; }
  }
  throw lastError || new Error('no manifest source reachable');
}

async function load(){
  const raw = await fetchManifest();

  state.games = raw
    // entries with a negative id are manifest notices, not playable titles
    .filter(g => g && Number(g.id) >= 0 && g.url)
    .map(normalise);

  state.games.forEach(g => state.byId.set(g.id, g));
  state.featured = state.games.filter(g => g.featured);
  return state.games;
}

/* ───────── query helpers used by the views ───────── */
const Catalog = {
  CDN, TAGS, state, load, seededShuffle,

  /** Family settings withhold whole categories from the console. */
  visible(list){
    const blocked = window.State?.settings.blockedTags || [];
    if (!blocked.length) return list;
    return list.filter(g => !g.special.some(t => blocked.includes(t)));
  },

  all(){ return Catalog.visible(state.games); },
  get:      id => state.byId.get(String(id)) || null,
  count(){ return Catalog.all().length; },
  featured(){ return Catalog.visible(state.featured); },

  byTag(tag){ return Catalog.visible(state.games.filter(g => g.special.includes(tag))); },

  /** Everything with no special tag — the "plain browser games" bulk. */
  standard(){ return Catalog.visible(state.games.filter(g => !g.special.length)); },

  alphabetical(){
    return Catalog.visible(state.games).slice()
      .sort((a, b) => a.sortName.localeCompare(b.sortName));
  },

  /** Fuzzy-ish search: title match first, then developer match. */
  search(query){
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const titles = [], authors = [];
    for (const g of state.games){
      const n = g.name.toLowerCase();
      if (n.startsWith(q)) titles.unshift(g);
      else if (n.includes(q)) titles.push(g);
      else if (g.author.toLowerCase().includes(q)) authors.push(g);
    }
    return Catalog.visible(titles.concat(authors)).slice(0, 120);
  },

  /** Shelves for the Game Pass view, built from the manifest's own tags. */
  shelves(){
    const seed = 7;
    const shelves = [
      { title:'Featured this month', items: state.featured },
      { title:'Recently added',      items: state.games.slice(-24).reverse() },
      { title:'Flash vault',         items: this.byTag('flash') },
      { title:'Console ports',       items: this.byTag('port') },
      { title:'Emulators',           items: this.byTag('emulator') },
      { title:'Rhythm & music',      items: this.byTag('fnf') },
      { title:'Apps & tools',        items: this.byTag('tools') },
      { title:'Popular right now',   items: seededShuffle(this.standard(), seed).slice(0, 24) },
      { title:'Because you play browser games', items: seededShuffle(this.standard(), seed + 31).slice(0, 24) }
    ];
    return shelves.filter(s => s.items.length);
  },

  /** Developers with enough titles to be worth a row. */
  studios(){
    const map = new Map();
    for (const g of state.games){
      if (!map.has(g.author)) map.set(g.author, []);
      map.get(g.author).push(g);
    }
    return [...map.entries()]
      .filter(([name, items]) => items.length >= 5 && name !== 'Independent developer')
      .sort((a, b) => b[1].length - a[1].length);
  }
};

window.Catalog = Catalog;
})();
