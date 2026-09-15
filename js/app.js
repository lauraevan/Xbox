/* ═══════════════════════════════════════════════════════════
   APP — boot, view routing, backdrop, detail page, launching,
   toasts and the system bar. The piece that ties it together.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { el, escapeHtml, ICON, coverArt } = window.Views;
const $ = sel => document.querySelector(sel);

const VIEWS = {
  home:     { node:'#view-home',     render: window.Views.renderHome },
  library:  { node:'#view-library',  render: window.Views.renderLibrary },
  pass:     { node:'#view-pass',     render: window.Views.renderPass },
  search:   { node:'#view-search',   render: window.Views.renderSearch },
  settings: { node:'#view-settings', render: window.Views.renderSettings }
};

let currentView = 'home';
let detailGame = null;
let playing = null;          // { game, startedAt }
let playTimer = null;
let bgFlip = false;
let historyStack = [];

/* ═══════════ backdrop ═══════════ */
let bgToken = 0;
function setBackdrop(url, fallbackUrl){
  if (window.State.settings.background === 'plain') return;
  const token = ++bgToken;
  const a = $('#bgA'), b = $('#bgB');
  const next = bgFlip ? a : b;
  const prev = bgFlip ? b : a;
  if (!url){ a.classList.remove('on'); b.classList.remove('on'); return; }

  const show = src => {
    if (token !== bgToken) return;
    next.style.backgroundImage = `url("${src}")`;
    next.classList.add('on');
    prev.classList.remove('on');
    bgFlip = !bgFlip;
  };

  const probe = new Image();
  probe.onload = () => show(url);
  probe.onerror = () => {
    if (!fallbackUrl || fallbackUrl === url) return;
    const retry = new Image();
    retry.onload = () => show(fallbackUrl);
    retry.src = fallbackUrl;
  };
  probe.src = url;
}

/* ═══════════ icons ═══════════ */
/** Fill every [data-icon] element from the Fluent set. */
function paintIcons(root = document){
  root.querySelectorAll('[data-icon]').forEach(node => {
    const name = node.dataset.icon;
    if (!window.Icons?.has(name)) return;
    if (node.dataset.iconPainted === name) return;
    // keep any non-svg children (badge dots and the like)
    node.querySelector('svg')?.remove();
    node.insertAdjacentHTML('afterbegin', window.Icons.icon(name));
    node.dataset.iconPainted = name;
  });
}

function syncMicIcon(){
  const btn = $('#micBtn');
  if (!btn) return;
  btn.dataset.icon = window.State.settings.micMuted ? 'mic_off' : 'mic';
  paintIcons(btn.parentElement);
}

/* ═══════════ system bar ═══════════ */
function syncProfile(){
  $('#avatarImg').src = window.State.avatar();
  $('#gamertagLabel').textContent = window.State.data.gamertag;
  $('#gamerscoreLabel').textContent = window.State.gamerscore.toLocaleString();
  $('#tierBadge').textContent = window.State.data.tier;
}

function tickClock(){
  const now = new Date();
  const use24 = window.State.settings.clock24;
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  let suffix = '';
  if (!use24){
    suffix = h >= 12 ? ' pm' : ' am';
    h = h % 12 || 12;
  }
  $('#clock').textContent = `${String(h).padStart(2, '0')}:${m}${suffix}`;
}

function tickBattery(){
  // mirrors a controller pack draining slowly over a session
  const minutes = (Date.now() - startedAt) / 60000;
  const pct = Math.max(12, 92 - minutes * 0.35);
  $('#batteryFill').style.width = pct + '%';
}

