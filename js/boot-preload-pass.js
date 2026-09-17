/* Xbox boot warm-up pass.
   Keeps the startup screen up long enough for the dashboard's first frame,
   fonts, Home covers and initial hero artwork to be ready underneath it. */
(() => {
'use strict';

const boot = document.getElementById('boot');
if (!boot) return;

const started = performance.now();
const MIN_BOOT_MS = 4500;
const WARM_CAP_MS = 7000;
const IMAGE_CAP_MS = 2200;

let ready = false;
let exitRequested = false;
const originalRemove = Element.prototype.remove;

/* app.js owns the boot animation. If it finishes before warm-up does, keep the
   same boot surface on screen instead of exposing a half-painted dashboard. */
Element.prototype.remove = function(){
  if (this === boot && !ready){
    exitRequested = true;
    return;
  }
  return originalRemove.call(this);
};

const classWatch = new MutationObserver(() => {
  if (!ready && boot.classList.contains('out')){
    exitRequested = true;
    boot.classList.remove('out');
  }
});
classWatch.observe(boot, { attributes:true, attributeFilter:['class'] });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

function timeout(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForCatalog(){
  const deadline = performance.now() + 6200;
  while (performance.now() < deadline){
    try {
      if (window.Catalog?.count?.() > 0) return true;
    } catch {}
    await sleep(40);
  }
  return false;
}

function waitImage(img){
  if (!img) return Promise.resolve();
  if (img.complete && img.naturalWidth > 0){
    return img.decode?.().catch(() => {}) || Promise.resolve();
  }
  return new Promise(resolve => {
    const done = () => resolve();
    img.addEventListener('load', done, { once:true });
    img.addEventListener('error', done, { once:true });
  });
}

async function warmHome(){
  const stage = document.getElementById('stage');
  const home = document.getElementById('view-home');
  if (!stage || !home || !window.App) return;

  /* The boot screen is z-indexed above the stage, so this can fully lay out
     and paint in the background without the user seeing the setup work. */
  stage.hidden = false;
  window.App.setView?.('home');
  window.App.paintIcons?.(stage);

  await frame();
  await frame();

  const fontReady = document.fonts?.ready?.catch?.(() => {}) || Promise.resolve();
  const images = [...home.querySelectorAll('img')].slice(0, 18);
  const imageReady = Promise.allSettled(images.map(waitImage));

  /* Warm the first few dashboard wallpapers as well. Artwork.hero already
     validates and caches the resolved widescreen image. */
  const titles = [...home.querySelectorAll('[data-ref-title]')]
    .map(node => node.dataset.refTitle)
    .filter(Boolean)
    .slice(0, 4);
  const artReady = Promise.allSettled(
    titles.map(title => window.Artwork?.hero?.(title)).filter(Boolean)
  );

  await Promise.race([
    Promise.allSettled([fontReady, imageReady, artReady]),
    timeout(IMAGE_CAP_MS)
  ]);

  /* Give layout/decoding one last pair of frames so the reveal starts from a
     completed frame rather than immediately after an image-load callback. */
  await frame();
  await frame();
}

async function warm(){
  try {
    const hasCatalog = await waitForCatalog();
    if (hasCatalog) await warmHome();

    const remaining = MIN_BOOT_MS - (performance.now() - started);
    if (remaining > 0) await sleep(remaining);
  } catch {}
}

async function release(){
  await Promise.race([warm(), timeout(WARM_CAP_MS)]);
  ready = true;
  classWatch.disconnect();
  Element.prototype.remove = originalRemove;

  /* If app.js already asked to leave the boot screen, perform its normal
     600 ms Xbox fade now. Otherwise the video is still playing and app.js
     will dismiss it normally when it ends. */
  if (exitRequested && boot.isConnected){
    boot.classList.add('out');
    setTimeout(() => {
      if (boot.isConnected) originalRemove.call(boot);
    }, 620);
  }
}

/* This file is loaded after app.js but before DOMContentLoaded fires. app.js
   begins loading the catalogue first, then this warm-up works in parallel. */
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', release, { once:true });
} else {
  release();
}
})();
