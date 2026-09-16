/* ═══════════════════════════════════════════════════════════
   MEDIA — cover loading that survives a hostile network.

   The catalogue's covers average ~80KB and run past 400KB, and a
   home screen asks for two dozen at once. Firing them all in
   parallel at one host is what gets them rate-limited, and a single
   failed request used to kill a tile permanently.

   So: a bounded queue, a chain of mirrors, and retries.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* jsDelivr publishes several interchangeable edges; when one is blocked
   or throttled the others frequently still answer. raw.githubusercontent
   is the origin. wsrv is last because it also shrinks the payload, which
   is the best thing to be holding when the network is the problem. */
const COVER_SOURCES = [
  id => `https://cdn.jsdelivr.net/gh/bestsabplayerox/covers@main/${id}`,
  id => `https://fastly.jsdelivr.net/gh/bestsabplayerox/covers@main/${id}`,
  id => `https://gcore.jsdelivr.net/gh/bestsabplayerox/covers@main/${id}`,
  id => `https://raw.githubusercontent.com/bestsabplayerox/covers/main/${id}`,
  id => `https://wsrv.nl/?w=420&output=webp&q=82&url=` +
        encodeURIComponent(`raw.githubusercontent.com/bestsabplayerox/covers/main/${id}`)
];

const MAX_PARALLEL = 6;
const ATTEMPT_TIMEOUT = 9000;
const DEAD_TIMEOUT = 2500;     // a mirror that keeps failing gets less patience

let active = 0;
const queue = [];

/* Networks that block one CDN block it for every request, so paying a full
   timeout per image is wasted. Track how each mirror is doing and try the
   healthy ones first; a mirror that has failed repeatedly drops to the back
   and gets a shorter leash. It can still recover — one success clears it. */
const health = COVER_SOURCES.map(() => 0);

const order = () =>
  COVER_SOURCES
    .map((build, i) => ({ build, i }))
    .sort((a, b) => health[a.i] - health[b.i] || a.i - b.i);

const timeoutFor = i => (health[i] >= 3 ? DEAD_TIMEOUT : ATTEMPT_TIMEOUT);

function pump(){
  while (active < MAX_PARALLEL && queue.length){
    const job = queue.shift();
    if (job.cancelled) continue;
    active++;
    job.run().finally(() => { active--; pump(); });
  }
}

/** Load one URL into an off-document Image, with its own timeout. */
function attempt(url, limit = ATTEMPT_TIMEOUT){
  return new Promise((resolve, reject) => {
    const probe = new Image();
    let settled = false;
    const done = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      probe.onload = probe.onerror = null;
      ok ? resolve(url) : reject(new Error('failed ' + url));
    };
    const timer = setTimeout(() => { probe.src = ''; done(false); }, limit);
    probe.onload  = () => done(probe.naturalWidth > 0);
    probe.onerror = () => done(false);
    probe.decoding = 'async';
    probe.src = url;
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/**
 * Resolve a cover through the mirror chain, then hand the winning URL to
 * the <img>. Two passes over the chain, with a short backoff between, so
 * a transient throttle does not leave a permanent hole in the grid.
 */
function enqueue(file, { onURL, onFail, passes = 2, priority = false }){
  const job = {
    cancelled: false,
    priority,
    async run(){
      for (let pass = 0; pass < passes; pass++){
        for (const { build, i } of order()){
          if (job.cancelled) return;
          try {
            const url = await attempt(build(file), timeoutFor(i));
            if (job.cancelled) return;
            health[i] = 0;                 // this mirror is answering again
            onURL(url);                    // already warm in cache
            return;
          } catch {
            health[i] = Math.min(health[i] + 1, 50);
          }
        }
        await wait(600 + pass * 900);
      }
      if (!job.cancelled) onFail?.();
    }
  };
  // large, prominent art (promo cards, backdrops) jumps the queue, otherwise
  // it starves behind two dozen small tiles and the card shows bare colour
  if (priority) queue.unshift(job); else queue.push(job);
  pump();
  return () => { job.cancelled = true; };
}

function loadCover(file, img, { onFail, priority } = {}){
  return enqueue(file, {
    onURL: url => { img.src = url; img.classList.add('loaded'); },
    onFail, priority
  });
}

/** Same chain, but hands back the URL for backgrounds and mosaics. */
function resolveCover(file, onURL, onFail, opts = {}){
  return enqueue(file, { onURL, onFail, passes: 2, priority: opts.priority !== false });
}

/** Deterministic hue so a placeholder is stable for a given title. */
function placeholderHue(seed){
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

window.Media = {
  loadCover, resolveCover, placeholderHue, COVER_SOURCES,
  health: () => health.slice()
};
})();