function syncNavHighlight(){
  document.querySelectorAll('.sysnav-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === currentView));
}

/* ═══════════ views ═══════════ */
function setView(name, opts = {}){
  if (!VIEWS[name]) return;
  if (name !== currentView) historyStack.push(currentView);

  Object.entries(VIEWS).forEach(([key, v]) => { $(v.node).hidden = key !== name; });
  currentView = name;

  const node = $(VIEWS[name].node);
  VIEWS[name].render(node, opts);
  node.classList.remove('entering');
  void node.offsetWidth;
  node.classList.add('entering');

  syncNavHighlight();
  updateLegend();
  window.Nav.focusIn(node, name === 'home' ? '.tile' : null);

  if (name !== 'home'){
    const hero = $('.hero');
    if (hero) hero.classList.remove('show');
  }
}

function goBack(){
  if (detailGame){ closeDetail(); return; }
  if (currentView !== 'home'){ setView('home'); window.Sound?.back(); return; }
  window.Sound?.edge();
}

/* ═══════════ game detail ═══════════ */
function openDetail(game){
  detailGame = game;
  const node = $('#detail');
  node.hidden = false;
  node.innerHTML = '';

  const bg = el('div', 'detail-bg');
  bg.style.backgroundImage = `url("${game.cover}")`;
  node.append(bg, el('div', 'detail-scrim'));

  const inner = el('div', 'detail-inner');

  const cover = el('div', 'detail-cover');
  cover.append(coverArt(game));
  inner.append(cover);

  const main = el('div', 'detail-main');
  const played = window.State.recents().find(r => r.id === game.id);
  const pinned = window.State.isPinned(game.id);

  main.append(el('div', 'detail-kicker', game.featured ? 'Featured · Included with Game Pass' : 'Included with Game Pass'));
  main.append(el('h1', 'detail-title', escapeHtml(game.name)));

  const meta = el('div', 'detail-meta');
  meta.innerHTML =
    (game.tag ? `<span class="meta-chip">${escapeHtml(game.tag.label)}</span>` : '') +
    `<span class="meta-chip">Cloud</span>` +
    `<span>${escapeHtml(game.author)}</span>` +
    (played ? `<span class="dot"></span><span>Played ${played.plays || 1}×</span>` : '');
  main.append(meta);

  main.append(el('p', 'detail-desc',
    `Streams straight from the catalogue — no install, no download. ` +
    (game.tag ? `Runs through the ${escapeHtml(game.tag.label.toLowerCase())} layer in your browser. ` : '') +
    `Press Play to start, then hold the Guide button to come back here.`));

  const actions = el('div', 'detail-actions');

  const play = el('button', 'btn primary', `${ICON.play} Play`);
  play.dataset.nav = '';
  play._navActivate = () => launch(game);
  actions.append(play);

  const pin = el('button', 'btn', `${ICON.pin} ${pinned ? 'Unpin from Home' : 'Pin to Home'}`);
  pin.dataset.nav = '';
  pin._navActivate = () => {
    const nowPinned = window.State.togglePin(game.id);
    toast(nowPinned ? 'Pinned to Home' : 'Removed from Home', game.name);
    openDetail(game);
    window.Nav.focusFirst('.btn');
  };
  actions.append(pin);

  if (game.authorLink){
    const dev = el('button', 'btn', `${ICON.link} Developer`);
    dev.dataset.nav = '';
    dev._navActivate = () => window.open(game.authorLink, '_blank', 'noopener');
    actions.append(dev);
  }

  const back = el('button', 'btn', `${ICON.back} Back`);
  back.dataset.nav = '';
  back._navActivate = closeDetail;
  actions.append(back);

  main.append(actions);

  const stats = el('div', 'detail-stats');
  const minutes = Math.round((played?.seconds || 0) / 60);
  stats.innerHTML =
    `<div><div class="stat-num">${played?.plays || 0}</div><div class="stat-lbl">Sessions</div></div>
     <div><div class="stat-num">${minutes}</div><div class="stat-lbl">Minutes played</div></div>
     <div><div class="stat-num">#${game.numericId}</div><div class="stat-lbl">Catalogue ID</div></div>`;
  main.append(stats);

  inner.append(main);
  node.append(inner);

  window.Nav.pushLayer(node);
  window.Nav.focusFirst('.btn.primary');
  setBackdrop(game.cover, game.coverAlt);
  updateLegend();
}

function closeDetail(){
  if (!detailGame) return;
  detailGame = null;
  $('#detail').hidden = true;
  $('#detail').innerHTML = '';
  window.Nav.popLayer();
  window.Sound?.back();
  updateLegend();
  if (currentView === 'home') window.Views.updateHero(currentFocusGame());
}

/* ═══════════ launching ═══════════ */
function launch(game){
  window.Sound?.launch();
  const splash = $('#launch');
  splash.hidden = false;
  $('#launchArt').style.backgroundImage = `url("${game.cover}")`;
  $('#launchTitle').textContent = game.name;

  if (detailGame) { $('#detail').hidden = true; }
  window.Nav.hideRing();

  // external entries (a link rather than a playable page) open in a new tab
  if (game.external){
    setTimeout(() => {
      splash.hidden = true;
      window.open(game.play, '_blank', 'noopener');
      if (detailGame) $('#detail').hidden = false;
      window.Nav.repaint();
    }, 900);
    return;
  }

  setTimeout(() => {
    splash.hidden = true;
    startSession(game);
  }, 1700);
}

function startSession(game){
  const player = $('#player');
  const frame = $('#playerFrame');

  let usedMirror = false;
  frame.addEventListener('error', () => {
    if (!usedMirror && game.playAlt){ usedMirror = true; frame.src = game.playAlt; }
  }, { once: true });

  frame.src = game.play;
  player.hidden = false;

  const hint = $('#playerHint');
  hint.classList.remove('hide');
  setTimeout(() => hint.classList.add('hide'), 4200);

  playing = { game, startedAt: Date.now() };
  window.State.markPlayed(game);
  syncProfile();

  clearInterval(playTimer);
  playTimer = setInterval(() => {
    window.State.addPlaytime(game.id, 5);
    if (window.State.totalPlaySeconds() >= 1800) window.State.unlock('marathon');
  }, 5000);

  window.Nav.pushLayer(player);
  window.Nav.hideRing();
  updateLegend();
  window.Guide.notify({ title:'Game started', text:game.name, icon:ICON.play });
}

function quitGame(){
  if (!playing) return;
  const { game, startedAt: began } = playing;
  window.State.addPlaytime(game.id, Math.round((Date.now() - began) / 1000) % 5);

  clearInterval(playTimer);
  playTimer = null;
  playing = null;

  const frame = $('#playerFrame');
  frame.src = 'about:blank';
  $('#player').hidden = true;

  window.Nav.popLayer();
  window.Sound?.back();

  if (currentView === 'home') VIEWS.home.render($(VIEWS.home.node));
  if (detailGame) { $('#detail').hidden = false; openDetail(game); }
  else window.Nav.restore();

  updateLegend();
  window.Nav.setRingVisible(true);
}

/* ═══════════ toasts ═══════════ */
function toast(title, text, opts = {}){
  const node = el('div', 'toast');
  node.append(el('div', 'toast-icon', opts.icon || ICON.bell));
  const body = el('div');
  body.append(el('div', 'toast-title', escapeHtml(title)));
  if (text) body.append(el('div', 'toast-sub', escapeHtml(text)));
  node.append(body);
  if (opts.score) node.append(el('div', 'toast-score', `${opts.score} G`));

  $('#toasts').append(node);
  window.Sound?.toast();
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 320);
  }, opts.duration || 4200);

  window.Guide.notify({ title, text, icon: opts.icon });
}

