/* High-weight Xbox motion choreography. CSS owns movement; this file only
   marks new surfaces and orders their entrance, so it never runs per-frame. */
(() => {
'use strict';

const html = document.documentElement;
const stage = document.getElementById('stage');
const itemSelector = [
  '[data-nav]',
  '.store-game',
  '.console-poster',
  '.xstore-mini-promo',
  '.console-settings-row',
  '.search-result'
].join(',');

function visible(node){
  return node instanceof HTMLElement && !node.hidden && node.getClientRects().length > 0;
}

function restart(node, className, lifetime = 900){
  if (!(node instanceof HTMLElement)) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  setTimeout(() => node.classList.remove(className), lifetime);
}

function stagger(root){
  if (!(root instanceof Element)) return;
  [...root.querySelectorAll(itemSelector)]
    .filter(visible)
    .slice(0, 36)
    .forEach((node, index) => {
      node.style.setProperty('--x-motion-index', String(index));
      restart(node, 'xbox-item-enter', 900 + index * 27);
    });
}

function enterView(view){
  if (!visible(view)) return;
  restart(view, 'xbox-view-enter', 760);
  requestAnimationFrame(() => stagger(view));
}

function currentView(){
  return document.querySelector('.view:not([hidden])');
}

html.classList.add('xbox-motion-ready');
let stagePlayed = false;
function playStage(){
  if (!stage || stage.hidden || stagePlayed) return;
  stagePlayed = true;
  stage.classList.add('xbox-motion-stage');
  setTimeout(() => stage.classList.remove('xbox-motion-stage'), 1100);
  requestAnimationFrame(() => enterView(currentView()));
}

[...document.querySelectorAll('.sysnav-btn, .profile, .sysstatus > *')]
  .forEach((node, index) => node.style.setProperty('--x-motion-index', String(index)));

requestAnimationFrame(playStage);

const observer = new MutationObserver(records => {
  let viewChanged = false;
  const additions = new Set();
  for (const record of records){
    if (record.type === 'attributes' && record.attributeName === 'hidden'){
      if (record.target === stage && !stage.hidden) playStage();
      if (record.target.matches?.('.view') && !record.target.hidden) viewChanged = true;
      if (record.target.matches?.('.guide, .modal, .detail, .launch') && !record.target.hidden)
        stagger(record.target);
    }
    for (const node of record.addedNodes){
      if (node instanceof HTMLElement) additions.add(node);
    }
  }
  if (viewChanged) requestAnimationFrame(() => enterView(currentView()));
  if (additions.size){
    requestAnimationFrame(() => additions.forEach(node => {
      if (node.matches?.(itemSelector)) restart(node, 'xbox-item-enter');
      stagger(node);
    }));
  }
});

observer.observe(document.body, {
  subtree:true,
  childList:true,
  attributes:true,
  attributeFilter:['hidden']
});

window.addEventListener('nav:focus', event => {
  const node = event.detail?.el;
  if (!node) return;
  restart(node, 'xbox-focus-kick', 430);
});
})();
