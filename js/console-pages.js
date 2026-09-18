/* Full Xbox-style secondary pages. Loaded after views.js and before app.js so
   the core router captures these richer console renderers. */
(() => {
'use strict';

const V = window.Views;
if (!V) return;
const { el, escapeHtml, ICON } = V;
const S = () => window.State;
const C = () => window.Catalog;
const Cloud = () => window.StratusCloud;

let libraryMode = 'full';
let passMode = 'home';
let settingsMode = 'general';
let settingsDetail = null;
let searchQuery = '';
let librarySort = 'A–Z';

const safe = v => escapeHtml(String(v ?? ''));
const nav = (node, fn) => {
  node.dataset.nav = '';
  node._navActivate = fn;
  return node;
};

function imageForCatalog(game, priority = false){
  const art = V.coverArt(game, { priority });
  art.classList.add('console-cover-art');
  return art;
}

function poster(game, opts = {}){
  const btn = nav(el('button', 'console-poster'), () => {
    if (opts.cloud){
      Cloud()?.play?.(game).catch(err => window.App?.toast?.('Cloud gaming', err?.message || 'Could not start game.'));
      return;
    }
    window.App?.openDetail?.(game);
  });
  btn.dataset.ringRadius = '.45rem';
  btn.setAttribute('aria-label', game.name);

  const art = el('span', 'console-poster-art');
  if (opts.cloud){
    const img = document.createElement('img');
    img.src = game.cover || game.image || '';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    art.append(img);
    art.append(el('span', 'console-cloud-pill', `${ICON.play}<span>CLOUD</span>`));
  } else {
    art.append(imageForCatalog(game));
    if (game.tag) art.append(el('span', 'console-tag', safe(game.tag.badge || game.tag.label)));
  }

  btn.append(
    art,
    el('span', 'console-poster-name', safe(game.name)),
    el('span', 'console-poster-meta', safe(opts.meta || (opts.cloud ? 'Ready to play' : (game.author || 'Ready to play'))))
  );
  return btn;
}

function miniPoster(game, opts = {}){
  const btn = poster(game, opts);
  btn.classList.add('console-poster-mini');
  return btn;
}

function topBar(title, subtitle){
  const head = el('header', 'console-page-head');
  head.innerHTML = `
    <div>
      <div class="console-page-kicker">XBOX</div>
      <h1>${safe(title)}</h1>
      ${subtitle ? `<p>${safe(subtitle)}</p>` : ''}
    </div>
    <div class="console-head-actions">
      <span class="console-head-profile">xboxtest</span>
      <span class="console-head-clock">${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}</span>
    </div>`;
  return head;
}

function sidebar(items, active, onPick, brand){
  const side = el('aside', 'console-side');
  if (brand) side.append(el('div', 'console-side-brand', brand));
  const list = el('nav', 'console-side-list');
  items.forEach(item => {
    const btn = nav(el('button', 'console-side-item' + (active === item.id ? ' active' : '')), () => onPick(item.id));
    btn.innerHTML = `<span class="console-side-icon">${ICON[item.icon] || ICON.grid}</span><span>${safe(item.label)}</span>`;
    list.append(btn);
  });
  side.append(list);
  return side;
}

function focusAfter(root, selector){
  requestAnimationFrame(() => window.Nav?.focusIn?.(root, selector));
}

/* ───────────────────────── MY GAMES & APPS ───────────────────────── */
const LIB_ITEMS = [
  { id:'full', label:'Full library', icon:'library' },
  { id:'owned', label:'Owned games', icon:'games' },
  { id:'gamepass', label:'Xbox Game Pass', icon:'grid' },
  { id:'apps', label:'Apps', icon:'apps' },
  { id:'groups', label:'Groups', icon:'pin' },
  { id:'history', label:'Play history', icon:'clock' },
  { id:'manage', label:'Manage', icon:'gear' }
];

function catalogForLibrary(mode){
  const cat = C();
  const state = S();
  if (!cat || !state) return [];
  if (mode === 'history') return state.recentIds().map(id => cat.get(id)).filter(Boolean);
  if (mode === 'apps') return cat.byTag?.('tools') || [];
  if (mode === 'groups') return state.pins().map(id => cat.get(id)).filter(Boolean);
  if (mode === 'gamepass') return cat.featured?.() || [];
  if (mode === 'owned') return cat.standard?.() || cat.all();
  return cat.all();
}

function sortGames(list){
  const copy = list.slice();
  if (librarySort === 'Recently used'){
    const order = new Map(S().recentIds().map((id, i) => [String(id), i]));
    return copy.sort((a,b) => (order.get(String(a.id)) ?? 99999) - (order.get(String(b.id)) ?? 99999));
  }
  if (librarySort === 'Z–A') return copy.sort((a,b) => b.name.localeCompare(a.name));
  return copy.sort((a,b) => a.name.localeCompare(b.name));
}

async function renderLibrary(root){
  root.innerHTML = '';
  root.classList.add('console-page-view');
  const shell = el('div', 'console-shell console-library');
  const main = el('main', 'console-main');
  const modeMeta = {
    full:['Full library','Everything available on this console'],
    owned:['Owned games','Games you can launch from this console'],
    gamepass:['Xbox Game Pass','Included with your membership'],
    apps:['Apps','System and entertainment apps'],
    groups:['Groups','Pinned collections and favorites'],
    history:['Play history','Your recent games across this console'],
    manage:['Manage','Storage, queues, updates and library options']
  }[libraryMode];

  shell.append(sidebar(LIB_ITEMS, libraryMode, id => {
    libraryMode = id;
    renderLibrary(root);
  }, 'My games & apps'));
  main.append(topBar(modeMeta[0], modeMeta[1]));

  if (libraryMode === 'manage'){
    const manage = el('section', 'console-manage-grid');
    [
      ['Queue','No active installs','apps'],
      ['Updates','Everything is up to date','clock'],
      ['Free up space','Cloud titles use no local storage','storage'],
      ['Subscriptions','Game Pass Ultimate','person'],
      ['Remote access','Cloud play enabled','link'],
      ['Library options','Poster artwork and status icons','gear']
    ].forEach(([title, sub, icon]) => {
      const card = nav(el('button','console-manage-card'), () => window.App?.toast?.(title, sub));
      card.innerHTML = `<span>${ICON[icon] || ICON.grid}</span><strong>${safe(title)}</strong><small>${safe(sub)}</small>`;
      manage.append(card);
    });
    main.append(manage);
    shell.append(main); root.append(shell); focusAfter(root, '.console-manage-card'); return;
  }

  const toolbar = el('div', 'console-library-toolbar');
  const sort = nav(el('button','console-tool-btn', `${ICON.column_triple || ICON.grid}<span>${safe(librarySort)}</span>`), () => {
    const vals = ['A–Z','Z–A','Recently used'];
    librarySort = vals[(vals.indexOf(librarySort) + 1) % vals.length];
    renderLibrary(root);
  });
  const search = nav(el('button','console-tool-btn', `${ICON.search}<span>Search library</span>`), () => window.App?.setView?.('search'));
  toolbar.append(sort, search);
  main.append(toolbar);

  let items = sortGames(catalogForLibrary(libraryMode));
  const grid = el('section','console-poster-grid');

  if (libraryMode === 'history'){
    const groups = [
      ['Today', items.slice(0,8)],
      ['Earlier', items.slice(8,24)]
    ].filter(([,arr]) => arr.length);
    if (!groups.length){
      main.append(el('div','console-empty',`${ICON.clock}<h2>No play history yet</h2><p>Your recently played games will appear here.</p>`));
    } else {
      groups.forEach(([name, arr]) => {
        const sec = el('section','console-history-group');
        sec.append(el('h2','console-section-title',safe(name)));
        const row = el('div','console-horizontal-row');
        arr.forEach(g => row.append(poster(g, { meta:'Played recently' })));
        sec.append(row); main.append(sec);
      });
    }
  } else {
    const head = el('div','console-grid-head');
    head.innerHTML = `<h2>${items.length.toLocaleString()} games</h2><span>Poster view</span>`;
    main.append(head);
    items.slice(0, 140).forEach(g => grid.append(poster(g)));
    main.append(grid);
  }

  try {
    const ownedCloud = await Cloud()?.ownedGames?.();
    if (ownedCloud?.length && root.isConnected && libraryMode !== 'history'){
      const sec = el('section','console-cloud-library');
      sec.append(el('div','console-grid-head','<h2>Cloud games you own</h2><span>Ready to stream</span>'));
      const row = el('div','console-horizontal-row');
      ownedCloud.slice(0,18).forEach(g => row.append(poster(g,{ cloud:true, meta:'Cloud • Ready to play' })));
      sec.append(row);
      main.insertBefore(sec, grid || null);
    }
  } catch {}

  shell.append(main);
  root.append(shell);
  focusAfter(root, '.console-side-item.active');
}

/* ───────────────────────── GAME PASS ───────────────────────── */
const PASS_ITEMS = [
  { id:'home', label:'Home', icon:'home' },
  { id:'all', label:'All games', icon:'games' },
  { id:'recent', label:'Recently added', icon:'clock' },
  { id:'perks', label:'Perks', icon:'trophy' },
  { id:'playlater', label:'Play later', icon:'pin' }
];

function passGames(){
  const cat = C();
  return cat?.featured?.().length ? cat.featured() : cat?.all?.() || [];
}

function gamePassHero(game){
  const hero = nav(el('button','console-pass-hero'), () => window.App?.openDetail?.(game));
  hero.dataset.ringRadius = '.6rem';
  const art = el('div','console-pass-hero-art');
  const img = document.createElement('img'); img.alt=''; img.decoding='async';
  window.Media?.resolveCover?.(game.coverFile, url => { img.src=url; }, () => {});
  art.append(img);
  hero.append(art, el('div','console-pass-hero-shade'));
  hero.append(el('div','console-pass-hero-copy',`
    <div class="console-pass-logo">GAME PASS</div>
    <div class="console-pass-kicker">PLAY DAY ONE</div>
    <h1>${safe(game.name)}</h1>
    <p>${safe(game.author || 'Included with Xbox Game Pass')}</p>
    <span class="console-pass-play">${ICON.play} PLAY</span>`));
  return hero;
}

function passShelf(title, subtitle, games){
  const sec = el('section','console-pass-shelf');
  sec.innerHTML = `<div class="console-shelf-head"><div><h2>${safe(title)}</h2><p>${safe(subtitle)}</p></div><span>${games.length}</span></div>`;
  const row = el('div','console-horizontal-row');
  games.slice(0,18).forEach(g => row.append(miniPoster(g)));
  sec.append(row); return sec;
}

function renderPass(root){
  root.innerHTML=''; root.classList.add('console-page-view');
  S()?.unlock?.('pass');
  const shell=el('div','console-shell console-pass');
  const main=el('main','console-main console-pass-main');
  shell.append(sidebar(PASS_ITEMS, passMode, id => { passMode=id; renderPass(root); }, '<span class="console-gamepass-word">GAME PASS</span>'));
  const all=passGames();
  const shuffled=C()?.seededShuffle?.(all, 47) || all;

  main.append(topBar('Xbox Game Pass','Discover your next favorite game'));
  const tabs=el('div','console-top-tabs');
  PASS_ITEMS.forEach(item => {
    const b=nav(el('button','console-top-tab'+(passMode===item.id?' active':''),safe(item.label)),()=>{passMode=item.id;renderPass(root);}); tabs.append(b);
  });
  main.append(tabs);

  if (passMode==='home'){
    const heroGame=shuffled[0] || C().all()[0];
    if (heroGame) main.append(gamePassHero(heroGame));
    main.append(passShelf('Recently added','Fresh additions to the catalog',shuffled.slice(1,15)));
    main.append(passShelf('Most popular','Popular with Game Pass members',shuffled.slice(15,30)));
    main.append(passShelf('Cloud gaming','Play instantly without installing',shuffled.slice(30,46)));
  } else if (passMode==='perks'){
    const perks=el('section','console-perks-grid');
    [
      ['Ultimate Perks','In-game content and member rewards','trophy'],
      ['EA Play','A collection of EA favorites','games'],
      ['Riot Games benefits','Unlock member benefits in supported games','person'],
      ['Deals with Game Pass','Member-only savings on games and add-ons','store']
    ].forEach(([title,sub,icon])=>{
      const card=nav(el('button','console-perk-card'),()=>window.App?.toast?.(title,'Included with your membership'));
      card.innerHTML=`<span>${ICON[icon]||ICON.trophy}</span><strong>${safe(title)}</strong><small>${safe(sub)}</small><b>VIEW</b>`; perks.append(card);
    }); main.append(perks);
  } else {
    let list=shuffled;
    if(passMode==='recent') list=shuffled.slice(0,42);
    if(passMode==='playlater') list=S().pins().map(id=>C().get(id)).filter(Boolean);
    const grid=el('section','console-poster-grid console-pass-grid');
    list.slice(0,120).forEach(g=>grid.append(poster(g)));
    main.append(el('div','console-grid-head',`<h2>${passMode==='playlater'?'Play later':passMode==='recent'?'Recently added':'All games'}</h2><span>${list.length.toLocaleString()} games</span>`),grid);
  }

  shell.append(main); root.append(shell); focusAfter(root,'.console-side-item.active');
}

/* ───────────────────────── SEARCH ───────────────────────── */
const KEY_ROWS=['1234567890','QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];

function renderSearch(root){
  root.innerHTML=''; root.classList.add('console-page-view');
  const page=el('div','console-search-page');
  page.append(topBar('Search','Find games, apps, settings and Store content'));

  const body=el('div','console-search-body');
  const left=el('section','console-search-entry');
  const field=el('div','console-search-field');
  field.innerHTML=ICON.search;
  const input=document.createElement('input');
  input.value=searchQuery; input.placeholder='Search'; input.autocomplete='off'; input.setAttribute('aria-label','Search Xbox');
  field.append(input); left.append(field);

  const quick=el('div','console-search-chips');
  ['Games & apps','Microsoft Store','Settings','People'].forEach(label=>{
    const b=nav(el('button','console-chip',label),()=>{ searchQuery=label==='Games & apps'?'':label; input.value=searchQuery; draw(); }); quick.append(b);
  }); left.append(quick);

  const keyboard=el('div','console-keyboard');
  KEY_ROWS.forEach(row=>{
    const line=el('div','console-key-row');
    [...row].forEach(ch=>{
      const b=nav(el('button','console-key',ch),()=>{searchQuery=(searchQuery+ch).slice(0,48);input.value=searchQuery;draw();}); line.append(b);
    }); keyboard.append(line);
  });
  const commands=el('div','console-key-row commands');
  const space=nav(el('button','console-key wide','SPACE'),()=>{searchQuery+=' ';input.value=searchQuery;draw();});
  const del=nav(el('button','console-key','⌫'),()=>{searchQuery=searchQuery.slice(0,-1);input.value=searchQuery;draw();});
  const clear=nav(el('button','console-key','CLEAR'),()=>{searchQuery='';input.value='';draw();});
  commands.append(space,del,clear); keyboard.append(commands); left.append(keyboard);

  const right=el('section','console-search-results');
  const status=el('div','console-search-status');
  const grid=el('div','console-poster-grid console-search-grid');
  right.append(status,grid);
  body.append(left,right); page.append(body); root.append(page);

  function draw(){
    grid.innerHTML='';
    const q=searchQuery.trim();
    const found=q ? C().search(q).slice(0,48) : C().seededShuffle(C().all(),23).slice(0,24);
    status.innerHTML=q ? `<h2>Search results</h2><span>${found.length} for “${safe(q)}”</span>` : '<h2>Suggested for you</h2><span>Popular games and apps</span>';
    found.forEach(g=>grid.append(miniPoster(g)));
    if(q && !found.length) grid.append(el('div','console-empty','<h2>No results</h2><p>Try a different search.</p>'));
    window.Nav?.repaint?.();
  }
  input.addEventListener('input',()=>{searchQuery=input.value.slice(0,48);draw();});
  draw(); focusAfter(root,'.console-search-field input');
}

/* ───────────────────────── SETTINGS ───────────────────────── */
const SETTINGS_ITEMS=[
  {id:'general',label:'General',icon:'gear'},
  {id:'account',label:'Account',icon:'person'},
  {id:'personalization',label:'Personalization',icon:'brush'},
  {id:'network',label:'Network settings',icon:'link'},
  {id:'devices',label:'Devices & connections',icon:'pad'},
  {id:'cloud',label:'Cloud settings',icon:'play'},
  {id:'accessibility',label:'Accessibility',icon:'person'},
  {id:'family',label:'Family settings',icon:'people'},
  {id:'system',label:'System',icon:'apps'}
];

const SETTINGS_DETAIL_TITLES={
  power:'Power options',
  display:'TV & display options',
  audio:'Volume & audio output',
  privacy:'Privacy & online safety',
  networkAdvanced:'Advanced network settings',
  controllers:'Controllers & headsets',
  consoleInfo:'Console info',
  storage:'Storage devices'
};

function pref(key, fallback){
  try { const v=localStorage.getItem('xbox.pref.'+key); return v==null?fallback:JSON.parse(v); } catch { return fallback; }
}
function setPref(key,val){ try { localStorage.setItem('xbox.pref.'+key,JSON.stringify(val)); } catch {} }
const nextOf=(values,current)=>values[(Math.max(0,values.indexOf(current))+1)%values.length];

function applySetting(key,value){
  const state=S();
  state.setSetting(key,value);
  window.App?.applySettings?.();
  if(key==='micMuted') window.App?.syncMicIcon?.();
  if(key==='clock24') window.App?.tickClock?.();
}

function settingsRow(title,sub,value,action,kind='value'){
  const b=nav(el('button','console-settings-row'),action||(()=>{}));
  b.innerHTML=`<span class="console-settings-copy"><strong>${safe(title)}</strong><small>${safe(sub)}</small></span><span class="console-settings-value ${kind}">${safe(value)}</span>`;
  return b;
}
function toggleRow(title,sub,on,action){
  const b=settingsRow(title,sub,'',action,'toggle');
  const v=b.querySelector('.console-settings-value');
  v.innerHTML=`<i class="console-toggle ${on?'on':''}"><span></span></i>`;
  return b;
}
function backRow(root){
  const b=settingsRow('Back','Return to the previous Settings page','‹',()=>{
    settingsDetail=null;
    renderSettings(root);
  });
  b.classList.add('console-settings-back');
  return b;
}
function openDetail(root,id){
  settingsDetail=id;
  renderSettings(root);
}
function setMode(root,id){
  settingsMode=id;
  settingsDetail=null;
  renderSettings(root);
}
function exportProfile(){
  try{
    const blob=new Blob([JSON.stringify(S().data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='xbox-profile-backup.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    window.App?.toast?.('Backup created','Profile and console settings exported');
  }catch{
    window.App?.toast?.('Backup failed','This browser blocked the export');
  }
}
function renderSettingsDetail(root,panel,state,set){
  panel.append(backRow(root));

  if(settingsDetail==='power'){
    const boot=set.bootVideo!==false;
    const mode=pref('power','Sleep');
    panel.append(
      toggleRow('Startup animation','Play the Xbox startup animation when the dashboard opens',boot,()=>{applySetting('bootVideo',!boot);renderSettings(root);}),
      settingsRow('Power mode','Choose what the console does when it powers down',mode,()=>{setPref('power',mode==='Sleep'?'Shutdown (energy saving)':'Sleep');renderSettings(root);}),
      settingsRow('Turn off console','Fade the display to black until the next input','Turn off',()=>window.App?.powerOff?.())
    );
  }

  if(settingsDetail==='display'){
    const sat=set.saturation ?? 1.35;
    const sats=[1,1.15,1.35,1.5];
    const safeArea=set.safeArea ?? 0;
    const safeValues=[0,.5,1,1.5,2];
    panel.append(
      toggleRow('Night mode','Dim and warm the dashboard using the saved night strength',!!set.nightMode,()=>{applySetting('nightMode',!set.nightMode);renderSettings(root);}),
      toggleRow('24-hour clock','Use 24-hour time in the Xbox status area',!!set.clock24,()=>{applySetting('clock24',!set.clock24);renderSettings(root);}),
      settingsRow('Safe area','Inset dashboard content for overscanning displays',safeArea?String(safeArea):'Off',()=>{applySetting('safeArea',nextOf(safeValues,safeArea));renderSettings(root);}),
      settingsRow('Background saturation','Adjust the strength of game artwork',Math.round(sat*100)+'%',()=>{applySetting('saturation',nextOf(sats,sat));renderSettings(root);}),
      toggleRow('Scanline effect','Add the optional display scanline layer',!!set.scanline,()=>{applySetting('scanline',!set.scanline);renderSettings(root);})
    );
  }

  if(settingsDetail==='audio'){
    const levels=[0,25,50,70,85,100];
    const vol=levels.includes(set.volume)?set.volume:70;
    panel.append(
      settingsRow('Dashboard volume','Master volume for Xbox navigation and notification sounds',vol+'%',()=>{applySetting('volume',nextOf(levels,vol));renderSettings(root);}),
      toggleRow('Navigation sounds','Play sounds while moving around the dashboard',!!set.sounds,()=>{applySetting('sounds',!set.sounds);renderSettings(root);}),
      toggleRow('Microphone','Mute or unmute the dashboard microphone state',!set.micMuted,()=>{applySetting('micMuted',!set.micMuted);renderSettings(root);}),
      toggleRow('Mono output','Combine stereo channels for supported media',pref('mono',false),()=>{setPref('mono',!pref('mono',false));renderSettings(root);})
    );
  }

  if(settingsDetail==='privacy'){
    const multiplayer=pref('privacy.multiplayer',true);
    const messages=pref('privacy.messages',true);
    const captures=pref('privacy.captures',false);
    panel.append(
      toggleRow('Join multiplayer games','Allow multiplayer titles on this console',multiplayer,()=>{setPref('privacy.multiplayer',!multiplayer);renderSettings(root);}),
      toggleRow('Messages & voice','Allow communication features',messages,()=>{setPref('privacy.messages',!messages);renderSettings(root);}),
      toggleRow('Share captures','Allow captures to be marked for sharing',captures,()=>{setPref('privacy.captures',!captures);renderSettings(root);})
    );
  }

  if(settingsDetail==='networkAdvanced'){
    const info=window.Features?.Network?.info?.() || {};
    panel.append(
      settingsRow('Connection','Current browser network state',navigator.onLine?'Connected':'Offline'),
      settingsRow('Connection type','Reported by the browser',info.type || 'Unknown'),
      settingsRow('Round-trip time','Browser-reported network latency',info.rtt || '—'),
      settingsRow('Downlink','Browser-reported estimated speed',info.downlink || '—'),
      settingsRow('Run network test','Check whether the catalogue network path is reachable','Test',async()=>{
        window.App?.toast?.('Network test','Checking connection…');
        try{await window.Features?.Network?.test?.();window.App?.toast?.('Network test','Connection looks good');}
        catch{window.App?.toast?.('Network test','Could not complete test');}
      })
    );
  }

  if(settingsDetail==='controllers'){
    const vibration=set.vibration!==false;
    const deadzone=set.stickDeadzone ?? 55;
    const values=[25,40,55,70,85];
    panel.append(
      toggleRow('Controller vibration','Allow rumble from supported controllers',vibration,()=>{applySetting('vibration',!vibration);renderSettings(root);}),
      settingsRow('Stick deadzone','Ignore small analog-stick movement',deadzone+'%',()=>{applySetting('stickDeadzone',nextOf(values,deadzone));renderSettings(root);}),
      settingsRow('Test vibration','Send a short rumble to the active controller','Test',()=>window.App?.testRumble?.())
    );
  }

  if(settingsDetail==='consoleInfo'){
    panel.append(
      settingsRow('Console name','Name used by this dashboard','Xbox'),
      settingsRow('Dashboard build','Current web build',document.documentElement.dataset.build || 'Current'),
      settingsRow('Browser engine','Runtime used by this device',navigator.userAgent.includes('Safari')?'WebKit':'Browser'),
      settingsRow('Profile storage','Saved locally on this device','Enabled')
    );
  }

  if(settingsDetail==='storage'){
    const row=settingsRow('Browser storage','Estimated local storage usage','Checking…');
    panel.append(
      row,
      settingsRow('Captures','Screenshots saved by this dashboard','Manage',()=>window.App?.toast?.('Captures','Use the Guide or capture controls to manage saved captures')),
      settingsRow('Export profile backup','Download profile, library and Settings data','Export',exportProfile)
    );
    navigator.storage?.estimate?.().then(info=>{
      const value=row.querySelector('.console-settings-value');
      if(!value) return;
      const used=info.usage?Math.round(info.usage/1024/1024):0;
      const quota=info.quota?Math.round(info.quota/1024/1024):0;
      value.textContent=quota?`${used} MB / ${quota} MB`:`${used} MB used`;
    }).catch(()=>{});
  }
}

function renderSettings(root,opts={}){
  if(opts.section && SETTINGS_ITEMS.some(item=>item.id===opts.section)){
    settingsMode=opts.section;
    settingsDetail=null;
  }
  if(opts.detail && SETTINGS_DETAIL_TITLES[opts.detail]) settingsDetail=opts.detail;

  root.innerHTML='';
  root.classList.add('console-page-view');
  const shell=el('div','console-shell console-settings');
  const main=el('main','console-main console-settings-main');
  shell.append(sidebar(SETTINGS_ITEMS,settingsMode,id=>setMode(root,id),'Settings'));

  const labels=Object.fromEntries(SETTINGS_ITEMS.map(x=>[x.id,x.label]));
  main.append(topBar(settingsDetail?SETTINGS_DETAIL_TITLES[settingsDetail]:labels[settingsMode],settingsDetail?'Change this setting and it applies immediately':'Xbox console settings'));
  const panel=el('section','console-settings-panel');
  const state=S();
  const set=state.settings;

  if(settingsDetail){
    renderSettingsDetail(root,panel,state,set);
    main.append(panel); shell.append(main); root.append(shell);
    focusAfter(root,'.console-settings-back');
    return;
  }

  if(settingsMode==='general'){
    panel.append(
      settingsRow('Online safety & family','Privacy, screen time and content controls','Open',()=>setMode(root,'family')),
      settingsRow('Power options','Startup animation, sleep and shutdown','Open',()=>openDetail(root,'power')),
      settingsRow('TV & display options','Night mode, clock, safe area and picture tuning','Open',()=>openDetail(root,'display')),
      settingsRow('Volume & audio output','Dashboard volume, sounds and microphone','Open',()=>openDetail(root,'audio')),
      settingsRow('Personalization','Background, color, Home and guide','Open',()=>setMode(root,'personalization')),
      settingsRow('Network settings','Connection status and advanced settings','Open',()=>setMode(root,'network'))
    );
  }

  if(settingsMode==='account'){
    panel.append(
      settingsRow('Gamertag','Name shown across Xbox',state.data?.gamertag || 'xboxtest',()=>window.App?.promptGamertag?.()),
      settingsRow('Second profile line','Text shown beneath the gamertag on Home',set.profileLine || 'Automatic',()=>window.App?.promptProfileLine?.()),
      settingsRow('Add a profile','Create another local Xbox profile','Add',()=>window.App?.promptNewProfile?.()),
      settingsRow('Manage profiles','Remove profiles not currently signed in',Math.max(0,(state.profiles?.()||[]).length-1)+' other',()=>window.App?.manageProfiles?.()),
      settingsRow('Privacy & online safety','Multiplayer, communication and sharing controls','Open',()=>openDetail(root,'privacy')),
      settingsRow('Subscription','Membership shown by this profile',state.data?.tier || 'Ultimate')
    );
  }

  if(settingsMode==='personalization'){
    const accents=['#4ade4a','#107c10','#00a4ef','#8b5cf6','#f97316','#ffffff'];
    const accent=set.accent || '#4ade4a';
    panel.append(
      settingsRow('My background','Use game art or choose a custom image',set.wallpaper?'Custom':'Game art',()=>window.App?.promptWallpaper?.()),
      settingsRow('My color','Change the dashboard accent color',accent,()=>{applySetting('accent',nextOf(accents,accent));renderSettings(root);}),
      toggleRow('Dynamic backgrounds','Change background with the selected game',set.background==='dynamic',()=>{applySetting('background',set.background==='dynamic'?'plain':'dynamic');renderSettings(root);}),
      toggleRow('Navigation sounds','Play Xbox UI sounds while navigating',!!set.sounds,()=>{applySetting('sounds',!set.sounds);renderSettings(root);}),
      settingsRow('Background saturation','Adjust how strong game artwork appears',Math.round((set.saturation??1.35)*100)+'%',()=>openDetail(root,'display')),
      settingsRow('Home','Return to Home to customize pins and recent games','Open',()=>window.App?.setView?.('home')),
      settingsRow('My games & apps','Open your owned library','Open',()=>window.App?.setView?.('library'))
    );
  }

  if(settingsMode==='network'){
    const info=window.Features?.Network?.info?.() || {online:navigator.onLine,type:'Unknown',rtt:'—',downlink:'—'};
    panel.append(
      settingsRow('Network status','Current console connection',info.online?'Connected':'Offline'),
      settingsRow('Connection type',`Round trip ${info.rtt || '—'} • ${info.downlink || '—'}`,info.type || 'Unknown'),
      settingsRow('Test network connection','Run a real connectivity check from this browser','Test',async()=>{window.App?.toast?.('Network test','Checking connection…');try{await window.Features?.Network?.test?.();window.App?.toast?.('Network test','Connection looks good');}catch{window.App?.toast?.('Network test','Could not complete test');}}),
      settingsRow('Advanced settings','Browser-reported connection details','Open',()=>openDetail(root,'networkAdvanced'))
    );
  }

  if(settingsMode==='devices'){
    panel.append(
      settingsRow('Controllers & headsets','Vibration and analog-stick settings','Configure',()=>openDetail(root,'controllers')),
      toggleRow('Controller vibration','Allow controller vibration in supported games',set.vibration!==false,()=>{applySetting('vibration',set.vibration===false);renderSettings(root);}),
      settingsRow('Stick deadzone','Current analog-stick deadzone',(set.stickDeadzone??55)+'%',()=>openDetail(root,'controllers')),
      toggleRow('Remote features','Allow remote-device features in this replica',pref('remote',true),()=>{setPref('remote',!pref('remote',true));renderSettings(root);})
    );
  }

  if(settingsMode==='cloud'){
    const resolution=pref('cloudResolution','Auto');
    const nqi=pref('nqi',true);
    const opts=['Auto','720p','1080p'];
    panel.append(
      settingsRow('Cloud gaming resolution','Preferred resolution saved for cloud sessions',resolution,()=>{setPref('cloudResolution',nextOf(opts,resolution));renderSettings(root);}),
      toggleRow('Network Quality Indicator','Show lightweight stream-health information',nqi,()=>{setPref('nqi',!nqi);renderSettings(root);}),
      settingsRow('Cloud gaming provider','Current streaming integration','Configured'),
      settingsRow('Streaming status','Current session',Cloud()?.active?'Playing':'Ready')
    );
  }

  if(settingsMode==='accessibility'){
    const scales=[.9,1,1.1,1.2,1.3];
    const scale=set.textScale || 1;
    const filters=['none','protanopia','deuteranopia','tritanopia','mono'];
    const filter=set.colorFilter || 'none';
    panel.append(
      settingsRow('Text size','Scale dashboard text',Math.round(scale*100)+'%',()=>{applySetting('textScale',nextOf(scales,scale));renderSettings(root);}),
      toggleRow('High contrast','Increase visual separation across the dashboard',!!set.highContrast,()=>{applySetting('highContrast',!set.highContrast);renderSettings(root);}),
      settingsRow('Color filter','Apply a display color filter',filter==='none'?'Off':filter,()=>{applySetting('colorFilter',nextOf(filters,filter));renderSettings(root);}),
      toggleRow('Reduce transparency','Make translucent panels more opaque',!!set.reduceTransparency,()=>{applySetting('reduceTransparency',!set.reduceTransparency);renderSettings(root);}),
      toggleRow('Reduce motion','Shorten dashboard animation',set.motion==='reduced',()=>{applySetting('motion',set.motion==='reduced'?'full':'reduced');renderSettings(root);}),
      toggleRow('Narrator sample','Use browser speech synthesis for a spoken test',pref('narrator',false),()=>{
        const on=!pref('narrator',false);setPref('narrator',on);
        if(on && 'speechSynthesis' in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance('Narrator on'));}
        renderSettings(root);
      })
    );
  }

  if(settingsMode==='family'){
    const limit=set.screenTimeLimit || 0;
    const limits=[0,30,60,90,120,180];
    const blocked=set.blockedTags || [];
    panel.append(
      settingsRow('Screen time limit','Daily play limit enforced by the dashboard',limit?limit+' minutes':'Off',()=>{applySetting('screenTimeLimit',nextOf(limits,limit));renderSettings(root);}),
      toggleRow('Block Flash games','Prevent games tagged as Flash from launching',blocked.includes('flash'),()=>{state.toggleBlockedTag('flash');renderSettings(root);}),
      toggleRow('Block emulator games','Prevent emulator-tagged games from launching',blocked.includes('emulator'),()=>{state.toggleBlockedTag('emulator');renderSettings(root);}),
      settingsRow('Privacy & online safety','Multiplayer, communication and sharing controls','Open',()=>openDetail(root,'privacy'))
    );
  }

  if(settingsMode==='system'){
    panel.append(
      settingsRow('Console info','Name, dashboard runtime and local profile storage','Open',()=>openDetail(root,'consoleInfo')),
      settingsRow('Updates','Reload the dashboard and use the newest deployed files','Restart',()=>location.reload()),
      toggleRow('24-hour clock','Use 24-hour system time',!!set.clock24,()=>{applySetting('clock24',!set.clock24);renderSettings(root);}),
      toggleRow('Startup animation','Play the startup video when the dashboard opens',set.bootVideo!==false,()=>{applySetting('bootVideo',set.bootVideo===false);renderSettings(root);}),
      settingsRow('Backup & transfer','Export profile and Settings data','Export',exportProfile),
      settingsRow('Storage devices','View browser storage usage','Manage',()=>openDetail(root,'storage')),
      settingsRow('Reset console','Reset local profile and console settings','Reset',()=>window.App?.confirmReset?.())
    );
  }

  main.append(panel);
  shell.append(main);
  root.append(shell);
  focusAfter(root,'.console-side-item.active');
}

function backSettings(){
  if(!settingsDetail) return false;
  settingsDetail=null;
  const root=document.getElementById('view-settings');
  if(root && !root.hidden) renderSettings(root);
  return true;
}

V.renderLibrary = renderLibrary;
V.renderPass = renderPass;
V.renderSearch = renderSearch;
V.renderSettings = renderSettings;
window.ConsolePages = { renderLibrary, renderPass, renderSearch, renderSettings, backSettings };
})();
