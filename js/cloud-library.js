/* Adds purchased Stratus cloud games to My games & apps.
   The core browser catalogue remains intact; owned cloud licenses appear as
   a controller-friendly shelf at the top of the full library and launch
   directly through Stratus. */
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
  btn.dataset.ringRadius = '.45rem';
  btn.setAttribute('aria-label', `${game.name}, cloud game`);
  btn.innerHTML = `
    <span class="cloud-library-cover">
      <img src="${escapeHtml(game.cover || game.image)}" alt="" decoding="async">
      <span class="cloud-library-badge">☁</span>
    </span>
    <span class="cloud-library-name">${escapeHtml(game.name)}</span>
    <span class="cloud-library-sub">Cloud • Ready to play</span>`;
  btn._navActivate = async () => {
    try { await Cloud.play(game); }
    catch (err){
      window.Sound?.error?.();
      window.App?.toast?.('Cloud gaming', err?.message || 'Could not start this game.');
    }
  };
  return btn;
}

async function mount(){
  if (!library || library.hidden || mounting) return;
  const page = library.querySelector('.page');
  const head = page?.querySelector('.page-head');
  if (!page || !head) return;
  mounting = true;
  const token = ++epoch;
  try {
    const owned = await Cloud.ownedGames();
    if (token !== epoch || library.hidden) return;

    page.querySelector('.cloud-library-section')?.remove();
    if (!owned.length) return;

    const section = document.createElement('section');
    section.className = 'cloud-library-section';
    section.innerHTML = `
      <div class="cloud-library-head">
        <div>
          <h2>Owned cloud games</h2>
          <p>Purchased from Microsoft Store • Ready to stream</p>
        </div>
        <span>${owned.length} owned</span>
      </div>`;
    const row = document.createElement('div');
    row.className = 'cloud-library-row';
    owned.forEach(game => row.append(tile(game)));
    section.append(row);
    head.insertAdjacentElement('afterend', section);
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
  }).observe(library, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden'] });
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
