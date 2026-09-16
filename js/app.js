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
let bgCancel = null;

/** Paint a resolved image into the idle backdrop layer and cross-fade. */
function paintBackdrop(url, token, wide){
  if (token !== bgToken) return;
  const a = $('#bgA'), b = $('#bgB');
  const next = bgFlip ? a : b;
  const prev = bgFlip ? b : a;
  next.style.backgroundImage = `url("${url}")`;
  // real widescreen art is shown as-is; a square cover still needs the blur
  next.classList.toggle('wide', !!wide);
  next.classList.add('on');
  prev.classList.remove('on');
  bgFlip = !bgFlip;
}

function setBackdrop(game){
  const set = window.State.settings;
  if (set.background === 'plain') return;

  // a wallpaper is fixed behind everything, as on the console: it does not
  // follow the selection, so there is nothing to cross-fade
  if (set.wallpaper){
    const a = $('#bgA');
    if (a.dataset.wallpaper !== set.wallpaper){
      a.dataset.wallpaper = set.wallpaper;
      a.style.backgroundImage = `url("${set.wallpaper}")`;
      a.classList.add('on', 'wide');
      $('#bgB').classList.remove('on');
    }
    return;
  }
  $('#bgA').removeAttribute('data-wallpaper');

  const token = ++bgToken;
  const file = typeof game === 'string' ? game : game?.coverFile;
  if (!file){
    $('#bgA').classList.remove('on'); $('#bgB').classList.remove('on');
    return;
  }

  // the square cover goes up straight away so the screen is never empty
  bgCancel?.();
  bgCancel = window.Media.resolveCover(file, url => paintBackdrop(url, token, false));

  // and is replaced if proper widescreen art exists for this title
  const name = typeof game === 'object' ? game?.name : null;
  if (name && window.Artwork?.enabled){
    window.Artwork.hero(name).then(hero => {
      if (!hero || token !== bgToken) return;
      const probe = new Image();
      probe.onload = () => paintBackdrop(hero, token, true);
      probe.src = hero;
    });
  }
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
  // the console shows a second line under the gamertag; Gamerscore is the
  // honest thing to put there rather than inventing an address
  $('#profileSub').textContent = window.State.settings.profileLine
    || `${window.State.gamerscore.toLocaleString()} Gamerscore \u00b7 ${window.State.data.tier}`;

  const score = $('#friendsCount');
  if (score) score.textContent = window.State.gamerscore.toLocaleString();
}

