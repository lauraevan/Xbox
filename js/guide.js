/* ═══════════════════════════════════════════════════════════
   GUIDE — the sidebar that slides in from the left on the
   Guide button (Esc / G / gamepad button 16).

   The icon rail stays collapsed to glyphs until focus enters
   it, then flies out over the body to reveal its labels.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { el, escapeHtml, ICON } = window.Views;
const $ = sel => document.querySelector(sel);

const chevronMark = () => `<span class="grow-chev">${ICON.chevron}</span>`;

const TABS = [
  { id:'profile',       icon:'avatar',     label:'Profile & system' },
  { id:'home',          icon:ICON.home,    label:'Home' },
  { id:'party',         icon:ICON.party,   label:'Parties & chats' },
  { id:'achievements',  icon:ICON.trophy,  label:'Achievements' },
  { id:'capture',       icon:ICON.capture, label:'Capture & share' },
  { id:'notifications', icon:ICON.bell,    label:'Notifications' },
  { id:'settings',      icon:ICON.gear,    label:'Settings', bottom:true },
  { id:'power',         icon:ICON.power,   label:'Power',    bottom:true }
];

let activeTab = 'profile';
let open = false;
let notifications = [];

const guide = $('#guide');
const tabs  = $('#guideTabs');
const quick = $('#guideQuick');
const hints = $('#guideHints');
const body  = $('#guideBody');

/* ───────── rows ───────── */
function row({ icon, art, name, meta, right, chevron, onActivate }){
  const btn = el('button', 'grow');
  btn.dataset.nav = '';
  const box = el('div', 'grow-icon' + (art ? '' : ' glyph'));
  if (art){
    const img = el('img', 'cover');
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    window.Media.loadCover(art, img, { priority:true, onFail: () => img.remove() });
    box.append(img);
  } else box.innerHTML = icon || ICON.play;
  btn.append(box);

  const text = el('div', 'grow-text');
  text.append(el('div', 'grow-name', escapeHtml(name)));
  if (meta) text.append(el('div', 'grow-meta', escapeHtml(meta)));
  btn.append(text);

  if (right) btn.append(el('div', 'grow-right', escapeHtml(right)));
  if (chevron) btn.insertAdjacentHTML('beforeend', chevronMark());

  btn._navActivate = () => onActivate?.();
  return btn;
}

/** The gamerpic + gamertag block at the top of a tab. */
function header(title, sub, { pic = false, status = false } = {}){
  const head = el('div', 'guide-head');
  if (pic){
    const box = el('div', 'guide-head-pic');
    const img = el('img');
    img.alt = ''; img.src = window.State.avatar();
    box.append(img);
    head.append(box);
  }
  const text = el('div');
  text.append(el('h2', 'guide-title', escapeHtml(title)));
  if (sub) text.append(el('p', 'guide-sub', escapeHtml(sub)));
  if (status)
    text.insertAdjacentHTML('beforeend',
      '<div class="status-pill"><span class="status-dot"></span>Online</div>');
  head.append(text);
  return head;
}

const timeAgo = ts => {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
};

