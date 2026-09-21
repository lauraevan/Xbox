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
   H.264 as the universally decodable fallback.
   Highest-quality local encodes only - no 720p downgrade. Both are 1080p of
   the same clip; WebM is preferred where it decodes because it is half the
   bytes (1.9MB against 3.7MB), and H.264 is the universal fallback Safari
   and iOS need. Measured in a Chromium without proprietary codecs:
   canPlayType('video/mp4; codecs="avc1.42E01E"') === '' and the mp4 raised
   MEDIA_ERR_SRC_NOT_SUPPORTED (code 4), which used to hide the element for
   good and leave Home flat black with no way back. */
const SOURCES = [
  { src:'assets/wallpaper/waves-1080.webm', type:'video/webm; codecs="vp9"' },
  { src:'assets/wallpaper/waves-1080.mp4',  type:'video/mp4; codecs="avc1.42E01E"' }
];
let sourceIndex = -1;

function orderedSources(){
  const playable = SOURCES.filter(s => video.canPlayType?.(s.type));
  /* canPlayType can answer '' for something the browser will in fact play,
     so never end up with an empty list. */
  return playable.length ? playable : SOURCES;
}

function chooseSource(){
  const list = orderedSources();
  /* index.html already points at the mp4, so leave it alone on a browser
     that can decode it rather than starting a second fetch. */
  const current = list.findIndex(s => video.src.endsWith(s.src));
  if (current >= 0){ sourceIndex = current; return; }
  sourceIndex = 0;
  video.src = list[0].src;
}

/* One retry on the other encode before giving up on the clip entirely. */
function nextSource(){
  const list = orderedSources();
  if (sourceIndex < 0 || sourceIndex >= list.length - 1) return false;
  sourceIndex += 1;
  video.src = list[sourceIndex].src;
  video.load();
  return true;
}

/* Every one of these is a reason not to spend a phone's battery or data.
   The poster still shows, so the canvas is never empty. */
function permitted(){
  let set = {};
  try { set = window.State?.settings || {}; } catch {}
  const mode = set.wallpaperMode || 'waves';
  if (!['waves','waves-blue','waves-red','waves-gold'].includes(mode)) return false;
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
  playPending = false;
  if (permitted() && nextSource()){
    sync();
    return;
  }
  failed = true;
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
  if (permitted() && (!video.src || failed)){
    failed = false;
    video.hidden = false;
    chooseSource();
  }
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
