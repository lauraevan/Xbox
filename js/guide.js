/* ═══════════════════════════════════════════════════════════
   GUIDE — the overlay that slides in from the left on the
   Guide button (Esc / G / gamepad button 16).
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { el, escapeHtml, ICON } = window.Views;
const $ = sel => document.querySelector(sel);

const TABS = [
  { id:'profile',      icon:'avatar', label:'Profile & system' },
  { id:'home',         icon:ICON.home,    label:'Home' },
  { id:'party',        icon:ICON.party,   label:'Parties & chats' },
  { id:'achievements', icon:ICON.trophy,  label:'Achievements' },
  { id:'capture',      icon:ICON.capture, label:'Capture & share' },
  { id:'notifications',icon:ICON.bell,    label:'Notifications' },
  { id:'settings',     icon:ICON.gear,    label:'Settings', bottom:true },
  { id:'power',        icon:ICON.power,   label:'Power',    bottom:true }
];

let activeTab = 'profile';
let open = false;
let notifications = [];

const guide = $('#guide');
const rail  = $('#guideRail');
const body  = $('#guideBody');

/* ───────── rows ───────── */
function row({ icon, art, name, meta, right, onActivate }){
  const btn = el('button', 'grow');
  btn.dataset.nav = '';
  const box = el('div', 'grow-icon');
  if (art){
    const img = el('img');
    img.alt = ''; img.loading = 'lazy'; img.src = art;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    box.append(img);
  } else box.innerHTML = icon || ICON.play;
  btn.append(box);

  const text = el('div', 'grow-text');
  text.append(el('div', 'grow-name', escapeHtml(name)));
  if (meta) text.append(el('div', 'grow-meta', escapeHtml(meta)));
  btn.append(text);
  if (right) btn.append(el('div', 'grow-right', escapeHtml(right)));
  btn._navActivate = () => onActivate?.();
  return btn;
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
  const S = window.State, C = window.Catalog;

  if (activeTab === 'profile'){
    body.append(el('h2', 'guide-title', escapeHtml(S.data.gamertag)));
    body.append(el('p', 'guide-sub', `${S.gamerscore} Gamerscore · ${S.data.tier}`));

    body.append(el('div', 'guide-section', 'Recently played'));
    const recents = S.recentIds().map(id => C.get(id)).filter(Boolean).slice(0, 5);
    if (!recents.length) body.append(el('p', 'guide-sub', 'Nothing yet — launch something.'));
    recents.forEach(g => body.append(row({
      art:g.cover, name:g.name, meta:g.author,
      onActivate: () => { close_(); window.App.openDetail(g); }
    })));

    body.append(el('div', 'guide-section', 'Quick actions'));
    body.append(row({ icon:ICON.search, name:'Search', meta:'Find a game by name',
      onActivate: () => { close_(); window.App.setView('search'); } }));
    body.append(row({ icon:ICON.store, name:'Game Pass', meta:`${C.count()} titles included`,
      onActivate: () => { close_(); window.App.setView('pass'); } }));
    body.append(row({ icon:ICON.person, name:'Change gamertag', meta:'Rename this profile',
      onActivate: () => { close_(); window.App.promptGamertag(); } }));
  }

  if (activeTab === 'home'){
    body.append(el('h2', 'guide-title', 'Home'));
    body.append(el('p', 'guide-sub', 'Jump straight to a pinned tile'));
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
      body.append(el('p', 'guide-sub', 'No pins yet. Press Y on any tile to pin it.'));
    }
    body.append(el('div', 'guide-section', 'Go to'));
    body.append(row({ icon:ICON.home, name:'Dashboard', meta:'Recent & pins',
      onActivate: () => { close_(); window.App.setView('home'); } }));
    body.append(row({ icon:ICON.grid, name:'My games & apps', meta:`${C.count()} titles`,
      onActivate: () => { close_(); window.App.setView('library'); } }));
  }

  if (activeTab === 'party'){
    body.append(el('h2', 'guide-title', 'Parties & chats'));
    body.append(el('p', 'guide-sub', 'This console is running solo'));
    body.append(el('div', 'guide-section', 'Party'));
    body.append(row({ icon:ICON.party, name:'Start a party', meta:'No one else is signed in here',
      onActivate: () => window.App.toast('Parties need a second player', 'Nobody else is signed in on this console.') }));
    body.append(el('div', 'guide-section', 'Friends'));
    body.append(el('p', 'guide-sub', 'Your friends list lives on the account you sign in with. This replica keeps everything local to your browser.'));
  }

  if (activeTab === 'achievements'){
    const total = S.ACHIEVEMENTS.length, done = S.unlockedCount();
    body.append(el('h2', 'guide-title', 'Achievements'));
    body.append(el('p', 'guide-sub', `${done} of ${total} · ${S.gamerscore} Gamerscore`));
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
    body.append(el('h2', 'guide-title', 'Capture & share'));
    body.append(el('p', 'guide-sub', 'Grab what is on screen right now'));
    body.append(row({ icon:ICON.capture, name:'Take a screenshot', meta:'Saves a PNG of the dashboard',
      onActivate: () => { close_(); setTimeout(() => window.App.screenshot(), 380); } }));
    body.append(row({ icon:ICON.link, name:'Copy link to this console', meta:location.host || 'local file',
      onActivate: async () => {
        try { await navigator.clipboard.writeText(location.href); window.App.toast('Link copied', location.href); }
        catch { window.App.toast('Copy failed', 'Your browser blocked clipboard access.'); }
      } }));
  }

  if (activeTab === 'notifications'){
    body.append(el('h2', 'guide-title', 'Notifications'));
    body.append(el('p', 'guide-sub', notifications.length ? `${notifications.length} recent` : 'Nothing new'));
    notifications.slice().reverse().forEach(n => body.append(row({
      icon: n.icon || ICON.bell, name: n.title, meta: n.text, right: timeAgo(n.at)
    })));
    if (!notifications.length)
      body.append(el('p', 'guide-sub', 'Achievements and system messages show up here.'));
  }

  if (activeTab === 'settings'){
    body.append(el('h2', 'guide-title', 'Settings'));
    body.append(el('p', 'guide-sub', 'Quick toggles'));
    const set = S.settings;
    body.append(row({ icon:ICON.gear, name:'All settings', meta:'Open the full settings view',
      onActivate: () => { close_(); window.App.setView('settings'); } }));
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
    body.append(el('h2', 'guide-title', 'Power'));
    body.append(el('p', 'guide-sub', 'What should the console do?'));
    if (window.App.isPlaying()){
      body.append(row({ icon:ICON.back, name:'Quit game', meta:'Return to the dashboard',
        onActivate: () => { close_(); window.App.quitGame(); } }));
    }
    body.append(row({ icon:ICON.power, name:'Restart console', meta:'Replays the boot sequence',
      onActivate: () => location.reload() }));
    body.append(row({ icon:ICON.clock, name:'Turn off', meta:'Fade to black — reload to wake it',
      onActivate: () => { close_(); window.App.powerOff(); } }));
  }

  window.Nav.restore();
}