function achievementToast(ach){
  const node = el('div', 'toast');
  node.append(el('div', 'toast-icon', ICON.trophy));
  const body = el('div');
  body.append(el('div', 'toast-title', 'Achievement unlocked'));
  body.append(el('div', 'toast-sub', ach.name));
  node.append(body);
  node.append(el('div', 'toast-score', `${ach.score} G`));
  $('#toasts').append(node);
  window.Sound?.achievement();
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 320);
  }, 5200);
  window.Guide.notify({ title:`Achievement unlocked — ${ach.name}`, text:`${ach.score} Gamerscore`, icon:ICON.trophy });
}

/* ═══════════ modals ═══════════ */
function modal({ title, text, actions, input }){
  const node = $('#modal');
  node.hidden = false;
  node.innerHTML = '';

  const card = el('div', 'modal-card');
  card.append(el('h2', 'modal-title', escapeHtml(title)));
  if (text) card.append(el('p', 'modal-text', escapeHtml(text)));

  let field = null;
  if (input){
    const wrap = el('div', 'search-field');
    field = el('input', 'search-input');
    field.type = 'text';
    field.value = input.value || '';
    field.maxLength = 15;
    field.setAttribute('aria-label', title);
    wrap.append(field);
    wrap.style.marginBottom = '2.4rem';
    card.append(wrap);
  }

  const row = el('div', 'modal-actions');
  actions.forEach(a => {
    const btn = el('button', 'modal-btn', escapeHtml(a.label));
    btn.dataset.nav = '';
    btn._navActivate = () => { closeModal(); a.onSelect?.(field?.value); };
    row.append(btn);
  });
  card.append(row);
  node.append(card);

  window.Nav.pushLayer(node);
  window.Nav.focusFirst('.modal-btn');
  if (field) setTimeout(() => field.focus(), 60);
}

