/* ═══════════════════════════════════════════════════════════
   NAV — spatial focus engine + gamepad/keyboard input.
   Focus moves by geometry, not DOM order, which is what makes
   a grid feel like a console instead of a web page.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const ring = document.createElement('div');
ring.className = 'focus-ring';
document.body.appendChild(ring);

let current = null;
let layers = [{ root: document, memory: new WeakMap() }];
let ringVisible = true;

const top = () => layers[layers.length - 1];
const rootEl = () => { const r = top().root; return r === document ? document.body : r; };

function visible(el){
  if (el.hidden || el.disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  // reject anything inside a hidden ancestor.
  // opacity is deliberately not tested: views animate in from opacity 0,
  // and focus is assigned on the same frame the animation starts.
  for (let n = el; n && n !== document.body; n = n.parentElement){
    if (n.hidden) return false;
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return true;
}

function candidates(){
  return [...rootEl().querySelectorAll('[data-nav]')].filter(visible);
}

/* ───────── ring placement ───────── */
function paintRing(){
  if (!current || !ringVisible){ ring.classList.remove('on'); return; }
  const r = current.getBoundingClientRect();
  const pad = parseFloat(current.dataset.ringPad || '0');
  const radius = current.dataset.ringRadius || getComputedStyle(current).borderRadius;
  ring.style.top    = (r.top - pad) + 'px';
  ring.style.left   = (r.left - pad) + 'px';
  ring.style.width  = (r.width + pad * 2) + 'px';
  ring.style.height = (r.height + pad * 2) + 'px';
  ring.style.borderRadius = current.dataset.ringShape === 'circle' ? '50%' : radius;
  ring.classList.add('on');
}

let rafPending = false;
function schedulePaint(){
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; paintRing(); });
}

/* ───────── scrolling ───────── */
function keepInView(el){
  // horizontal rails
  const strip = el.closest('.rail-strip, .search-right, .page-scroll, .settings-body, .guide-body');
  if (!strip) { el.scrollIntoView({ block:'nearest', inline:'nearest' }); return; }

  if (strip.scrollWidth > strip.clientWidth + 4){
    const er = el.getBoundingClientRect(), sr = strip.getBoundingClientRect();
    const margin = sr.width * 0.18;
    if (er.left < sr.left + margin) strip.scrollBy({ left: er.left - sr.left - margin, behavior:'smooth' });
    else if (er.right > sr.right - margin) strip.scrollBy({ left: er.right - sr.right + margin, behavior:'smooth' });
  }
  if (strip.scrollHeight > strip.clientHeight + 4){
    const er = el.getBoundingClientRect(), sr = strip.getBoundingClientRect();
    const margin = Math.min(sr.height * 0.25, 160);
    if (er.top < sr.top + margin) strip.scrollBy({ top: er.top - sr.top - margin, behavior:'smooth' });
    else if (er.bottom > sr.bottom - margin) strip.scrollBy({ top: er.bottom - sr.bottom + margin, behavior:'smooth' });
  }
  setTimeout(schedulePaint, 60);
  setTimeout(schedulePaint, 240);
}

/* ───────── focus ───────── */
function setFocus(el, opts = {}){
  if (!el || el === current) { schedulePaint(); return; }
  if (current) { current.removeAttribute('data-focused'); }
  current = el;
  el.setAttribute('data-focused', '');
  top().memory.set(rootEl(), el);

  if (!opts.silent) window.Sound?.move();
  keepInView(el);
  schedulePaint();
  window.dispatchEvent(new CustomEvent('nav:focus', { detail:{ el } }));
}

/* ───────── direction scoring ─────────
   Pick the nearest element in the requested direction, weighting
   cross-axis drift heavily so rows and columns stay coherent. */
