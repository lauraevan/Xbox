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

/* ───────── Xbox / gamepad support ─────────
   Standard Xbox layout:
   0=A 1=B 2=X 3=Y 4=LB 5=RB 6=LT 7=RT 8=View 9=Menu
   10/11=stick clicks 12..15=D-pad 16=Guide (when the browser exposes it).

   Some Apple/browser combinations identify an Xbox controller correctly but
   leave Gamepad.mapping empty. The physical Xbox layout still uses these same
   indices, so recognized Xbox IDs are accepted as a safe fallback. */
const PAD_BUTTONS = { 0:'a', 1:'b', 2:'x', 3:'y', 4:'lb', 5:'rb', 8:'view', 9:'menu', 16:'guide' };
const PAD_DIRS    = { 12:'up', 13:'down', 14:'left', 15:'right' };
const held = new Map();
const knownPads = new Map();
let activePadIndex = null;
const REPEAT_FIRST = 360, REPEAT_RATE = 105;

const isXboxPad = pad =>
  /xbox|xinput|microsoft|045e/i.test(String(pad?.id || ''));

function padLabel(pad){
  if (isXboxPad(pad)) return 'Xbox controller';
  return String(pad?.id || 'Controller').replace(/\s*\([^)]*\)\s*/g, ' ').trim() || 'Controller';
}

function registerPad(pad){
  if (!pad || knownPads.has(pad.index)) return;
  knownPads.set(pad.index, { id:pad.id, xbox:isXboxPad(pad) });
  if (activePadIndex === null) activePadIndex = pad.index;

  document.body.dataset.controller = isXboxPad(pad) ? 'xbox' : 'gamepad';
  window.dispatchEvent(new CustomEvent('nav:padconnected', {
    detail:{
      id:pad.id,
      index:pad.index,
      mapping:pad.mapping || '',
      xbox:isXboxPad(pad),
      buttons:pad.buttons?.length || 0,
      axes:pad.axes?.length || 0
    }
  }));

  setTimeout(() => {
    window.App?.toast?.('Controller connected', `${padLabel(pad)} ready`);
  }, 0);

  /* If the dashboard did not already establish focus, make the controller
     usable immediately after the first button/axis interaction. */
  requestAnimationFrame(() => {
    if (!current) setFocus(candidates()[0], { silent:true });
  });
}

function unregisterPad(pad){
  if (!pad) return;
  knownPads.delete(pad.index);
  for (const key of [...held.keys()])
    if (String(key).startsWith(`${pad.index}:`)) held.delete(key);

  if (activePadIndex === pad.index){
    const next = (navigator.getGamepads?.() || []).find(p => p && p.index !== pad.index);
    activePadIndex = next?.index ?? null;
  }

  if (!knownPads.size) delete document.body.dataset.controller;
  window.dispatchEvent(new CustomEvent('nav:paddisconnected', {
    detail:{ id:pad.id, index:pad.index, xbox:isXboxPad(pad) }
  }));
  setTimeout(() => window.App?.toast?.('Controller disconnected', padLabel(pad)), 0);
}

function padDeadzone(){
  const configured = Number(window.State?.settings.stickDeadzone);
  if (!Number.isFinite(configured)) return .38;
  return Math.max(.18, Math.min(.78, configured / 100));
}

function pollPads(){
  let pads = [];
  try { pads = navigator.getGamepads ? navigator.getGamepads() : []; }
  catch { pads = []; }
  const now = performance.now();

  for (const pad of pads){
    if (!pad || pad.connected === false) continue;
    registerPad(pad);

    /* Prefer the first connected controller, but let any pad become active
       as soon as it produces input. */
    const hasButton = [...pad.buttons].some(button => button?.pressed || (button?.value || 0) > .55);
    const hasAxis = [...pad.axes].some(axis => Math.abs(axis || 0) > .45);
    if (hasButton || hasAxis) activePadIndex = pad.index;
    if (activePadIndex !== pad.index) continue;

    // Face / shoulder / Menu / View / Guide buttons are edge-triggered.
    const map = window.State?.settings.buttonMap || {};
    for (const [index, name] of Object.entries(PAD_BUTTONS)){
      const button = pad.buttons[index];
      const pressed = !!button && (button.pressed || button.value > .65);
      const key = `${pad.index}:b${index}`;
      if (pressed && !held.has(key)){
        held.set(key, now);
        const mapped = map[name] || name;
        if (mapped === 'a'){
          if (!current) setFocus(candidates()[0], { silent:true });
          else activate();
        } else emitButton(mapped);
      } else if (!pressed && held.has(key)){
        held.delete(key);
      }
    }

    // D-pad + left stick navigate with console-style key repeat.
    const [sx, sy] = [pad.axes[0] || 0, pad.axes[1] || 0];
    const DEAD = padDeadzone();
    const dirs = new Set();
    for (const [index, name] of Object.entries(PAD_DIRS)){
      const button = pad.buttons[index];
      if (button && (button.pressed || button.value > .65)) dirs.add(name);
    }
    if (sx < -DEAD) dirs.add('left');
    if (sx >  DEAD) dirs.add('right');
    if (sy < -DEAD) dirs.add('up');
    if (sy >  DEAD) dirs.add('down');

    for (const dir of ['up','down','left','right']){
      const key = `${pad.index}:d${dir}`;
      if (dirs.has(dir)){
        const since = held.get(key);
        if (since === undefined){
          held.set(key, now);
          move(dir);
        } else if (now - since > REPEAT_FIRST){
          held.set(key, now - REPEAT_FIRST + REPEAT_RATE);
          move(dir);
        }
      } else held.delete(key);
    }
  }

  /* Polling also discovers controllers that were already plugged in before
     page load once the browser makes them visible after user interaction. */
  for (const [index] of knownPads){
    const live = pads[index];
    if (!live || live.connected === false){
      unregisterPad({ index, id:knownPads.get(index)?.id || 'Controller' });
    }
  }

  requestAnimationFrame(pollPads);
}