function closeModal(){
  const node = $('#modal');
  if (node.hidden) return;
  node.hidden = true;
  node.innerHTML = '';
  window.Nav.popLayer();
}

function promptGamertag(){
  modal({
    title:'Change gamertag',
    text:'Up to 15 characters. This is stored in your browser only.',
    input:{ value: window.State.data.gamertag },
    actions:[
      { label:'Save', onSelect: value => {
          if (value && value.trim()){
            window.State.setGamertag(value.trim());
            syncProfile();
            toast('Gamertag updated', value.trim(), { icon: ICON.person });
            if (currentView === 'settings') setView('settings');
          }
        } },
      { label:'Cancel' }
    ]
  });
}

function confirmReset(){
  modal({
    title:'Reset this profile?',
    text:'Gamerscore, pins, recently played and settings all go back to factory defaults. This cannot be undone.',
    actions:[
      { label:'Reset everything', onSelect: () => { window.State.reset(); location.reload(); } },
      { label:'Keep my profile' }
    ]
  });
}

function powerOff(){
  const veil = el('div');
  veil.style.cssText = 'position:fixed;inset:0;z-index:300;background:#000;opacity:0;' +
    'transition:opacity .9s ease;display:grid;place-items:center;color:rgba(255,255,255,.35);' +
    'font-size:1.8rem;letter-spacing:.3rem';
  veil.textContent = '';
  document.body.append(veil);
  requestAnimationFrame(() => { veil.style.opacity = '1'; });
  setTimeout(() => { veil.textContent = 'PRESS ANY BUTTON TO WAKE'; }, 1600);
  const wake = () => { location.reload(); };
  setTimeout(() => {
    window.addEventListener('keydown', wake, { once:true });
    window.addEventListener('pointerdown', wake, { once:true });
  }, 1800);
}

/* ═══════════ screenshot ═══════════ */
async function screenshot(){
  if (!navigator.mediaDevices?.getDisplayMedia){
    toast('Capture unavailable', 'This browser has no screen capture API.', { icon: ICON.capture });
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video:{ frameRate:1 }, audio:false });
    const track = stream.getVideoTracks()[0];
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    await new Promise(r => setTimeout(r, 260));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    track.stop();

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capture-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Capture saved', 'Screenshot downloaded', { icon: ICON.capture });
    }, 'image/png');
  } catch {
    toast('Capture cancelled', 'No screen was shared.', { icon: ICON.capture });
  }
}

/* ═══════════ button legend ═══════════ */
function updateLegend(){
  const legend = $('#legend');
  const items = [];

  if (playing && !window.Guide.isOpen){
    items.push(['guide', 'Guide'], ['b', 'Quit game']);
  } else if (window.Guide.isOpen){
    items.push(['a', 'Select'], ['b', 'Close guide']);
  } else if (detailGame){
    items.push(['a', 'Play'], ['y', 'Pin'], ['b', 'Back']);
  } else {
    items.push(['a', 'Select']);
    if (currentView === 'home') items.push(['y', 'Pin'], ['x', 'Search']);
    else items.push(['b', 'Back']);
    items.push(['guide', 'Guide']);
  }

  legend.innerHTML = items.map(([key, label]) => {
    const glyph = key === 'guide'
      ? '<span class="pad" style="background:#107c10;color:#fff">⦿</span>'
      : `<span class="pad ${key}">${key.toUpperCase()}</span>`;
    return `<span class="legend-item">${glyph}<span>${label}</span></span>`;
  }).join('');
}

