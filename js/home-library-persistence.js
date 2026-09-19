/* Persistent Xbox Home row + built-in ownership.
   Default Home games are treated as owned on every device. Home placement is
   separate from ownership, so removing a tile never removes it from Library. */
(() => {
'use strict';

const Cloud = window.StratusCloud;
if (!Cloud) return;

const HOME_KEY = 'xbox.home.screen.v2';
const LEGACY_HOME_KEYS = ['xbox.home.screen.v1','xbox.home.pins'];
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
    if (raw === null){
      const defaults = defaultHomeIds();
      try {
        LEGACY_HOME_KEYS.forEach(key => localStorage.removeItem(key));
        localStorage.setItem(HOME_KEY, JSON.stringify(defaults));
      } catch {}
      return defaults;
    }
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
    remove.setAttribute('aria-label', 'Remove ' + game.name + ' from Home Screen');
    remove.title = 'Remove from Home Screen';
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

/* applyHome() edits #view-home, and the observer at the bottom of this file
   watches #view-home for childList changes. Without this the pass re-entered
   itself every animation frame. The `applying` flag alone does not stop that:
   it is already false again by the time the observer's queued frame runs, so
   the guard below has to be the observer itself, disconnected across the
   edits and drained of its own records before it is reconnected. */
let homeObserver = null;
function pauseHomeObserver(){ homeObserver?.disconnect(); }
function resumeHomeObserver(){
  if (!homeObserver) return;
  const home = document.getElementById('view-home');
  if (!home) return;
  homeObserver.takeRecords();
  homeObserver.observe(home, { childList:true, subtree:true });
}

async function applyHome(){
  if (applying) return;
  const root = document.getElementById('view-home');
  const strip = root?.querySelector('.ref-strip');
  if (!strip) return;

  let games;
  try {
    games = await resolveHomeGames();
  } catch {
    /* House rule 5: a pass that cannot do its job leaves the app working.
       If the backend is unreachable, leave the row exactly as rendered. */
    return;
  }
  if (!games.length) return;

  applying = true;
  pauseHomeObserver();
  try {
    const desired = new Map(games.map(game => [itemId(game), game]));
    const wanted = new Set(readHomeIds());

    /* Remove static/default tiles that the user has removed from Home, plus
       stale managed tiles from previous renders. */
    strip.querySelectorAll('.ref-tile[data-ref-title]').forEach(tile => {
      if (tile.classList.contains('ref-friends')) return;
      const title = tileTitle(tile);
      const defaultTitle = canonicalDefault(title);
      const staticId = defaultTitle ? 'default:' + norm(defaultTitle) : null;
      const managedId = tile.dataset.homeManagedId || staticId;
      /* A default title the user still wants on Home stays even when the
         cloud cannot describe it. Minecraft is the live case: it is the
         locally vendored launcher, so it never appears in ownedGames() and
         this loop was deleting its tile on every render. */
      if (staticId && wanted.has(staticId)) return;
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

    /* Match saved Home order without disturbing Friends / My games & apps.
       insertBefore() on a node that is already in place still counts as a
       remove plus an insert, so doing this unconditionally churned the row
       every frame and restarted each tile's entry animation, which holds
       opacity at 0 - the tiles were present and their art loaded, they were
       simply never allowed to finish fading in. Only move when the order is
       actually wrong. */
    const friends = strip.querySelector('.ref-friends');
    const ordered = games
      .map(game => [...strip.querySelectorAll('.ref-tile[data-ref-title]')]
        .find(node => node.dataset.homeManagedId === itemId(game)))
      .filter(Boolean);
    const current = [...strip.querySelectorAll('.ref-tile[data-home-managed-id]')];
    const inOrder = ordered.length === current.length &&
      ordered.every((tile, index) => tile === current[index]);
    if (!inOrder) ordered.forEach(tile => strip.insertBefore(tile, friends || null));

    promoteFirstGame(strip);
    [...strip.children].forEach((node, i) => node.style.setProperty('--i', i));
    window.Nav?.repaint?.();
  } finally {
    applying = false;
    resumeHomeObserver();
  }
}

let removePrompt = null;

function closeRemovePrompt({ restoreFocus=true } = {}){
  if (!removePrompt) return;
  const layer = removePrompt;
  const source = layer._sourceTile;
  removePrompt = null;
  try { window.Nav?.popLayer?.(); } catch {}
  layer.classList.add('out');
  setTimeout(() => layer.remove(), 150);
  if (restoreFocus && source?.isConnected){
    requestAnimationFrame(() => {
      try { window.Nav?.focus?.(source); }
      catch { try { source.focus?.(); } catch {} }
    });
  }
}

function confirmRemove(game, sourceTile){
  closeRemovePrompt({ restoreFocus:false });

  const layer = document.createElement('div');
  layer.className = 'home-remove-confirm';
  layer.setAttribute('role','presentation');
  layer._sourceTile = sourceTile || null;

  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'home-remove-confirm-scrim';
  scrim.setAttribute('aria-label','Cancel');
  scrim.addEventListener('click', () => closeRemovePrompt());

  const panel = document.createElement('section');
  panel.className = 'home-remove-confirm-panel';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-labelledby','home-remove-confirm-title');

  const art = document.createElement('div');
  art.className = 'home-remove-confirm-art';
  const image = game?.cover || game?.image || '';
  if (image) art.style.backgroundImage = `url("${String(image).replace(/"/g, '%22')}")`;

  const copy = document.createElement('div');
  copy.className = 'home-remove-confirm-copy';
  copy.innerHTML = `
    <h2 id="home-remove-confirm-title">Remove ${String(game.name || 'this game')} from Home?</h2>
    <p>This only removes the tile from Home. The game stays in My games &amp; apps, so you can add it back anytime.</p>
  `;

  const actions = document.createElement('div');
  actions.className = 'home-remove-confirm-actions';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.dataset.nav = '';
  remove.className = 'home-remove-confirm-remove';
  remove.textContent = 'Remove from Home';
  remove._navActivate = () => {
    removeFromHome(game);
    window.App?.toast?.('Removed from Home', game.name);
    closeRemovePrompt({ restoreFocus:false });
    void applyHome();
  };
  remove.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    remove._navActivate();
  });

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.dataset.nav = '';
  cancel.className = 'home-remove-confirm-cancel';
  cancel.textContent = 'Cancel';
  cancel._navActivate = () => closeRemovePrompt();
  cancel.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeRemovePrompt();
  });

  actions.append(remove, cancel);
  copy.append(actions);
  panel.append(art, copy);
  layer.append(scrim, panel);
  document.body.append(layer);
  removePrompt = layer;

  try { window.Nav?.pushLayer?.(layer); } catch {}
  requestAnimationFrame(() => {
    layer.classList.add('in');
    try { window.Nav?.focusIn?.(layer, '.home-remove-confirm-remove'); }
    catch { remove.focus?.(); }
  });
}