/* ───────── rail ───────── */
function drawRail(){
  rail.innerHTML = '';
  TABS.filter(t => !t.bottom).forEach(t => rail.append(tabButton(t)));
  rail.append(el('div', 'rail-spacer'));
  TABS.filter(t => t.bottom).forEach(t => rail.append(tabButton(t)));
}

function tabButton(tab){
  const btn = el('button', 'guide-tab' + (tab.id === activeTab ? ' active' : ''));
  btn.dataset.nav = '';
  btn.dataset.ringRadius = '1rem';
  btn.title = tab.label;
  btn.setAttribute('aria-label', tab.label);
  if (tab.icon === 'avatar'){
    const a = el('span', 'guide-avatar');
    const img = el('img');
    img.alt = ''; img.src = window.State.avatar();
    a.append(img);
    btn.append(a);
  } else btn.innerHTML = tab.icon;
  btn._navActivate = () => {
    activeTab = tab.id;
    drawRail(); drawBody();
    window.Nav.focusFirst('.guide-tab.active');
  };
  return btn;
}

/* ───────── open / close ───────── */
function open_(tab){
  if (open) return;
  open = true;
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
  guide.classList.add('out');
  window.Sound?.guide(false);
  setTimeout(() => {
    guide.hidden = true;
    guide.classList.remove('out');
    window.Nav.popLayer();
    if (window.App.isPlaying()) window.Nav.hideRing();
  }, 220);
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-guide-close]')) close_();
});

window.Guide = {
  open: open_,
  close: close_,
  toggle: tab => (open ? close_() : open_(tab)),
  get isOpen(){ return open; },
  notify(n){
    notifications.push({ ...n, at: Date.now() });
    notifications = notifications.slice(-25);
    if (open && activeTab === 'notifications') drawBody();
  },
  refresh(){ if (open){ drawRail(); drawBody(); } }
};
})();