/* ═══════════ focus → backdrop + hero ═══════════ */
function currentFocusGame(){
  const el = window.Nav.current;
  const id = el?.dataset?.gameId;
  return id ? window.Catalog.get(id) : null;
}

window.addEventListener('nav:focus', () => {
  const game = currentFocusGame();
  if (game){
    setBackdrop(game.cover, game.coverAlt);
    if (currentView === 'home' && !detailGame) window.Views.updateHero(game);
  }
});

/* ═══════════ buttons ═══════════ */
window.addEventListener('nav:button', e => {
  const b = e.detail.button;

  if (b === 'guide'){
    if (!$('#modal').hidden) return;
    window.Guide.toggle();
    updateLegend();
    return;
  }

  if (window.Guide.isOpen){
    if (b === 'b'){ window.Guide.close(); updateLegend(); }
    if (b === 'rb') window.Guide.cycleTab(1);
    if (b === 'lb') window.Guide.cycleTab(-1);
    return;
  }

  if (!$('#modal').hidden){
    if (b === 'b') closeModal();
    return;
  }

  if (playing){
    if (b === 'b') quitGame();
    return;
  }

  switch (b){
    case 'b': goBack(); break;
    case 'x':
      if (detailGame) break;
      setView('search');
      break;
    case 'y': {
      const game = detailGame || currentFocusGame();
      if (!game) break;
      const pinned = window.State.togglePin(game.id);
      toast(pinned ? 'Pinned to Home' : 'Removed from Home', game.name, { icon: ICON.pin });
      if (detailGame) openDetail(game);
      else if (currentView === 'home'){
        const focused = window.Nav.current?.dataset.gameId;
        VIEWS.home.render($(VIEWS.home.node));
        const again = [...document.querySelectorAll('#view-home [data-game-id]')]
          .find(n => n.dataset.gameId === focused);
        window.Nav.focus(again || undefined, { silent:true });
      }
      break;
    }
    case 'lb': case 'rb': {
      const order = ['home', 'library', 'pass', 'search', 'settings'];
      const i = order.indexOf(currentView);
      const next = order[(i + (b === 'rb' ? 1 : order.length - 1)) % order.length];
      setView(next);
      break;
    }
    case 'menu':
      if (currentFocusGame()) openDetail(currentFocusGame());
      break;
    case 'view':
      window.Guide.open('achievements');
      break;
  }
});

/* system bar clicks */
document.addEventListener('nav:activate', e => {
  const target = e.detail.el;
  if (target.dataset.view) setView(target.dataset.view);
  if (target.dataset.act === 'profile') window.Guide.open('profile');
  if (target.dataset.act === 'mic'){
    const muted = !window.State.settings.micMuted;
    window.State.setSetting('micMuted', muted);
    document.body.dataset.mic = muted ? 'muted' : 'live';
    syncMicIcon();
    toast(muted ? 'Microphone muted' : 'Microphone live', null, { duration: 2000 });
  }
});

/* achievements bubble up from the state layer */
window.State.on(evt => {
  if (evt.type === 'achievement'){
    achievementToast(evt.achievement);
    syncProfile();
  }
  if (evt.type === 'profile' || evt.type === 'recents') syncProfile();
});

/* ═══════════ boot video ═══════════
   The clip is treated as optional decoration. It gets a short budget to
   become playable; if the connection cannot deliver it in time, or it
   stalls part-way, we drop to the poster still rather than sit on a
   buffering screen. Total boot time is capped either way. */
const BOOT = {
  READY_BUDGET: 2500,   // time allowed to become playable
  STALL_GRACE:  1200,   // time allowed to recover from a mid-play stall
  HARD_CAP:    10000,   // absolute ceiling on the whole boot screen
  STILL_HOLD:   1400,   // how long the poster shows when the clip is skipped
  CATALOG_CAP:  9000    // never wait longer than this for the manifest
};