/* ───────── pointer / touch support ─────────
   Mouse hover follows focus. Touch and pen do not, because pointermove fires
   continuously while a finger is swiping a horizontal Xbox rail. A clean tap
   directly activates the controller-style item instead of requiring a second
   tap after focus.

   Mouse is recorded here too, and that is a fix rather than a tidy-up. Every
   console-page control is built by console-pages.js as
   `node.dataset.nav = ''; node._navActivate = fn` with no DOM click listener
   of its own, so the only route from a press to an action is the click
   handler below. It gated on this record, and this record was only ever
   written for touch and pen - so a mouse click moved the focus ring and did
   nothing else. Settings categories, posters, the Game Pass hero: all dead to
   a mouse, working fine on a controller or a phone. The one-off click
   handlers in app-patch.js for the top bar were papering over this.

   Primary button only, so right and middle clicks still do nothing, and the
   same 11px move threshold cancels it, so dragging a rail is not a click. */
let touchTap = null;

document.addEventListener('pointerdown', e => {
  const pointerOk = e.pointerType === 'touch' || e.pointerType === 'pen' ||
    ((e.pointerType === 'mouse' || !e.pointerType) && e.button === 0);
  if (!pointerOk) return;
  const el = e.target.closest?.('[data-nav]');
  touchTap = el && rootEl().contains(el)
    ? { pointerId:e.pointerId, el, x:e.clientX, y:e.clientY, moved:false, at:performance.now() }
    : null;
}, { passive:true });

document.addEventListener('pointermove', e => {
  /* Applies to every pointer type now that the mouse can arm a tap. */
  if (touchTap && touchTap.pointerId === e.pointerId){
    const dx = e.clientX - touchTap.x;
    const dy = e.clientY - touchTap.y;
    if (Math.hypot(dx, dy) > 11) touchTap.moved = true;
  }

  if (e.pointerType === 'touch' || e.pointerType === 'pen') return;

  const el = e.target.closest?.('[data-nav]');
  if (el && el !== current && visible(el) && rootEl().contains(el))
    setFocus(el, { silent:true });
}, { passive:true });

document.addEventListener('pointercancel', e => {
  if (touchTap?.pointerId === e.pointerId) touchTap = null;
}, { passive:true });

document.addEventListener('click', e => {
  const el = e.target.closest?.('[data-nav]');
  if (!el || !rootEl().contains(el)) return;

  const tapped = touchTap &&
    touchTap.el === el &&
    !touchTap.moved &&
    performance.now() - touchTap.at < 1400;

  if (tapped){
    touchTap = null;
    if (el !== current) setFocus(el, { silent:true });

    /* A direct element click handler may already have handled the tap. Those
       handlers call preventDefault(), so do not invoke the nav action twice. */
    if (e.defaultPrevented) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    ring.classList.add('pop');
    setTimeout(() => ring.classList.remove('pop'), 240);
    window.Sound?.select();
    el.dispatchEvent(new CustomEvent('nav:activate', { bubbles:true, detail:{ el } }));
    if (typeof el._navActivate === 'function') el._navActivate(el);
    return;
  }

  if (el !== current) setFocus(el, { silent:true });
});

window.addEventListener('keydown', onKey);
window.addEventListener('resize', schedulePaint);
window.addEventListener('gamepadconnected', e => registerPad(e.gamepad));
window.addEventListener('gamepaddisconnected', e => unregisterPad(e.gamepad));
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
