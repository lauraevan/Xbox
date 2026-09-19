/* ═══════════════════════════════════════════════════════════
   STATE — profile, pins, recents, achievements, settings.
   Everything lives in localStorage so the console "remembers"
   between visits the way a real one does.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const KEY = 'xbox.web.profile.v1';

const DEFAULTS = {
  /* ── the signed-in profile ── */
  profileId:  'p1',
  gamertag:   'NewSasquatch',
  tier:       'ULTIMATE',
  avatarSeed: 1337,
  gamerscore: 0,
  pins:       [],          // game ids, newest first
  recents:    [],          // { id, at, seconds }
  unlocked:   [],          // achievement ids
  installed:  [],          // game ids "installed" to the library

  /* ── other profiles on this console, parked until switched to ── */
  profiles:   [],          // [{ profileId, gamertag, tier, avatarSeed, ... }]

  /* ── console-wide, shared by every profile ── */
  settings: {
    theme:     'dark',
    accent:    '#4ade4a',
    sounds:    true,
    volume:    70,
    motion:    'full',
    background:'dynamic',
    scanline:  false,
    clock24:   false,
    micMuted:  true,
    profileLine: '',    // second line under the gamertag on Home
    profileCapsule:false, // optional black Home profile text capsule
    wallpaper:   '',    // image URL; empty falls back to cover art
    saturation:  1.35,  // backdrop punch
    heroText:  false,   // the console shows no copy over the backdrop
    tileBadges:true,    // tag badges (PORT / FLASH / EMU) ride on the tiles

    /* accessibility */
    textScale:      1,
    highContrast:   false,
    colorFilter:    'none',   // none | protanopia | deuteranopia | tritanopia | mono
    reduceTransparency: false,

    /* display */
    nightMode:      false,
    nightStrength:  45,
    nightFrom:      '21:00',
    nightTo:        '07:00',
    nightAuto:      false,
    safeArea:       0,        // extra inset for overscanning panels

    /* controller */
    buttonMap:      { a:'a', b:'b', x:'x', y:'y' },
    stickDeadzone:  55,
    vibration:      true,

    /* family */
    screenTimeLimit: 0,       // minutes per day, 0 = off
    blockedTags:     []       // catalogue tags withheld from this console
  }
};

/** Fields that belong to a profile rather than to the console. */
const PROFILE_KEYS = ['profileId','gamertag','tier','avatarSeed','gamerscore',
                      'pins','recents','unlocked','installed'];

/* ───────── achievements (original to this build) ───────── */
const ACHIEVEMENTS = [
  { id:'boot',      name:'Power On',           desc:'Start the console for the first time.',       score:10 },
  { id:'first',     name:'First Light',        desc:'Launch your first game.',                     score:20 },
  { id:'five',      name:'Getting Comfortable',desc:'Play five different games.',                  score:30 },
  { id:'twenty',    name:'Library Card',       desc:'Play twenty different games.',                score:70 },
  { id:'pin',       name:'Front and Centre',   desc:'Pin a game to your home screen.',             score:15 },
  { id:'pinfive',   name:'Curator',            desc:'Keep five games pinned at once.',             score:35 },
  { id:'search',    name:'Looking For Trouble',desc:'Find a game using search.',                   score:15 },
  { id:'pass',      name:'All You Can Play',   desc:'Browse the Game Pass catalogue.',             score:15 },
  { id:'theme',     name:'Interior Decorator', desc:'Change your console accent colour.',          score:15 },
  { id:'guide',     name:'Quick Resume',       desc:'Open the guide while a game is running.',     score:20 },
  { id:'flash',     name:'Archivist',          desc:'Play something from the Flash vault.',        score:25 },
  { id:'emu',       name:'Backwards Compatible', desc:'Launch an emulator.',                       score:25 },
  { id:'marathon',  name:'Just One More',      desc:'Spend thirty minutes in games this session.', score:50 },
  { id:'completist',name:'Completionist',      desc:'Unlock every other achievement.',             score:100 }
];

/* ───────── persistence ───────── */
function read(){
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS), ...saved,
      settings: { ...DEFAULTS.settings, ...(saved.settings || {}) }
    };
  } catch { return structuredClone(DEFAULTS); }
}

let data = read();
let saveTimer = null;

function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }, 120);
}