function best(dir){
  if (!current) return candidates()[0] || null;
  const list = candidates().filter(el => el !== current);
  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;

  let winner = null, winScore = Infinity;
  for (const el of list){
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;

    let along, across, overlap;
    if (dir === 'left' || dir === 'right'){
      along  = dir === 'right' ? dx : -dx;
      across = Math.abs(dy);
      overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      // must actually be to the side, and not merely a hair away
      if (along < a.width * 0.12 && along < 8) continue;
    } else {
      along  = dir === 'down' ? dy : -dy;
      across = Math.abs(dx);
      overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (along < a.height * 0.12 && along < 8) continue;
    }

    // overlapping on the cross axis is a strong signal of "same row/column"
    const overlapBonus = overlap > 0 ? -Math.min(overlap, 200) * 1.2 : 0;
    const score = along + across * 2.4 + overlapBonus;
    if (score < winScore){ winScore = score; winner = el; }
  }
  return winner;
}

/* ───────── activation ───────── */
function activate(el = current){
  if (!el) return;
  ring.classList.add('pop');
  setTimeout(() => ring.classList.remove('pop'), 240);
  window.Sound?.select();
  el.dispatchEvent(new CustomEvent('nav:activate', { bubbles:true, detail:{ el } }));
  if (typeof el._navActivate === 'function') el._navActivate(el);
  else el.click?.();
}

/* ───────── layers ───────── */
function pushLayer(root){
  layers.push({ root, memory: new WeakMap() });
  current?.removeAttribute('data-focused');
  current = null;
}
function popLayer(){
  if (layers.length <= 1) return;
  layers.pop();
  current?.removeAttribute('data-focused');
  current = null;
  const remembered = top().memory.get(rootEl());
  setFocus(remembered && visible(remembered) ? remembered : candidates()[0], { silent:true });
}

/* ───────── keyboard ───────── */
const KEYMAP = {
  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
  KeyW:'up', KeyS:'down', KeyA:'left', KeyD:'right'
};

function onKey(e){
  if (e.target.matches?.('input,textarea') && !['Escape','ArrowUp','ArrowDown'].includes(e.code)) return;

  const dir = KEYMAP[e.code];
  if (dir){ e.preventDefault(); move(dir); return; }

  switch (e.code){
    case 'Enter': case 'Space': case 'NumpadEnter':
      e.preventDefault(); activate(); break;
    case 'Escape': case 'Backspace':
      e.preventDefault(); emitButton('b'); break;
    case 'KeyX': e.preventDefault(); emitButton('x'); break;
    case 'KeyY': e.preventDefault(); emitButton('y'); break;
    case 'KeyG': case 'Home':
      e.preventDefault(); emitButton('guide'); break;
    case 'Tab':
      e.preventDefault(); emitButton(e.shiftKey ? 'lb' : 'rb'); break;
    case 'KeyM': e.preventDefault(); emitButton('menu'); break;
    case 'KeyV': e.preventDefault(); emitButton('view'); break;
  }
}

function move(dir){
  const target = best(dir);
  if (target) setFocus(target);
  else { window.Sound?.edge(); nudge(dir); }
  window.dispatchEvent(new CustomEvent('nav:move', { detail:{ dir, moved: !!target } }));
}

function nudge(dir){
  if (!current) return;
  const el = current;
  const map = { left:'-.5rem,0', right:'.5rem,0', up:'0,-.5rem', down:'0,.5rem' };
  el.style.transition = 'transform .12s ease-out';
  const prior = getComputedStyle(el).transform;
  el.animate(
    [{ transform: prior === 'none' ? 'translate(0,0)' : prior },
     { transform: `${prior === 'none' ? '' : prior} translate(${map[dir].split(',')[0]}, ${map[dir].split(',')[1]})` },
     { transform: prior === 'none' ? 'translate(0,0)' : prior }],
    { duration: 180, easing:'ease-out' }
  );
}

const emitButton = button =>
  window.dispatchEvent(new CustomEvent('nav:button', { detail:{ button } }));

/* ───────── gamepad ─────────
   Standard mapping: 0=A 1=B 2=X 3=Y 4=LB 5=RB 8=View 9=Menu 16=Guide
   12..15 = D-pad up/down/left/right. */