function playBootVideo(){
  return new Promise(resolve => {
    const node = $('#boot');
    const video = $('#bootVideo');
    if (!video) return resolve('missing');

    const settings = window.State.settings;
    const saveData = navigator.connection?.saveData === true;

    const still = reason => {
      node.classList.add('still');
      video.removeAttribute('src');
      setTimeout(() => resolve(reason), BOOT.STILL_HOLD);
    };

    // data saver, reduced motion, or an explicit opt-out never fetch the clip
    if (settings.bootVideo === false || saveData || settings.motion === 'reduced'){
      video.querySelectorAll('source').forEach(n => n.remove());
      return still('skipped');
    }

    let settled = false;
    const timers = [];
    const stop = reason => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      resolve(reason);
    };
    const bail = reason => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      try { video.pause(); } catch {}
      still(reason);
    };

    let stallTimer = null;
    const onEnded   = () => stop('played');
    const onError   = () => bail('error');
    const onPlaying = () => { clearTimeout(stallTimer); };
    const onWaiting = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => bail('stalled'), BOOT.STALL_GRACE);
      timers.push(stallTimer);
    };

    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);

    // give it a budget to become playable, then give up on it
    timers.push(setTimeout(() => {
      if (video.readyState < 3) bail('slow');
    }, BOOT.READY_BUDGET));

    // whatever happens, the boot screen has a ceiling
    timers.push(setTimeout(() => stop('cap'), BOOT.HARD_CAP));

    video.play().catch(() => bail('blocked'));
  });
}

/* ═══════════ boot ═══════════ */
const startedAt = Date.now();

function applySettings(){
  const s = window.State.settings;
  document.body.dataset.theme = s.theme;
  document.body.dataset.bg = s.background;
  document.body.dataset.mic = s.micMuted ? 'muted' : 'live';
  document.documentElement.dataset.motion = s.motion;
  document.documentElement.style.setProperty('--accent', s.accent);
  $('#scanline').hidden = !s.scanline;
}

async function boot(){
  applySettings();
  paintIcons();
  syncMicIcon();
  syncProfile();
  tickClock();
  tickBattery();
  setInterval(tickClock, 5000);
  setInterval(tickBattery, 30000);

  // the manifest loads while the boot clip plays, and is capped so a dead
  // network cannot hold the boot screen open
  const catalogLoad = Promise.race([
    window.Catalog.load().then(() => null, err => err),
    new Promise(r => setTimeout(() => r(new Error('manifest timed out')), BOOT.CATALOG_CAP))
  ]);

  const [, loadError] = await Promise.all([playBootVideo(), catalogLoad]);

  $('#boot').classList.add('out');
  setTimeout(() => { $('#boot').remove(); }, 620);
  $('#stage').hidden = false;

  if (loadError){
    setView('home');
    modal({
      title:'Catalogue unavailable',
      text:'The game manifest could not be reached from this network. Check your connection and restart the console.',
      actions:[{ label:'Retry', onSelect: () => location.reload() }]
    });
    window.Sound?.error();
    return;
  }

  setView('home');
  window.State.unlock('boot');

  const count = window.Catalog.count();
  setTimeout(() => toast('Ready to play', `${count.toLocaleString()} titles in your catalogue`, { icon: ICON.store }), 1200);
}

/* ═══════════ public surface ═══════════ */
window.App = {
  setView, goBack, openDetail, closeDetail, launch, quitGame,
  toast, modal, closeModal, promptGamertag, confirmReset, powerOff, screenshot,
  syncProfile, tickClock, updateLegend, setBackdrop, paintIcons, syncMicIcon,
  isPlaying: () => !!playing,
  get view(){ return currentView; }
};

let booted = false;
const bootOnce = () => { if (!booted){ booted = true; boot(); } };
document.addEventListener('DOMContentLoaded', bootOnce);
if (document.readyState !== 'loading') bootOnce();
})();