function tickClock(){
  if (window.State.settings.nightAuto) applyNightMode();
  const now = new Date();
  const use24 = window.State.settings.clock24;
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  let suffix = '';
  if (!use24){
    suffix = h >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;                      // no leading zero on a 12-hour clock
    $('#clock').textContent = `${h}:${m}${suffix}`;
    return;
  }
  $('#clock').textContent = `${String(h).padStart(2, '0')}:${m}`;
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

  document.body.dataset.view = name;
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
  window.Media.resolveCover(game.coverFile, url => { bg.style.backgroundImage = `url("${url}")`; });
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
  setBackdrop(game);
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
  // family settings can withhold a whole category, or the day's time
  if (window.State.isBlocked(game)){
    window.Sound?.error();
    modal({
      title:'Blocked by family settings',
      text:`${game.name} is in a category that has been turned off for this console. `
         + 'Change it under Settings \u2192 Family settings.',
      actions:[{ label:'Open family settings',
                 onSelect: () => setView('settings', { section:'family' }) },
               { label:'Back' }]
    });
    return;
  }
  if (window.Features.ScreenTime.exceeded()){
    window.Sound?.error();
    modal({
      title:'Screen time is up',
      text:`The daily limit of ${window.Features.ScreenTime.limit()} minutes has been reached. `
         + 'Raise or clear the limit under Settings \u2192 Family settings.',
      actions:[{ label:'Open family settings',
                 onSelect: () => setView('settings', { section:'family' }) },
               { label:'Back' }]
    });
    return;
  }

  window.Sound?.launch();
  const splash = $('#launch');
  splash.hidden = false;
  $('#launchArt').style.backgroundImage = '';
  window.Media.resolveCover(game.coverFile,
    url => { $('#launchArt').style.backgroundImage = `url("${url}")`; });
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

  window.Features.QuickResume.push(game);

  clearInterval(playTimer);
  playTimer = setInterval(() => {
    window.State.addPlaytime(game.id, 5);
    window.Features.ScreenTime.add(5);
    if (window.State.totalPlaySeconds() >= 1800) window.State.unlock('marathon');

    const left = window.Features.ScreenTime.remaining();
    if (left === 5) toast('5 minutes left', 'Daily screen time is nearly up', { icon: ICON.clock });
    if (window.Features.ScreenTime.exceeded()){
      quitGame();
      toast('Screen time is up', 'The daily limit has been reached', { icon: ICON.clock });
    }
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

function promptWallpaper(){
  modal({
    title:'Home wallpaper',
    text:'Paste a direct image URL - ideally 1920x1080. It sits fixed behind '
       + 'the dashboard the way the console does, instead of cropping a square '
       + 'cover to fit. Leave it empty to go back to using cover art.',
    input:{ value: window.State.settings.wallpaper || '' },
    actions:[
      { label:'Save', onSelect: value => {
          const url = (value || '').trim();
          window.State.setSetting('wallpaper', url);
          $('#bgA').removeAttribute('data-wallpaper');
          $('#bgA').classList.remove('on');
          $('#bgB').classList.remove('on');
          const game = currentFocusGame();
          setBackdrop(url ? null : game);
          if (url) setBackdrop(null);
          toast(url ? 'Wallpaper set' : 'Wallpaper cleared');
          if (currentView === 'settings') setView('settings', { section:'personalization' });
        } },
      { label:'Cancel' }
    ]
  });
}

function promptProfileLine(){
  modal({
    title:'Second profile line',
    text:'The line under your gamertag on Home. Leave it empty to show '
       + 'Gamerscore and membership instead.',
    input:{ value: window.State.settings.profileLine || '' },
    actions:[
      { label:'Save', onSelect: value => {
          window.State.setSetting('profileLine', (value || '').trim());
          syncProfile();
          if (currentView === 'settings') setView('settings', { section:'profile' });
        } },
      { label:'Cancel' }
    ]
  });
}

function promptArtworkKey(){
  modal({
    title: 'SteamGridDB key',
    text: 'Widescreen key art for titles that also exist on Steam. Most of this '
        + 'catalogue is browser and Flash originals, which SteamGridDB does not '
        + 'carry, so expect only a fraction to match. A project key ships with '
        + 'the build; anything entered here overrides it on this device only. '
        + 'Leave it empty to go back to the project key.',
    input:{ value: window.Artwork.usingDefault ? '' : window.Artwork.key },
    actions:[
      { label:'Save', onSelect: value => {
          window.Artwork.setKey(value);
          window.Artwork.clearCache();
          toast(value && value.trim() ? 'Artwork key saved' : 'Artwork key removed',
                value && value.trim() ? 'Widescreen art will load where it exists' : null);
          if (currentView === 'settings') setView('settings', { section:'personalization' });
          const game = currentFocusGame();
          if (game) setBackdrop(game);
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

    canvas.toBlob(async blob => {
      try {
        await window.Features.Captures.save(blob, {
          title: playing ? playing.game.name : 'Dashboard',
          kind: playing ? 'game' : 'screenshot'
        });
        toast('Capture saved', 'Find it under Settings → Captures', { icon: ICON.capture });
      } catch {
        toast('Capture failed', 'This browser blocked local storage.', { icon: ICON.capture });
      }
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
    setBackdrop(game);
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
  if (target.dataset.act === 'friends'){
    window.Guide.open('achievements');
  }
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

/** True when the wall clock sits inside the night-mode window. */
function withinNightWindow(){
  const s = window.State.settings;
  const [fh, fm] = String(s.nightFrom).split(':').map(Number);
  const [th, tm] = String(s.nightTo).split(':').map(Number);
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const from = fh * 60 + fm, to = th * 60 + tm;
  return from <= to ? (mins >= from && mins < to)   // same-day window
                    : (mins >= from || mins < to);  // wraps past midnight
}

function applyNightMode(){
  const s = window.State.settings;
  const on = s.nightMode || (s.nightAuto && withinNightWindow());
  const veil = $('#nightVeil');
  if (!veil) return;
  veil.hidden = !on;
  document.documentElement.style.setProperty('--night', on ? s.nightStrength : 0);
}

function applySettings(){
  const s = window.State.settings;
  document.body.dataset.theme = s.theme;
  document.body.dataset.bg = s.background;
  document.body.dataset.mic = s.micMuted ? 'muted' : 'live';
  document.body.dataset.cvd = s.colorFilter || 'none';
  document.body.dataset.contrast = s.highContrast ? 'high' : 'normal';
  document.body.dataset.transparency = s.reduceTransparency ? 'reduced' : 'normal';
  document.documentElement.dataset.motion = s.motion;
  document.documentElement.style.setProperty('--accent', s.accent);
  document.documentElement.style.setProperty('--text-scale', s.textScale || 1);
  document.documentElement.style.setProperty('--overscan', s.safeArea || 0);
  document.documentElement.style.setProperty('--sat', s.saturation ?? 1.35);
  window.Sound?.setVolume(s.volume ?? 70);
  $('#scanline').hidden = !s.scanline;
  applyNightMode();
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

/* ═══════════ captures, profiles, rumble ═══════════ */
function captureActions(shot, onDone){
  modal({
    title: shot.title,
    text: new Date(shot.at).toLocaleString(),
    actions:[
      { label:'Download', onSelect: () => {
          const url = URL.createObjectURL(shot.blob);
          const a = document.createElement('a');
          a.href = url; a.download = `${shot.id}.png`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        } },
      { label:'Delete', onSelect: async () => {
          await window.Features.Captures.remove(shot.id);
          toast('Capture deleted'); onDone?.();
        } },
      { label:'Back' }
    ]
  });
}

function promptNewProfile(){
  modal({
    title:'Add a profile',
    text:'Each profile keeps its own pins, recently played and Gamerscore.',
    input:{ value:'' },
    actions:[
      { label:'Create', onSelect: name => {
          if (!name || !name.trim()) return;
          window.State.addProfile(name.trim());
          toast('Profile created', name.trim(), { icon: ICON.person });
          if (currentView === 'settings') setView('settings', { section:'profile' });
        } },
      { label:'Cancel' }
    ]
  });
}

function manageProfiles(){
  const others = window.State.profiles().filter(p => !p.active);
  if (!others.length) return;
  modal({
    title:'Remove a profile',
    text:'Signed-in profiles cannot be removed. This deletes their progress on this console.',
    actions:[
      ...others.map(p => ({
        label: `Remove ${p.gamertag}`,
        onSelect: () => {
          window.State.removeProfile(p.profileId);
          toast('Profile removed', p.gamertag);
          if (currentView === 'settings') setView('settings', { section:'profile' });
        }
      })),
      { label:'Cancel' }
    ]
  });
}

function testRumble(){
  const pad = (navigator.getGamepads?.() || []).find(Boolean);
  const actuator = pad?.vibrationActuator;
  if (!actuator?.playEffect){
    toast('No rumble available', 'Connect a controller that reports an actuator.', { icon: ICON.pad });
    return;
  }
  actuator.playEffect('dual-rumble', { duration:420, strongMagnitude:.7, weakMagnitude:.4 });
  toast('Rumble sent', null, { duration: 1800, icon: ICON.pad });
}

function rumble(strong = .35, weak = .2, duration = 90){
  if (!window.State.settings.vibration) return;
  const pad = (navigator.getGamepads?.() || []).find(Boolean);
  pad?.vibrationActuator?.playEffect?.('dual-rumble',
    { duration, strongMagnitude: strong, weakMagnitude: weak });
}

/* ═══════════ public surface ═══════════ */
window.App = {
  setView, goBack, openDetail, closeDetail, launch, quitGame,
  toast, modal, closeModal, promptGamertag, confirmReset, powerOff, screenshot,
  syncProfile, tickClock, updateLegend, setBackdrop, paintIcons, syncMicIcon,
  applyNightMode, captureActions, promptNewProfile, manageProfiles, testRumble, rumble,
  promptArtworkKey, promptProfileLine, promptWallpaper,
  isPlaying: () => !!playing,
  get view(){ return currentView; }
};

let booted = false;
const bootOnce = () => { if (!booted){ booted = true; boot(); } };
document.addEventListener('DOMContentLoaded', bootOnce);
if (document.readyState !== 'loading') bootOnce();
})();