/** Write immediately, for cases where the page may be about to go away. */
function flush(){
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

/* a debounced write is lost if the page is reloaded or closed inside the
   window, which loses whatever the user just changed */
addEventListener('pagehide', flush);
addEventListener('beforeunload', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

const listeners = new Set();
const emit = evt => listeners.forEach(fn => { try { fn(evt); } catch {} });

/* ───────── original procedural avatar ─────────
   A seeded geometric mark, drawn here rather than pulled from anywhere. */
function avatarDataUri(seed){
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const hue = Math.floor(rnd() * 360);
  const hue2 = (hue + 40 + Math.floor(rnd() * 90)) % 360;
  const cells = [];
  for (let y = 0; y < 5; y++){
    for (let x = 0; x < 3; x++){
      if (rnd() > .45){
        const c = rnd() > .5 ? `hsl(${hue2} 70% 72%)` : 'rgba(255,255,255,.88)';
        cells.push(`<rect x="${x * 20 + 10}" y="${y * 20 + 10}" width="20" height="20" fill="${c}"/>`);
        if (x < 2) cells.push(`<rect x="${(4 - x) * 20 + 10}" y="${y * 20 + 10}" width="20" height="20" fill="${c}"/>`);
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="hsl(${hue} 55% 34%)"/>` +
      `<stop offset="1" stop-color="hsl(${hue} 65% 16%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="120" height="120" fill="url(#g)"/>${cells.join('')}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* ───────── API ───────── */
const State = {
  ACHIEVEMENTS,

  get data(){ return data; },
  get settings(){ return data.settings; },
  get gamerscore(){ return data.gamerscore; },

  on(fn){ listeners.add(fn); return () => listeners.delete(fn); },

  /** Commit any pending write now. */
  flush,

  avatar(){ return avatarDataUri(data.avatarSeed); },
  avatarFor(seed){ return avatarDataUri(seed || 0); },

  setGamertag(name){
    data.gamertag = String(name).slice(0, 15) || 'Player';
    save(); emit({ type:'profile' });
  },

  rerollAvatar(){
    data.avatarSeed = Math.floor(Math.random() * 1e6);
    save(); emit({ type:'profile' });
  },

  setSetting(key, value){
    data.settings[key] = value;
    save(); emit({ type:'settings', key, value });
  },

  /* ── pins ── */
  isPinned: id => data.pins.includes(String(id)),
  togglePin(id){
    id = String(id);
    const i = data.pins.indexOf(id);
    if (i >= 0) data.pins.splice(i, 1);
    else {
      data.pins.unshift(id);
      State.unlock('pin');
      if (data.pins.length >= 5) State.unlock('pinfive');
    }
    save(); emit({ type:'pins' });
    return i < 0;
  },
  pins(){ return data.pins; },

  /* ── recents / play sessions ── */
  recents(){ return data.recents; },
  recentIds(){ return data.recents.map(r => r.id); },
  playedCount(){ return data.recents.length; },

  markPlayed(game){
    const id = String(game.id);
    const now = Date.now();
    const found = data.recents.find(r => r.id === id);
    if (found){ found.at = now; found.plays = (found.plays || 1) + 1; }
    else data.recents.unshift({ id, at: now, seconds: 0, plays: 1 });

    data.recents.sort((a, b) => b.at - a.at);
    data.recents = data.recents.slice(0, 40);
    if (!data.installed.includes(id)) data.installed.push(id);

    State.unlock('first');
    if (data.recents.length >= 5)  State.unlock('five');
    if (data.recents.length >= 20) State.unlock('twenty');
    if (game.special?.includes('flash')) State.unlock('flash');
    if (game.special?.some(s => ['emulator','nes','n64','gba','nds','psx'].includes(s))) State.unlock('emu');

    save(); emit({ type:'recents' });
  },

  addPlaytime(id, seconds){
    const r = data.recents.find(x => x.id === String(id));
    if (r) r.seconds = (r.seconds || 0) + seconds;
    save();
  },

  totalPlaySeconds(){ return data.recents.reduce((n, r) => n + (r.seconds || 0), 0); },

  installed(){ return data.installed; },

  /* ── achievements ── */
  isUnlocked: id => data.unlocked.includes(id),
  unlock(id){
    if (data.unlocked.includes(id)) return false;
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return false;

    data.unlocked.push(id);
    data.gamerscore += ach.score;
    save();
    emit({ type:'achievement', achievement: ach });

    // the completionist award tracks every other entry in the list
    const others = ACHIEVEMENTS.filter(a => a.id !== 'completist');
    if (id !== 'completist' && others.every(a => data.unlocked.includes(a.id))){
      setTimeout(() => State.unlock('completist'), 2600);
    }
    return true;
  },
  unlockedCount(){ return data.unlocked.length; },

  /* ── profiles ── */
  profiles(){
    return [{ ...pick(data), active:true },
            ...data.profiles.map(p => ({ ...p, active:false }))];
  },

  addProfile(name){
    const profile = {
      ...structuredClone(DEFAULTS),
      profileId: 'p' + Date.now().toString(36),
      gamertag: String(name || 'Player').slice(0, 15),
      avatarSeed: Math.floor(Math.random() * 1e6),
      gamerscore: 0
    };
    delete profile.profiles;
    delete profile.settings;
    data.profiles.push(pick(profile));
    save(); emit({ type:'profiles' });
    return profile.profileId;
  },

  switchProfile(id){
    if (id === data.profileId) return false;
    const target = data.profiles.find(p => p.profileId === id);
    if (!target) return false;

    // park the signed-in profile, then sign the target in
    const parked = pick(data);
    data.profiles = data.profiles.filter(p => p.profileId !== id);
    data.profiles.push(parked);
    Object.assign(data, pick(target));

    save(); emit({ type:'profile' }); emit({ type:'profiles' });
    return true;
  },

  removeProfile(id){
    if (id === data.profileId) return false;
    data.profiles = data.profiles.filter(p => p.profileId !== id);
    save(); emit({ type:'profiles' });
    return true;
  },

  /* ── family ── */
  isBlocked(game){
    const blocked = data.settings.blockedTags;
    return !!blocked.length && game.special?.some(t => blocked.includes(t));
  },

  toggleBlockedTag(tag){
    const list = data.settings.blockedTags;
    const i = list.indexOf(tag);
    if (i >= 0) list.splice(i, 1); else list.push(tag);
    save(); emit({ type:'settings', key:'blockedTags' });
  },

  reset(){
    data = structuredClone(DEFAULTS);
    try { localStorage.removeItem(KEY); } catch {}
    emit({ type:'reset' });
  }
};

/** Copy just the profile-owned fields out of a record. */
function pick(src){
  const out = {};
  for (const k of PROFILE_KEYS) out[k] = structuredClone(src[k]);
  return out;
}

window.State = State;
})();
