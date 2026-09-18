/* Adds purchased Stratus cloud games to My games & apps.
   Purchased Store licenses are surfaced first so the library actually reflects
   what the signed-in profile owns, and every tile launches through Stratus. */
(() => {
'use strict';

const Cloud = window.StratusCloud;
if (!Cloud) return;

let epoch = 0;
let mounting = false;
const library = document.getElementById('view-library');

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}

function tile(game){
  const btn = document.createElement('button');
  btn.className = 'cloud-library-game';
  btn.dataset.nav = '';
  btn.dataset.cloudKey = game.gameKey;
  btn.dataset.ringRadius = '.58rem';
  btn.setAttribute('aria-label', `${game.name}, owned cloud game`);
  btn.innerHTML = `
    <span class="cloud-library-cover">
      <img src="${escapeHtml(game.cover || game.image)}" alt="" decoding="async">
      <span class="cloud-library-badge">☁</span>
    </span>
    <span class="cloud-library-name">${escapeHtml(game.name)}</span>
    <span class="cloud-library-sub">Owned • Cloud ready</span>`;
  btn._navActivate = async () => {
    try { await Cloud.play(game); }
    catch (err){
      window.Sound?.error?.();
      window.App?.toast?.('Cloud gaming', err?.message || 'Could not start this game.');
    }
  };
  return btn;
}

function buildSection(owned){
  const section = document.createElement('section');
  section.className = 'cloud-library-section cloud-library-primary';
  section.innerHTML = `
    <div class="cloud-library-head">
      <div>
        <h2>Owned games</h2>
        <p>Purchased from Microsoft Store • Ready to stream</p>
      </div>
      <span>${owned.length} owned</span>
    </div>`;

  const grid = document.createElement('div');
  grid.className = 'cloud-library-row cloud-library-owned-grid';
  owned.forEach(game => grid.append(tile(game)));
  section.append(grid);
  return section;
}

async function mount(){
  if (!library || library.hidden || mounting || library.dataset.stratusOnlyLibrary === '1') return;
  mounting = true;
  const token = ++epoch;

  try {
    const owned = await Cloud.ownedGames();
    if (token !== epoch || library.hidden) return;

    library.querySelectorAll('.cloud-library-section').forEach(node => node.remove());

    const main = library.querySelector('.console-main') || library.querySelector('.page');
    if (!main) return;

    const head = main.querySelector('.console-page-head') || main.querySelector('.page-head');
    if (!head) return;

    if (!owned.length){
      const empty = document.createElement('section');
      empty.className = 'cloud-library-section cloud-library-empty';
      empty.innerHTML = `
        <div class="cloud-library-head">
          <div>
            <h2>Owned games</h2>
            <p>Games you get from Microsoft Store will appear here.</p>
          </div>
          <span>0 owned</span>
        </div>`;
      head.insertAdjacentElement('afterend', empty);
      return;
    }

    head.insertAdjacentElement('afterend', buildSection(owned));
    window.Nav?.repaint?.();
  } finally {
    mounting = false;
  }
}

function refresh(){
  epoch++;
  requestAnimationFrame(() => mount());
}

if (library){
  new MutationObserver(() => {
    if (!library.hidden) requestAnimationFrame(() => mount());
  }).observe(library, { childList:true, attributes:true, attributeFilter:['hidden'] });
}

window.addEventListener('stratus:library-change', refresh);
window.State?.on?.(event => {
  if (event?.type === 'profile' || event?.type === 'reset') refresh();
});

document.addEventListener('click', event => {
  const btn = event.target.closest?.('#view-library .cloud-library-game');
  if (!btn || typeof btn._navActivate !== 'function') return;
  event.preventDefault();
  btn._navActivate(btn);
});

window.CloudLibrary = { refresh, mount };
})();