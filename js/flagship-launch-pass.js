/* Minimal flagship treatment for the existing launch surface.
   Uses only the real title/art/status already supplied by the game session. */
(() => {
'use strict';

const launch = document.getElementById('launch');
const center = launch?.querySelector('.launch-center');
const title = document.getElementById('launchTitle');
const sub = launch?.querySelector('.launch-sub');
if (!launch || !center || !title || !sub) return;

if (!center.querySelector('.launch-brand')){
  const brand = document.createElement('div');
  brand.className = 'launch-brand';
  brand.setAttribute('aria-hidden','true');
  brand.innerHTML = `
    <svg viewBox="0 0 48 48"><path d="M24 3.5a20.5 20.5 0 1 0 0 41 20.5 20.5 0 0 0 0-41Zm-7.8 5.4c2.3-1.2 5-1.9 7.8-1.9s5.5.7 7.8 1.9c-2.4 1.4-5 3.5-7.8 6.3-2.8-2.8-5.4-4.9-7.8-6.3Zm-6.8 5.7c1-1.3 2.1-2.4 3.4-3.4 2.7 1.1 5.6 3.3 8.7 6.4-4.8 5.2-8.6 10.4-11.4 15.7A16.7 16.7 0 0 1 7 24c0-3.5 1-6.7 2.4-9.4Zm14.6 26a16.8 16.8 0 0 1-11-4c2.8-5.4 6.5-10.7 11-15.7 4.5 5 8.2 10.3 11 15.7a16.8 16.8 0 0 1-11 4Zm13.9-7.3c-2.8-5.3-6.6-10.5-11.4-15.7 3.1-3.1 6-5.3 8.7-6.4A17 17 0 0 1 41 24c0 3.3-.9 6.5-3.1 9.3Z"/></svg>
    <span>XBOX</span>`;
  center.prepend(brand);
}

if (!center.querySelector('.launch-status-rail')){
  const rail = document.createElement('div');
  rail.className = 'launch-status-rail';
  rail.setAttribute('aria-hidden','true');
  center.append(rail);
}

if (!center.querySelector('.launch-footnote')){
  const note = document.createElement('div');
  note.className = 'launch-footnote';
  note.textContent = 'Xbox Cloud Gaming';
  center.append(note);
}

function refreshState(){
  if (launch.hidden) return;
  launch.classList.remove('flagship-enter');
  void launch.offsetWidth;
  launch.classList.add('flagship-enter');
}

new MutationObserver(records => {
  for (const record of records){
    if (record.type === 'attributes' && record.attributeName === 'hidden') refreshState();
  }
}).observe(launch,{ attributes:true, attributeFilter:['hidden'] });

new MutationObserver(() => {
  const text = sub.textContent?.trim() || '';
  launch.dataset.status = text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}).observe(sub,{ childList:true, subtree:true, characterData:true });

window.addEventListener('stratus:library-change', () => {});
})();
