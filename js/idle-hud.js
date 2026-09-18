/* Xbox-style idle HUD based on the console reference.
   Appears after 7m12s of inactivity in the lower-left, then moves to the
   upper-left 2m55s later. Any user/controller activity dismisses it. */
(() => {
'use strict';

const SHOW_AFTER = 7 * 60 * 1000 + 12 * 1000;   // 7:12
const MOVE_AFTER = 2 * 60 * 1000 + 55 * 1000;   // +2:55

let root = null;
let showTimer = null;
let moveTimer = null;
let clockTimer = null;
let lastGamepad = '';

function formatTime(){
  return new Intl.DateTimeFormat(undefined,{
    hour:'numeric',
    minute:'2-digit',
    hour12:true
  }).format(new Date());
}

function batterySvg(){
  return '<svg class="idle-battery" viewBox="0 0 36 20" aria-hidden="true"><rect x="2" y="3" width="28" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="31" y="7" width="3" height="6" rx="1" fill="currentColor"/><rect x="5" y="6" width="20" height="8" rx="1" fill="currentColor"/></svg>';
}

function micOffSvg(){
  return '<svg class="idle-mic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9.9V6a3 3 0 0 1 5.8-1.1M15 9v3a3 3 0 0 1-.4 1.5M5 11v1a7 7 0 0 0 11.4 5.4M12 19v3M9 22h6M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function ensure(){
  if (root) return root;
  root = document.createElement('div');
  root.className = 'xbox-idle-hud';
  root.setAttribute('aria-hidden','true');
  root.innerHTML = `
    <div class="xbox-idle-icons">
      ${micOffSvg()}
      ${batterySvg()}
    </div>
    <div class="xbox-idle-time" data-idle-time>--:--</div>
  `;
  document.body.append(root);
  return root;
}

function paintTime(){
  const el = root?.querySelector('[data-idle-time]');
  if (el) el.textContent = formatTime();
}

function show(){
  const el = ensure();
  paintTime();
  el.classList.remove('upper-left');
  el.classList.add('visible');
  el.setAttribute('aria-hidden','false');

  clearInterval(clockTimer);
  clockTimer = setInterval(paintTime, 1000);

  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    el.classList.add('upper-left');
  }, MOVE_AFTER);
}

function hide(){
  if (!root) return;
  root.classList.remove('visible','upper-left');
  root.setAttribute('aria-hidden','true');
  clearInterval(clockTimer);
  clockTimer = null;
}

function arm(){
  clearTimeout(showTimer);
  clearTimeout(moveTimer);
  showTimer = setTimeout(show, SHOW_AFTER);
}

function activity(){
  hide();
  arm();
}

['pointerdown','pointermove','touchstart','wheel','keydown'].forEach(type => {
  window.addEventListener(type, activity, { passive:true, capture:true });
});
window.addEventListener('nav:focus', activity);
window.addEventListener('nav:button', activity);
window.addEventListener('focus', activity);
document.addEventListener('visibilitychange', () => {
  if (document.hidden){
    hide();
    clearTimeout(showTimer);
    clearTimeout(moveTimer);
  } else {
    activity();
  }
});

/* Catch real gamepad/controller activity too. */
function gamepadSnapshot(){
  const pads = navigator.getGamepads?.() || [];
  return [...pads].filter(Boolean).map(pad => ({
    i:pad.index,
    b:pad.buttons.map(b => Number(b.value.toFixed(2))),
    a:pad.axes.map(a => Number(a.toFixed(2)))
  }));
}
function pollGamepads(){
  try {
    const snap = JSON.stringify(gamepadSnapshot());
    if (lastGamepad && snap !== lastGamepad) activity();
    lastGamepad = snap;
  } catch {}
  requestAnimationFrame(pollGamepads);
}

arm();
requestAnimationFrame(pollGamepads);
window.XboxIdleHud = { show, hide, reset:activity };
})();