/* ───────── tab bodies ───────── */
function drawBody(){
  body.innerHTML = '';
  body.scrollTop = 0;
  const S = window.State, C = window.Catalog;

  if (activeTab === 'profile'){
    // Home, then My games & apps, a divider, then recent titles by cover.
    body.append(row({
      icon: ICON.home, name:'Home',
      onActivate: () => { close_(); window.App.setView('home'); }
    }));
    body.append(row({
      icon: ICON.grid, name:'My games & apps',
      onActivate: () => { close_(); window.App.setView('library'); }
    }));

    const recent = S.recentIds().map(id => C.get(id)).filter(Boolean).slice(0, 6);
    const shelf = recent.length
      ? recent
      : C.featured().slice(0, 6);

    if (shelf.length){
      body.append(el('div', 'guide-divider'));
      shelf.forEach(g => body.append(row({
        art: g.coverFile, name: g.name,
        onActivate: () => { close_(); window.App.openDetail(g); }
      })));
    }
  }

  if (activeTab === 'home'){
    body.append(header('Home', 'Jump straight to a pinned tile'));
    const pins = S.pins().map(id => C.get(id)).filter(Boolean);
    if (pins.length){
      const grid = el('div', 'guide-tile-row');
      pins.slice(0, 8).forEach(g => {
        const t = el('button', 'guide-tile');
        t.dataset.nav = '';
        t.append(window.Views.coverArt(g));
        t.setAttribute('aria-label', g.name);
        t._navActivate = () => { close_(); window.App.openDetail(g); };
        grid.append(t);
      });
      body.append(grid);
    } else {
      body.append(el('p', 'guide-sub', 'No pins yet. Press Y on any tile to pin it here.'));
    }

    body.append(el('div', 'guide-section', 'Go to'));
    body.append(row({ icon:ICON.home, name:'Dashboard', meta:'Recent & pins', chevron:true,
      onActivate: () => { close_(); window.App.setView('home'); } }));
    body.append(row({ icon:ICON.grid, name:'My games & apps', meta:`${C.count()} titles`, chevron:true,
      onActivate: () => { close_(); window.App.setView('library'); } }));
  }

  if (activeTab === 'party'){
    body.append(header('Parties & chats', 'This console is running solo'));
    body.append(el('div', 'guide-section', 'Party'));
    body.append(row({ icon:ICON.party, name:'Start a party', meta:'No one else is signed in here',
      onActivate: () => window.App.toast('Parties need a second player',
        'Nobody else is signed in on this console.') }));
    body.append(el('div', 'guide-section', 'Friends'));
    body.append(el('p', 'guide-sub',
      'Your friends list lives on the account you sign in with. This replica keeps everything local to your browser.'));
  }

  if (activeTab === 'achievements'){
    body.append(header('Achievements',
      `${S.unlockedCount()} of ${S.ACHIEVEMENTS.length} · ${S.gamerscore.toLocaleString()} Gamerscore`));
    S.ACHIEVEMENTS.forEach(a => {
      const unlocked = S.isUnlocked(a.id);
      const r = row({
        icon: ICON.trophy,
        name: a.name,
        meta: unlocked ? a.desc : 'Locked — ' + a.desc,
        right: String(a.score)
      });
      if (!unlocked) r.style.opacity = '.5';
      body.append(r);
    });
  }

  if (activeTab === 'capture'){
    body.append(header('Capture & share', 'Grab what is on screen right now'));
    body.append(row({ icon:ICON.capture, name:'Take a screenshot', meta:'Saves a PNG of the dashboard',
      chevron:true, onActivate: () => { close_(); setTimeout(() => window.App.screenshot(), 380); } }));
    body.append(row({ icon:ICON.link, name:'Copy link to this console', meta:location.host || 'local file',
      chevron:true, onActivate: async () => {
        try { await navigator.clipboard.writeText(location.href);
              window.App.toast('Link copied', location.href); }
        catch { window.App.toast('Copy failed', 'Your browser blocked clipboard access.'); }
      } }));
  }

  if (activeTab === 'notifications'){
    body.append(header('Notifications', notifications.length ? `${notifications.length} recent` : 'Nothing new'));
    notifications.slice().reverse().forEach(n => body.append(row({
      icon: n.icon || ICON.bell, name: n.title, meta: n.text, right: timeAgo(n.at)
    })));
    if (!notifications.length)
      body.append(el('p', 'guide-sub', 'Achievements and system messages show up here.'));
  }

  if (activeTab === 'settings'){
    const set = S.settings;
    body.append(header('Settings', 'Quick toggles'));
    body.append(row({ icon:ICON.gear, name:'All settings', meta:'Open the full settings view', chevron:true,
      onActivate: () => { close_(); window.App.setView('settings'); } }));
    body.append(el('div', 'guide-section', 'Quick toggles'));
    body.append(row({ icon:ICON.bell, name:'Navigation sounds', right: set.sounds ? 'On' : 'Off',
      meta:'Audio feedback while moving around',
      onActivate: () => { S.setSetting('sounds', !set.sounds); drawBody(); window.Nav.restore(); } }));
    body.append(row({ icon:ICON.brush, name:'Theme', right: set.theme === 'dark' ? 'Dark' : 'Light',
      meta:'System chrome colour',
      onActivate: () => {
        const next = set.theme === 'dark' ? 'light' : 'dark';
        S.setSetting('theme', next); document.body.dataset.theme = next;
        drawBody(); window.Nav.restore();
      } }));
    body.append(row({ icon:ICON.pad, name:'Reduce motion', right: set.motion === 'reduced' ? 'On' : 'Off',
      meta:'Shorten animations',
      onActivate: () => {
        const next = set.motion === 'reduced' ? 'full' : 'reduced';
        S.setSetting('motion', next); document.documentElement.dataset.motion = next;
        drawBody(); window.Nav.restore();
      } }));
  }

  if (activeTab === 'power'){
    body.append(header('Power', 'What should the console do?'));
    if (window.App.isPlaying()){
      body.append(row({ icon:ICON.back, name:'Quit game', meta:'Return to the dashboard', chevron:true,
        onActivate: () => { close_(); window.App.quitGame(); } }));
    }
    body.append(row({ icon:ICON.power, name:'Restart console', meta:'Replays the boot sequence', chevron:true,
      onActivate: () => location.reload() }));
    body.append(row({ icon:ICON.clock, name:'Turn off', meta:'Fade to black — press anything to wake',
      chevron:true, onActivate: () => { close_(); window.App.powerOff(); } }));
  }

  window.Nav.restore();
}