const PAD_BUTTONS = { 0:'a', 1:'b', 2:'x', 3:'y', 4:'lb', 5:'rb', 8:'view', 9:'menu', 16:'guide' };
const PAD_DIRS    = { 12:'up', 13:'down', 14:'left', 15:'right' };
const held = new Map();
const REPEAT_FIRST = 380, REPEAT_RATE = 110;

function pollPads(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const now = performance.now();

  for (const pad of pads){
    if (!pad) continue;

    // face + shoulder buttons: edge-triggered
    for (const [index, name] of Object.entries(PAD_BUTTONS)){
      const pressed = pad.buttons[index]?.pressed;
      const key = `${pad.index}:b${index}`;
      if (pressed && !held.get(key)){
        held.set(key, now);
        if (name === 'a') activate(); else emitButton(name);
      } else if (!pressed && held.get(key)) held.delete(key);
    }

    // d-pad + left stick: repeat while held
    const [sx, sy] = [pad.axes[0] || 0, pad.axes[1] || 0];
    const DEAD = .55;
    const dirs = new Set();
    for (const [index, name] of Object.entries(PAD_DIRS))
      if (pad.buttons[index]?.pressed) dirs.add(name);
    if (sx < -DEAD) dirs.add('left');
    if (sx >  DEAD) dirs.add('right');
    if (sy < -DEAD) dirs.add('up');
    if (sy >  DEAD) dirs.add('down');

    for (const dir of ['up','down','left','right']){
      const key = `${pad.index}:d${dir}`;
      if (dirs.has(dir)){
        const since = held.get(key);
        if (since === undefined){ held.set(key, now); move(dir); }
        else if (now - since > REPEAT_FIRST){
          held.set(key, now - REPEAT_FIRST + REPEAT_RATE);
          move(dir);
        }
      } else held.delete(key);
    }
  }
  requestAnimationFrame(pollPads);
}

/* ───────── pointer support ─────────
   A mouse should still work; hovering focuses, clicking activates. */
document.addEventListener('pointermove', e => {
  const el = e.target.closest?.('[data-nav]');
  if (el && el !== current && visible(el) && rootEl().contains(el)) setFocus(el, { silent:true });
}, { passive:true });

document.addEventListener('click', e => {
  const el = e.target.closest?.('[data-nav]');
  if (!el || !rootEl().contains(el)) return;
  if (el !== current) setFocus(el, { silent:true });
});

window.addEventListener('keydown', onKey);
window.addEventListener('resize', schedulePaint);
window.addEventListener('gamepadconnected', e => {
  window.dispatchEvent(new CustomEvent('nav:padconnected', { detail:{ id: e.gamepad.id } }));
});
document.addEventListener('scroll', schedulePaint, true);
requestAnimationFrame(pollPads);

const Nav = {
  focus: setFocus,
  get current(){ return current; },
  move, activate, pushLayer, popLayer,
  candidates, repaint: schedulePaint,

  /** Focus the first sensible element in the active layer. */
  focusFirst(selector){
    const list = candidates();
    const el = selector ? list.find(n => n.matches(selector)) : list[0];
    if (el) setFocus(el, { silent:true });
  },

  /** Focus inside a specific container, so a view swap never lands
      on the system bar just because it comes first in the document. */
  focusIn(container, selector){
    if (!container) return Nav.focusFirst(selector);
    const list = candidates().filter(n => container.contains(n));
    const el = (selector ? list.find(n => n.matches(selector)) : null) || list[0];
    if (el) setFocus(el, { silent:true });
    else Nav.focusFirst(selector);
  },

  /** Re-anchor after a view swap: prefer remembered, else first. */
  restore(){
    const remembered = top().memory.get(rootEl());
    if (remembered && visible(remembered)) setFocus(remembered, { silent:true });
    else Nav.focusFirst();
  },

  setRingVisible(v){ ringVisible = v; schedulePaint(); },
  hideRing(){ ring.classList.remove('on'); }
};

window.Nav = Nav;
})();
