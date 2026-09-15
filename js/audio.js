/* ═══════════════════════════════════════════════════════════
   AUDIO — UI feedback synthesised with WebAudio.
   Short envelopes so navigation feels tactile, nothing sampled.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

let ctx = null;
let bus = null;

function ensure(){
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  bus = ctx.createGain();
  bus.gain.value = 0.22;
  bus.connect(ctx.destination);
  return ctx;
}

const enabled = () => window.State?.settings.sounds !== false;

/** One shaped tone. */
function tone({ freq = 660, dur = .09, type = 'sine', gain = 1, delay = 0, slideTo = null, attack = .006 }){
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;

  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(env).connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + .02);
}

/** Filtered noise burst — used for the guide swoosh. */
function noise({ dur = .3, gain = .5, from = 400, to = 2400, q = 3 }){
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const chan = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) chan[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);

  const env = c.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(env).connect(bus);
  src.start(t0);
}

const Sound = {
  unlock(){
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  },

  move(){ if (enabled()) tone({ freq: 1180, dur: .045, type: 'triangle', gain: .28 }); },

  select(){
    if (!enabled()) return;
    tone({ freq: 740, dur: .07, type: 'triangle', gain: .5 });
    tone({ freq: 1108, dur: .1, type: 'sine', gain: .42, delay: .045 });
  },

  back(){
    if (!enabled()) return;
    tone({ freq: 620, dur: .09, type: 'triangle', gain: .38, slideTo: 380 });
  },

  edge(){ if (enabled()) tone({ freq: 240, dur: .05, type: 'sine', gain: .18 }); },

  guide(open){
    if (!enabled()) return;
    noise({ dur: .34, gain: .3, from: open ? 300 : 2200, to: open ? 2600 : 300 });
    tone({ freq: open ? 420 : 520, dur: .18, type: 'sine', gain: .3, slideTo: open ? 700 : 300 });
  },

  launch(){
    if (!enabled()) return;
    [392, 523, 659, 784].forEach((f, i) =>
      tone({ freq: f, dur: .42, type: 'sine', gain: .32, delay: i * .085 }));
    noise({ dur: .9, gain: .12, from: 200, to: 1600, q: 1.2 });
  },

  achievement(){
    if (!enabled()) return;
    [659, 784, 988, 1319].forEach((f, i) =>
      tone({ freq: f, dur: .5, type: 'triangle', gain: .34, delay: i * .1 }));
  },

  boot(){
    if (!enabled()) return;
    tone({ freq: 110, dur: 1.5, type: 'sine', gain: .5, slideTo: 220, attack: .4 });
    [330, 440, 554, 659].forEach((f, i) =>
      tone({ freq: f, dur: 1.3, type: 'sine', gain: .18, delay: .55 + i * .12 }));
    noise({ dur: 1.4, gain: .1, from: 120, to: 900, q: .8 });
  },

  error(){
    if (!enabled()) return;
    tone({ freq: 220, dur: .16, type: 'square', gain: .26 });
    tone({ freq: 165, dur: .24, type: 'square', gain: .22, delay: .13 });
  },

  toast(){ if (enabled()) tone({ freq: 880, dur: .12, type: 'sine', gain: .3, slideTo: 1320 }); }
};

/* browsers only allow audio after a gesture */
['pointerdown', 'keydown', 'gamepadconnected'].forEach(evt =>
  window.addEventListener(evt, Sound.unlock, { once: true }));

window.Sound = Sound;
})();