/* ───────── tab strip ───────── */
function drawRail(){
  tabs.innerHTML = '';
  TABS.forEach(t => tabs.append(tabButton(t)));
  drawQuick();
  drawHints();
}

function tabButton(tab){
  const btn = el('button', 'guide-tab' + (tab.id === activeTab ? ' active' : ''));
  btn.dataset.nav = '';
  btn.dataset.guideTab = tab.id;
  btn.dataset.ringRadius = '.5rem';
  btn.title = tab.label;
  btn.setAttribute('aria-label', tab.label);

  if (tab.icon === 'avatar'){
    const a = el('span', 'guide-avatar');
    const img = el('img');
    img.alt = ''; img.src = window.State.avatar();
    a.append(img);
    btn.append(a);
  } else btn.insertAdjacentHTML('afterbegin', tab.icon);

  if (tab.id === 'notifications' && notifications.length)
    btn.append(el('span', 'tab-badge', String(Math.min(notifications.length, 99))));

  btn._navActivate = () => selectTab(tab.id);
  return btn;
}

/* ───────── quick actions along the bottom ───────── */
const QUICK = [
  { label:'Game Pass', chip:true,        run: () => { close_(); window.App.setView('pass'); } },
  { label:'Store',     icon:ICON.store,  run: () => { close_(); window.App.setView('pass'); } },
  { label:'My games',  icon:ICON.grid,   run: () => { close_(); window.App.setView('library'); } },
  { label:'Search',    icon:ICON.search, run: () => { close_(); window.App.setView('search'); } },
  { label:'Settings',  icon:ICON.gear,   run: () => { close_(); window.App.setView('settings'); } }
];

function drawQuick(){
  quick.innerHTML = '';
  QUICK.forEach(q => {
    const btn = el('button', 'quick-btn');
    btn.dataset.nav = '';
    btn.dataset.ringRadius = '.5rem';
    btn.title = q.label;
    btn.setAttribute('aria-label', q.label);
    btn.innerHTML = q.chip ? '<span class="gp-chip">GAME<br>PASS</span>' : q.icon;
    btn._navActivate = q.run;
    quick.append(btn);
  });
}

/* ───────── contextual hints beside the panel ───────── */
function drawHints(){
  if (!hints) return;
  const rows = [
    [ICON.power,   'Hold for power options'],
    [ICON.capture, 'Share last capture'],
    [ICON.apps,    'More options']
  ];
  hints.innerHTML = rows.map(([glyph, text]) =>
    `<div class="guide-hint"><span class="glyph">${glyph}</span><span>${escapeHtml(text)}</span></div>`
  ).join('');
}

function selectTab(id){
  if (id === activeTab) return;
  activeTab = id;
  drawRail(); drawBody();
  window.Nav.focusFirst('.guide-tab.active');
}

/** Step through tabs with the shoulder buttons, as the real guide does. */
function cycleTab(delta){
  const i = TABS.findIndex(t => t.id === activeTab);
  selectTab(TABS[(i + delta + TABS.length) % TABS.length].id);
}

/* the rail flies out whenever focus is sitting on one of its tabs */


/* ───────── open / close ───────── */
function open_(tab){
  if (open) return;
  open = true;
  document.body.classList.add('guide-open');
  if (tab) activeTab = tab;
  guide.hidden = false;
  guide.classList.remove('out');
  window.Nav.pushLayer(guide);
  drawRail(); drawBody();
  window.Nav.focusFirst('.guide-tab.active');
  window.Sound?.guide(true);
  if (window.App.isPlaying()) window.State.unlock('guide');
}

function close_(){
  if (!open) return;
  open = false;
  document.body.classList.remove('guide-open');
  guide.classList.add('out');
  window.Sound?.guide(false);
  setTimeout(() => {
    guide.hidden = true;
    guide.classList.remove('out');
    window.Nav.popLayer();
    if (window.App.isPlaying()) window.Nav.hideRing();
  }, 200);
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-guide-close]')) close_();
});

window.Guide = {
  open: open_,
  close: close_,
  toggle: tab => (open ? close_() : open_(tab)),
  cycleTab,
  get isOpen(){ return open; },
  notify(n){
    notifications.push({ ...n, at: Date.now() });
    notifications = notifications.slice(-25);
    if (open && activeTab === 'notifications') drawBody();
  },
  refresh(){ if (open){ drawRail(); drawBody(); } }
};
})();