async function gameForRemoveNode(node){
  const id = node?.dataset?.homeRemoveId;
  if (!id) return null;
  const owned = await Cloud.ownedGames();
  return owned.find(game => itemId(game) === id) || null;
}

/* Clicking a Library game opens actions instead of immediately starting it.
   This gives every owned title a real Add to Home Screen action. */
async function openLibraryGame(game){
  const onHome = isOnHome(game);
  window.App?.modal?.({
    title:game.name,
    text:onHome
      ? 'Owned • Cloud ready • On your Home Screen'
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
        label:onHome ? 'Remove from Home Screen' : 'Add to Home Screen',
        onSelect:() => {
          if (onHome){
            removeFromHome(game);
            window.App?.toast?.('Removed from Home Screen', game.name);
          } else {
            addToHome(game);
            window.App?.toast?.('Added to Home Screen', game.name);
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
    const sourceTile = remove.closest?.('.ref-tile');
    void gameForRemoveNode(remove).then(game => {
      if (game) confirmRemove(game, sourceTile);
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

window.addEventListener('nav:button', event => {
  if (removePrompt && event.detail?.button === 'b'){
    event.stopImmediatePropagation?.();
    closeRemovePrompt();
  }
}, true);

document.addEventListener('keydown', event => {
  if (removePrompt && event.key === 'Escape'){
    event.preventDefault();
    event.stopImmediatePropagation();
    closeRemovePrompt();
  }
}, true);

window.addEventListener('xbox:home-change', () => void applyHome());
window.addEventListener('stratus:library-change', () => {
  window.CloudLibrary?.refresh?.();
  void applyHome();
});

const home = document.getElementById('view-home');
if (home){
  let queued = false;
  homeObserver = new MutationObserver(() => {
    if (queued || applying) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      void applyHome();
    });
  });
  homeObserver.observe(home, { childList:true, subtree:true });
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
