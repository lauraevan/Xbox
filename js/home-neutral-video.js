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
/* Safari reads the attributes, not the properties, and will refuse to
   autoplay inline without them. */
video.setAttribute('muted', '');
video.setAttribute('playsinline', '');
video.setAttribute('webkit-playsinline', '');

/* Pick the encode before anything is fetched. index.html carries the 1080p
   H.264 as the universally decodable fallback; upgrade to WebM where it is
   supported, and drop to the 720p pair on phones and tablets - 1.0MB instead
   of 3.7MB, and a far cheaper decode. */
function chooseSource(){
  /* Highest-quality local encode only. No 720p/mobile downgrade and no
     smaller WebM substitution. */
  const next = 'assets/wallpaper/waves-1080.mp4';
  if (!video.src.endsWith(next)) video.src = next;
}

/* Every one of these is a reason not to spend a phone's battery or data.
   The poster still shows, so the canvas is never empty. */
function permitted(){
  let set = {};
  try { set = window.State?.settings || {}; } catch {}
  const mode = set.wallpaperMode || 'waves';
  if (mode !== 'waves') return false;
  if ((set.wallpaperBehavior || 'dynamic') !== 'dynamic') return false;
  if ((set.wallpaperMotion || 'normal') === 'off') return false;
  if (set.motion === 'reduced') return false;
  if (reducedMotion?.matches) return false;
  return true;
}

/* Only reach for the clip at all when it is allowed. On an opted-out device
   the element keeps its poster and nothing beyond it is ever requested. */
if (permitted()) chooseSource();
else video.removeAttribute('src');

let failed = false;
let playPending = false;

function shouldPlay(){
  /* home-catalog-pass starts its own full-screen Waves clip on the lower
     shelf from onHomeScroll. Two 1080p videos decoding at once is what makes
     a phone stutter and run hot, and only one of them is ever on screen, so
     hand off at the same scroll seam it uses. */
  const scrolled = (document.getElementById('view-home')?.scrollTop || 0) >= 40;
  return !failed
    && !document.hidden
    && !scrolled
    && permitted()
    && document.body.dataset.view === 'home'
    && document.body.dataset.homeNeutral === 'true'
    && !reducedMotion?.matches;
}

function sync(){
  let set = {};
  try { set = window.State?.settings || {}; } catch {}
  video.playbackRate = (set.wallpaperMotion || 'normal') === 'low' ? .65 : 1;
  const active = shouldPlay();
  document.body.classList.toggle('home-neutral-video-active', active);

  if (active){
    if (!video.paused || playPending) return;
    playPending = true;
    const attempt = video.play();
    if (attempt?.then){
      attempt.then(() => {
        playPending = false;
      }).catch(() => {
        playPending = false;
        /* Autoplay refusal degrades cleanly to the black fallback. */
      });
    } else {
      playPending = false;
    }
  } else {
    playPending = false;
    if (!video.paused) video.pause();
  }
}

video.addEventListener('playing', () => {
  playPending = false;
  document.body.classList.add('home-neutral-video-ready');
});

video.addEventListener('pause', () => {
  playPending = false;
});

video.addEventListener('error', () => {
  failed = true;
  playPending = false;
  document.body.classList.remove('home-neutral-video-active', 'home-neutral-video-ready');
  video.hidden = true;
});

new MutationObserver(sync).observe(document.body, {
  attributes:true,
  attributeFilter:['data-view','data-home-neutral','data-wallpaper-mode','data-wallpaper-behavior']
});

document.addEventListener('visibilitychange', sync, { passive:true });
window.addEventListener('pageshow', sync, { passive:true });
window.addEventListener('pagehide', () => {
  if (!video.paused) video.pause();
  playPending = false;
}, { passive:true });

reducedMotion?.addEventListener?.('change', sync);
window.State?.on?.(event => {
  if (event?.type !== 'settings') return;
  if (!video.src && permitted()) chooseSource();
  sync();
});

/* Home is its own scroller; coalesce to one check per frame. */
let scrollQueued = false;
document.getElementById('view-home')?.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => { scrollQueued = false; sync(); });
}, { passive:true });

sync();
})();
