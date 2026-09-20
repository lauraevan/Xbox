/* Lightweight neutral Home video background.
   One persistent element, never recreated during navigation. */
(() => {
'use strict';

const video = document.getElementById('homeNeutralVideo');
if (!video) return;

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

video.defaultMuted = true;
video.muted = true;
video.playsInline = true;

let failed = false;
let playing = false;

function shouldPlay(){
  return !failed
    && !document.hidden
    && document.body.dataset.view === 'home'
    && document.body.dataset.homeNeutral === 'true'
    && !reducedMotion?.matches;
}

function sync(){
  const active = shouldPlay();
  document.body.classList.toggle('home-neutral-video-active', active);

  if (active){
    if (!playing){
      const attempt = video.play();
      if (attempt?.catch) attempt.catch(() => {
        /* Autoplay refusal degrades cleanly to the black fallback. */
      });
      playing = true;
    }
  } else {
    if (!video.paused) video.pause();
    playing = false;
  }
}

video.addEventListener('playing', () => {
  playing = true;
  document.body.classList.add('home-neutral-video-ready');
});

video.addEventListener('pause', () => {
  playing = false;
});

video.addEventListener('error', () => {
  failed = true;
  playing = false;
  document.body.classList.remove('home-neutral-video-active', 'home-neutral-video-ready');
  video.hidden = true;
});

new MutationObserver(sync).observe(document.body, {
  attributes:true,
  attributeFilter:['data-view','data-home-neutral']
});

document.addEventListener('visibilitychange', sync, { passive:true });
window.addEventListener('pageshow', sync, { passive:true });
window.addEventListener('pagehide', () => {
  if (!video.paused) video.pause();
  playing = false;
}, { passive:true });

reducedMotion?.addEventListener?.('change', sync);
sync();
})();
