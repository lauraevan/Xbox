/* Minimal My games & apps interaction pass.
   Selecting a cover opens a small Xbox-style action flyout instead of
   immediately launching the title. */
(() => {
'use strict';

const root = document.getElementById('view-library');
if (!root) return;

const originalActivations = new WeakMap();
let menu = null;
let selectedCard = null;
let queued = false;

const keyFor = card => String(
  card?.dataset?.ownedStoreGame ||
  card?.getAttribute?.('aria-label') ||
  'game'
);

function readList(key){
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function writeList(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function toggleSaved(storageKey, value){
  const list = readList(storageKey);
  const i = list.indexOf(value);
  if (i >= 0){
    list.splice(i, 1);
    writeList(storageKey, list);
    return false;
  }
  list.unshift(value);
  writeList(storageKey, list.slice(0, 40));
  return true;
}

function closeMenu({ restoreFocus = true } = {}){
  const card = selectedCard;
  menu?.remove();
  menu = null;
  selectedCard?.classList.remove('library-menu-open');
  selectedCard = null;

  if (restoreFocus && card?.isConnected){
    try { window.Nav?.focus?.(card); }
    catch { try { card.focus?.(); } catch {} }
  }
}

function placeMenu(card, flyout){
  const r = card.getBoundingClientRect();
  const width = Math.min(280, Math.max(244, window.innerWidth * .22));
  let left = r.left;
  const top = r.bottom + 10;

  if (left + width > window.innerWidth - 18) left = window.innerWidth - width - 18;
  if (left < 18) left = 18;

  /* The Xbox action flyout always grows downward from the selected cover.
     Never flip it above the game. On short screens it becomes scrollable. */
  flyout.style.width = `${Math.round(width)}px`;
  flyout.style.left = `${Math.round(left)}px`;
  flyout.style.top = `${Math.round(top)}px`;
  flyout.style.maxHeight = `${Math.max(150, window.innerHeight - top - 18)}px`;
}

function makeAction(label, run){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.nav = '';
  btn.textContent = label;
  btn._navActivate = () => run(btn);
  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    run(btn);
  });
  return btn;
}

function openMenu(card){
  if (!card?.isConnected) return;
  if (selectedCard === card && menu){
    closeMenu();
    return;
  }

  closeMenu({ restoreFocus:false });
  selectedCard = card;
  card.classList.add('library-menu-open');

  const title = card.getAttribute('aria-label') || 'Game';
  const gameKey = keyFor(card);
  const original = originalActivations.get(card);
  const flyout = document.createElement('div');
  flyout.className = 'library-game-menu';
  flyout.setAttribute('role', 'menu');
  flyout.setAttribute('aria-label', `${title} options`);

  flyout.append(
    makeAction('Play game', () => {
      closeMenu({ restoreFocus:false });
      if (typeof original === 'function') original(card);
      else window.App?.toast?.('Play game', title);
    }),
    makeAction('Pin to Quick Guide', () => {
      const pinned = toggleSaved('xbox.quick-guide.pins', gameKey);
      window.App?.toast?.(pinned ? 'Pinned to Quick Guide' : 'Removed from Quick Guide', title);
      closeMenu();
    }),
    makeAction('Manage game and add-ons', () => {
      window.App?.toast?.('Manage game and add-ons', title);
      closeMenu();
    }),
    makeAction('Add to Home', () => {
      const added = toggleSaved('xbox.home.pins', gameKey);
      window.App?.toast?.(added ? 'Added to Home' : 'Removed from Home', title);
      closeMenu();
    })
  );

  document.body.append(flyout);
  menu = flyout;
  placeMenu(card, flyout);

  requestAnimationFrame(() => {
    const first = flyout.querySelector('button');
    try { window.Nav?.focusIn?.(flyout, 'button'); }
    catch { try { first?.focus?.(); } catch {} }
  });
}

function patchCard(card){
  if (!(card instanceof HTMLElement) || card.dataset.libraryMenuWired === '1') return;
  card.dataset.libraryMenuWired = '1';
  originalActivations.set(card, card._navActivate);
  card._navActivate = () => openMenu(card);
}

function patchLibrary(){
  if (root.hidden) return;

  const title = root.querySelector('.console-page-head h1');
  if (title) title.textContent = 'My games & apps';

  const cards = [...root.querySelectorAll('.console-poster')];
  cards.forEach(patchCard);

  if (cards.length && !root.querySelector('.console-poster[data-focused]') && !menu){
    requestAnimationFrame(() => {
      if (!root.hidden && !menu){
        try { window.Nav?.focusIn?.(root, '.console-poster'); } catch {}
      }
    });
  }
}

function queuePatch(){
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    patchLibrary();
  });
}

new MutationObserver(queuePatch).observe(root, {
  childList:true,
  subtree:true,
  attributes:true,
  attributeFilter:['hidden']
});

/* Capture game-cover clicks before older library handlers can launch directly. */
document.addEventListener('click', event => {
  if (menu?.contains(event.target)) return;

  const card = event.target.closest?.('#view-library .console-poster');
  if (card){
    event.preventDefault();
    event.stopImmediatePropagation();
    openMenu(card);
    return;
  }

  if (menu) closeMenu({ restoreFocus:false });
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu){
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  }
}, true);

window.addEventListener('nav:button', event => {
  if (menu && event.detail?.button === 'b'){
    event.preventDefault?.();
    closeMenu();
  }
});

window.addEventListener('resize', () => {
  if (menu && selectedCard) placeMenu(selectedCard, menu);
});

patchLibrary();
})();
