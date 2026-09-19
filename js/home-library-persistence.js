/* Persistent Xbox Home row + built-in ownership.
   Default Home games are treated as owned on every device. Home placement is
   separate from ownership, so removing a tile never removes it from Library. */
(() => {
'use strict';

const Cloud = window.StratusCloud;
if (!Cloud) return;

const HOME_KEY = 'xbox.home.screen.v1';
const DEFAULT_TITLES = [
  'Forza Horizon 5',
  'Grand Theft Auto V',
  'Hollow Knight: Silksong',
  'Elden Ring',
  'Red Dead Redemption 2',
  'Minecraft'
];

const ALIASES = {
  'Forza Horizon 5': ['forza horizon 5'],
  'Grand Theft Auto V': ['grand theft auto v','gta v','gta 5','grand theft auto 5'],
  'Hollow Knight: Silksong': ['hollow knight silksong','silksong'],
  'Elden Ring': ['elden ring'],
  'Red Dead Redemption 2': ['red dead redemption 2','rdr2'],
  'Minecraft': ['minecraft']
};

const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const defaultNorms = new Set(
  DEFAULT_TITLES.flatMap(title => [title, ...(ALIASES[title] || [])]).map(norm)
);

function canonicalDefault(value){
  const key = norm(value);
  return DEFAULT_TITLES.find(title =>
    norm(title) === key || (ALIASES[title] || []).some(alias => norm(alias) === key)
  ) || null;
}

function isDefaultGame(game){
  return !!game && defaultNorms.has(norm(game.name));
}

function itemId(game){
  const def = canonicalDefault(game?.name);
  if (def) return 'default:' + norm(def);
  if (game?.gameKey) return 'cloud:' + String(game.gameKey);
  return 'title:' + norm(game?.name);
}

function defaultHomeIds(){
  return DEFAULT_TITLES.map(title => 'default:' + norm(title));
}

function readHomeIds(){
  try {
    const raw = localStorage.getItem(HOME_KEY);
    if (raw === null) return defaultHomeIds();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : defaultHomeIds();
  } catch {
    return defaultHomeIds();
  }
}

function writeHomeIds(ids){
  const clean = [...new Set((ids || []).map(String).filter(Boolean))];
  try { localStorage.setItem(HOME_KEY, JSON.stringify(clean)); } catch {}
  window.dispatchEvent(new CustomEvent('xbox:home-change', { detail:{ ids:clean } }));
  return clean;
}

function isOnHome(game){
  return readHomeIds().includes(itemId(game));
}

function addToHome(game){
  const id = itemId(game);
  if (!id) return false;
  const ids = readHomeIds();
  if (ids.includes(id)) return false;
  ids.push(id);
  writeHomeIds(ids);
  return true;
}

function removeFromHome(game){
  const id = itemId(game);
  const ids = readHomeIds();
  const next = ids.filter(value => value !== id);
  if (next.length === ids.length) return false;
  writeHomeIds(next);
  return true;
}

async function catalogue(){
  try {
    const list = await Cloud.loadCatalogue?.();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function defaultGames(){
  const list = await catalogue();
  return DEFAULT_TITLES.map(title => {
    const candidates = [title, ...(ALIASES[title] || [])].map(norm);
    return list.find(game => candidates.includes(norm(game.name))) || null;
  }).filter(Boolean);
}

/* Built-in licenses: the six default Home games are always owned, regardless
   of localStorage or device. Store purchases remain handled by Stratus. */
const originalOwns = typeof Cloud.owns === 'function' ? Cloud.owns.bind(Cloud) : () => false;
const originalAcquire = typeof Cloud.acquire === 'function' ? Cloud.acquire.bind(Cloud) : () => false;
const originalOwnedGames = typeof Cloud.ownedGames === 'function'
  ? Cloud.ownedGames.bind(Cloud)
  : async () => [];

Cloud.owns = game => isDefaultGame(game) || originalOwns(game);
Cloud.acquire = game => isDefaultGame(game) ? false : originalAcquire(game);
Cloud.ownedGames = async () => {
  const [owned, defaults] = await Promise.all([originalOwnedGames(), defaultGames()]);
  const seen = new Set();
  const merged = [];
  for (const game of [...defaults, ...(Array.isArray(owned) ? owned : [])]){
    const key = String(game?.gameKey || norm(game?.name));
    if (!game || seen.has(key)) continue;
    seen.add(key);
    merged.push(game);
  }
  return merged;
};

function gameByTitle(list, title){
  const target = norm(title);
  const aliases = [title, ...(ALIASES[title] || [])].map(norm);
  return list.find(game => aliases.includes(norm(game.name)) || norm(game.name) === target) || null;
}

async function resolveHomeGames(){
  const ids = readHomeIds();
  const owned = await Cloud.ownedGames();
  const byId = new Map(owned.map(game => [itemId(game), game]));

  for (const title of DEFAULT_TITLES){
    const id = 'default:' + norm(title);
    if (!byId.has(id)){
      const game = gameByTitle(owned, title);
      if (game) byId.set(id, game);
    }
  }

  return ids.map(id => byId.get(id)).filter(Boolean);
}

function tileTitle(tile){
  return String(tile?.dataset?.refTitle || tile?.getAttribute?.('aria-label') || '').trim();
}

function makeGameTile(game){
  const btn = document.createElement('button');
  btn.className = 'tile ref-tile tile-sm home-managed-tile';
  btn.dataset.nav = '';
  btn.dataset.refTitle = game.name;
  btn.dataset.homeManagedId = itemId(game);
  btn.dataset.ringRadius = '.08rem';
  btn.setAttribute('aria-label', game.name);

  const face = document.createElement('span');
  face.className = 'tile-face';

  const art = document.createElement('span');
  art.className = 'ref-art';

  const img = document.createElement('img');
  img.className = 'cover loaded';
  img.src = game.cover || game.image || '';
  img.alt = '';
  img.loading = 'eager';
  img.decoding = 'async';
  img.style.objectFit = 'cover';
  art.append(img);
  face.append(art);

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = game.name;

  btn.append(face, label);
  return btn;
}

function addRemoveControl(tile, game){
  let remove = tile.querySelector('.home-remove-x');
  if (!remove){
    remove = document.createElement('span');
    remove.className = 'home-remove-x';
    remove.setAttribute('role','button');
    remove.setAttribute('tabindex','-1');
    remove.setAttribute('aria-label', 'Remove ' + game.name + ' from Home screen');
    remove.title = 'Remove from Home screen';
    remove.textContent = '×';
    const face = tile.querySelector('.tile-face') || tile;
    face.append(remove);
  }
  remove.dataset.homeRemoveId = itemId(game);
  remove.dataset.homeRemoveTitle = game.name;
}

function promoteFirstGame(strip){
  const games = [...strip.querySelectorAll('.ref-tile[data-ref-title]')]
    .filter(tile => !tile.classList.contains('ref-friends'));
  games.forEach((tile, index) => {
    tile.classList.toggle('tile-hero', index === 0);
    tile.classList.toggle('ref-hero', index === 0);
    tile.classList.toggle('tile-sm', index !== 0);
  });
}

let applying = false;
async function applyHome(){
  if (applying) return;
  const root = document.getElementById('view-home');
  const strip = root?.querySelector('.ref-strip');
  if (!strip) return;

  applying = true;
  try {
    const games = await resolveHomeGames();
    const desired = new Map(games.map(game => [itemId(game), game]));

    /* Remove static/default tiles that the user has removed from Home, plus
       stale managed tiles from previous renders. */
    strip.querySelectorAll('.ref-tile[data-ref-title]').forEach(tile => {
      if (tile.classList.contains('ref-friends')) return;
      const title = tileTitle(tile);
      const defaultTitle = canonicalDefault(title);
      const staticId = defaultTitle ? 'default:' + norm(defaultTitle) : null;
      const managedId = tile.dataset.homeManagedId || staticId;
      if (!managedId || !desired.has(managedId)){
        tile.remove();
      }
    });

    /* Reconcile each desired game. Default static tiles are reused. Purchased
       games and previously removed defaults are rebuilt from Library data. */
    for (const game of games){
      const id = itemId(game);
      let tile = [...strip.querySelectorAll('.ref-tile[data-ref-title]')].find(node => {
        const nodeDefault = canonicalDefault(tileTitle(node));
        const nodeId = node.dataset.homeManagedId ||
          (nodeDefault ? 'default:' + norm(nodeDefault) : null);
        return nodeId === id;
      });

      if (!tile){
        tile = makeGameTile(game);
        const friends = strip.querySelector('.ref-friends');
        strip.insertBefore(tile, friends || null);
      }

      tile.dataset.homeManagedId = id;
      addRemoveControl(tile, game);
    }

    /* Match saved Home order without disturbing Friends / My games & apps. */
    const friends = strip.querySelector('.ref-friends');
    games.forEach(game => {
      const id = itemId(game);
      const tile = [...strip.querySelectorAll('.ref-tile[data-ref-title]')]
        .find(node => node.dataset.homeManagedId === id);
      if (tile) strip.insertBefore(tile, friends || null);
    });

    promoteFirstGame(strip);
    [...strip.children].forEach((node, i) => node.style.setProperty('--i', i));
    window.Nav?.repaint?.();
  } finally {
    applying = false;
  }
}

function confirmRemove(game){
  const message = 'Are you sure you want to remove this game from your homescreen';
  if (!window.App?.modal){
    if (confirm(message + '?')){
      removeFromHome(game);
      void applyHome();
    }
    return;
  }

  window.App.modal({
    title: message,
    text: game.name + ' will stay in your library and can be added back anytime.',
    actions:[
      {
        label:'Yes',
        onSelect:() => {
          removeFromHome(game);
          window.App?.toast?.('Removed from Home screen', game.name);
          void applyHome();
        }
      },
      { label:'No' }
    ]
  });
}

async function gameForRemoveNode(node){
  const id = node?.dataset?.homeRemoveId;
  if (!id) return null;
  const owned = await Cloud.ownedGames();
  return owned.find(game => itemId(game) === id) || null;
}

/* Clicking a Library game opens actions instead of immediately starting it.
   This gives every owned title a real Add to Home screen action. */
async function openLibraryGame(game){
  const onHome = isOnHome(game);
  window.App?.modal?.({
    title:game.name,
    text:onHome
      ? 'Owned • Cloud ready • On your Home screen'
      : 'Owned • Cloud ready',
    actions:[
      {
        label:'Start',
        onSelect:async () => {
          try { await Cloud.play(game); }
          catch (err){
            window.Sound?.error?.();
            window.App?.toast?.('Cloud gaming', err?.message || 'Could not start this game.');
          }
        }
      },
      {
        label:onHome ? 'Remove from Home screen' : 'Add to Home screen',
        onSelect:() => {
          if (onHome){
            removeFromHome(game);
            window.App?.toast?.('Removed from Home screen', game.name);
          } else {
            addToHome(game);
            window.App?.toast?.('Added to Home screen', game.name);
          }
          void applyHome();
        }
      },
      { label:'Back' }
    ]
  });
}

/* Run before cloud-library.js' bubble listener so the tile does not auto-play. */
document.addEventListener('click', event => {
  const remove = event.target.closest?.('.home-remove-x');
  if (remove){
    event.preventDefault();
    event.stopImmediatePropagation();
    void gameForRemoveNode(remove).then(game => {
      if (game) confirmRemove(game);
    });
    return;
  }

  const libraryTile = event.target.closest?.('#view-library .cloud-library-game[data-cloud-key]');
  if (!libraryTile) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  void Cloud.ownedGames().then(owned => {
    const game = owned.find(item => String(item.gameKey) === String(libraryTile.dataset.cloudKey));
    if (game) openLibraryGame(game);
  });
}, true);

window.addEventListener('xbox:home-change', () => void applyHome());
window.addEventListener('stratus:library-change', () => {
  window.CloudLibrary?.refresh?.();
  void applyHome();
});

const home = document.getElementById('view-home');
if (home){
  let queued = false;
  new MutationObserver(() => {
    if (queued || applying) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      void applyHome();
    });
  }).observe(home, { childList:true, subtree:true });
}

/* Expose a small shared surface for Store/Library/Home integrations. */
window.XboxHome = {
  DEFAULT_TITLES:[...DEFAULT_TITLES],
  isOnHome,
  add:game => { const changed = addToHome(game); void applyHome(); return changed; },
  remove:game => { const changed = removeFromHome(game); void applyHome(); return changed; },
  refresh:applyHome
};

void applyHome();
})();
