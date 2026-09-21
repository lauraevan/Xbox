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
    btn.dataset.stratusGame = '1';
    btn.dataset.cloudKey = String(game.gameKey || '');
    btn.classList.add('stratus-poster');
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
  root.classList.add('console-page-view', 'stratus-only-library');
  root.dataset.stratusOnlyLibrary = '1';

  const shell = el('div', 'console-shell console-library');
  const main = el('main', 'console-main stratus-library-main');
  main.append(topBar('My games & apps', 'Stratus Cloud'));

  const row = el('section', 'console-poster-grid stratus-library-row');
  row.setAttribute('aria-label', 'Stratus games');

  let owned = [];
  try { owned = await Cloud()?.ownedGames?.() || []; }
  catch (err){
    window.App?.toast?.('My games & apps', err?.message || 'Could not load Stratus games.');
  }

  if (!root.isConnected) return;

  if (owned.length){
    owned.forEach(game => row.append(poster(game, {
      cloud:true,
      meta:'Stratus Cloud'
    })));
    main.append(row);
  } else {
    const empty = el('div', 'console-empty stratus-library-empty',
      `${ICON.games}<h2>No Stratus games yet</h2><p>Games added from Stratus will appear here.</p>`);
    main.append(empty);
  }

  shell.append(main);
  root.append(shell);

  window.Nav?.repaint?.();
  if (owned.length) focusAfter(root, '.stratus-poster');
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
  {id:'display',label:'Display & sound',icon:'apps'},
  {id:'network',label:'Network',icon:'link'},
  {id:'devices',label:'Controller & devices',icon:'games'},
  {id:'cloud',label:'Cloud gaming',icon:'play'},
  {id:'accessibility',label:'Accessibility',icon:'person'},
  {id:'system',label:'System',icon:'apps'}
];

let networkTestState='Not run';

function settingsRow(title,sub,value,action,kind='value',id=''){
  const b=el('button','console-settings-row');
  if(action) nav(b,action);
  else {
    b.disabled=true;
    b.classList.add('console-settings-info');
  }
  if(id) b.dataset.settingKey=id;
  b.innerHTML=`<span class="console-settings-copy"><strong>${safe(title)}</strong><small>${safe(sub)}</small></span><span class="console-settings-value ${kind}">${safe(value)}</span>`;
  return b;
}
function toggleRow(title,sub,on,action,id=''){
  const b=settingsRow(title,sub,'',action,'toggle',id);
  /* A '>' chevron means "opens a sub-page". A switch flips in place, so the
     row is marked and the chevron rule skips it. */
  b.classList.add('console-settings-switch');
  const v=b.querySelector('.console-settings-value');
  v.innerHTML=`<i class="console-toggle ${on?'on':''}"><span></span></i>`;
  return b;
}
function groupTitle(title,sub=''){
  const node=el('div','console-settings-group-title');
  node.innerHTML=`<strong>${safe(title)}</strong>${sub?`<span>${safe(sub)}</span>`:''}`;
  return node;
}
function statusCard(title,value,sub='',tone=''){
  const node=el('div','console-settings-status'+(tone?` ${tone}`:''));
  node.innerHTML=`<span><small>${safe(title)}</small><strong>${safe(value)}</strong></span>${sub?`<p>${safe(sub)}</p>`:''}`;
  return node;
}
function rerenderSettings(root,id){
  renderSettings(root);
  focusAfter(root,id ? `[data-setting-key="${id}"]` : '.console-side-item.active');
}
function setConsoleSetting(root,key,value,id=key){
  const state=S();
  state.setSetting(key,value);

  const set=state.settings;
  switch(key){
    case 'theme': document.body.dataset.theme=value; break;
    case 'accent':
      document.documentElement.style.setProperty('--accent',value);
      state.unlock?.('theme');
      break;
    case 'background': document.body.dataset.bg=value; break;
    case 'motion': document.documentElement.dataset.motion=value; break;
    case 'volume': window.Sound?.setVolume?.(value); break;
    case 'clock24': window.App?.tickClock?.(); break;
    case 'micMuted':
      document.body.dataset.mic=value?'muted':'live';
      window.App?.syncMicIcon?.();
      break;
    case 'textScale': document.documentElement.style.setProperty('--text-scale',value); break;
    case 'highContrast': document.body.dataset.contrast=value?'high':'normal'; break;
    case 'colorFilter': document.body.dataset.cvd=value||'none'; break;
    case 'reduceTransparency': document.body.dataset.transparency=value?'reduced':'normal'; break;
    case 'nightMode':
    case 'nightStrength': window.App?.applyNightMode?.(); break;
    case 'safeArea': document.documentElement.style.setProperty('--overscan',value||0); break;
    case 'saturation': document.documentElement.style.setProperty('--sat',value); break;
    case 'scanline': {
      const scan=document.getElementById('scanline');
      if(scan) scan.hidden=!value;
      break;
    }
  }
  rerenderSettings(root,id);
}

function cycle(current,values){
  const index=values.findIndex(value=>Object.is(value,current));
  return values[(index<0?0:index+1)%values.length];
}
function formatBytes(bytes){
  const n=Number(bytes)||0;
  if(n<1024) return `${n} B`;
  if(n<1024*1024) return `${(n/1024).toFixed(1)} KB`;
  if(n<1024*1024*1024) return `${(n/(1024*1024)).toFixed(1)} MB`;
  return `${(n/(1024*1024*1024)).toFixed(2)} GB`;
}
function currentPad(){
  try { return (navigator.getGamepads?.()||[]).find(Boolean)||null; }
  catch { return null; }
}
function xboxPadName(pad){
  if(!pad) return 'Not connected';
  return /xbox|xinput|microsoft|045e/i.test(String(pad.id||'')) ? 'Xbox controller' : (pad.id||'Controller');
}
async function testControllerVibration(pad){
  if(!pad) return false;
  const actuator=pad.vibrationActuator || pad.hapticActuators?.[0];
  try{
    if(actuator?.playEffect){
      await actuator.playEffect('dual-rumble',{duration:180,strongMagnitude:.65,weakMagnitude:.35});
      return true;
    }
    if(actuator?.pulse){
      await actuator.pulse(.6,180);
      return true;
    }
  }catch{}
  return false;
}

function renderSettings(root){
  root.innerHTML='';
  root.classList.add('console-page-view');

  const shell=el('div','console-shell console-settings');
  const main=el('main','console-main console-settings-main');
  shell.append(sidebar(SETTINGS_ITEMS,settingsMode,id=>{settingsMode=id;renderSettings(root);},'Settings'));

  const labels=Object.fromEntries(SETTINGS_ITEMS.map(x=>[x.id,x.label]));
  main.append(topBar(labels[settingsMode],'Xbox console settings'));

  const panel=el('section','console-settings-panel');
  const state=S();
  const set=state.settings;

  if(settingsMode==='general'){
    panel.append(
      statusCard('Console','Xbox','Settings save automatically on this device.','ok'),
      groupTitle('Console preferences','These controls change the dashboard immediately.'),
      toggleRow('Startup animation','Play the Xbox startup video when the dashboard opens',set.bootVideo!==false,()=>setConsoleSetting(root,'bootVideo',set.bootVideo===false,'bootVideo'),'bootVideo'),
      toggleRow('24-hour clock','Use 24-hour time in the system clock',!!set.clock24,()=>setConsoleSetting(root,'clock24',!set.clock24),'clock24'),
      toggleRow('Navigation sounds','Play Xbox UI movement and selection sounds',!!set.sounds,()=>setConsoleSetting(root,'sounds',!set.sounds),'sounds'),
      settingsRow('Interface volume','Volume for dashboard sounds',`${set.volume??70}%`,()=>setConsoleSetting(root,'volume',cycle(set.volume??70,[0,25,50,70,85,100]),'volume'),'value','volume'),
      toggleRow('Microphone','Show the microphone as active in the system bar',!set.micMuted,()=>setConsoleSetting(root,'micMuted',!set.micMuted,'micMuted'),'micMuted')
    );
  }

  if(settingsMode==='account'){
    const profiles=state.profiles?.()||[];
    panel.append(
      statusCard('Signed in as',state.data?.gamertag||'xboxtest',`${(state.gamerscore||0).toLocaleString()} Gamerscore · ${state.data?.tier||'ULTIMATE'}`,'ok'),
      groupTitle('Profile','Changes here are saved to this browser.'),
      settingsRow('Gamertag','Name shown across the dashboard',state.data?.gamertag||'xboxtest',()=>window.App?.promptGamertag?.(),'value','gamertag'),
      settingsRow('Profile picture','Generate a new local Xbox profile mark','Shuffle',()=>{state.rerollAvatar?.();window.App?.syncProfile?.();rerenderSettings(root,'avatar');},'value','avatar'),
      settingsRow('Home profile line','Text displayed under your gamertag',set.profileLine||'Gamerscore and membership',()=>window.App?.promptProfileLine?.(),'value','profileLine'),
      groupTitle('Profiles on this console',`${profiles.length} profile${profiles.length===1?'':'s'} stored locally.`),
      settingsRow('Add profile','Create another local Xbox profile','Add',()=>window.App?.promptNewProfile?.(),'value','addProfile'),
      profiles.length>1
        ? settingsRow('Manage profiles','Switch or remove signed-out local profiles','Manage',()=>window.App?.manageProfiles?.(),'value','manageProfiles')
        : settingsRow('Manage profiles','Add another profile before profile management is available','1 profile',null,'value','manageProfiles')
    );
  }

  if(settingsMode==='personalization'){
    const W=window.WallpaperSystem;
    const P=window.Personalization;
    const accentOptions=['#4ade4a','#107c10','#2d7dff','#8c52ff','#e96b2c','#f2f2f2'];
    const wallpaperModes=['waves','waves-blue','waves-red','waves-gold','black','game','custom','random'];
    const wallpaperBehaviors=['static','adaptive','dynamic'];
    const brightnessOptions=[25,42,55,70,85,100];
    const blurOptions=[0,2,4,8,12];
    const counts=[5,6,7,8,99];
    const sizes=['compact','standard','large'];
    const seriesModes=['off','hover','always'];
    const radii=['square','xbox','rounded'];
    const scales=[.9,.95,1,1.05,1.1];
    const surfaceModes=['black','graphite'];
    const transparencyModes=['solid','normal','glass'];
    const animationModes=['subtle','normal','expressive'];
    const blurModes=['off','low','strong'];

    const pset=(key,value,id=key)=>{
      if(P?.set) P.set(key,value);
      else if(key.startsWith('wallpaper') && W?.set) W.set(key,value);
      else state.setSetting(key,value);
      rerenderSettings(root,id);
    };

    panel.append(
      groupTitle('Presets','Start with a complete look, then change anything. Manual changes become Custom.'),
      P?.makePreview?.() || statusCard('Personalization','Synapse','Changes save automatically on this device.','ok'),
      settingsRow('Preset','Xbox keeps the replica feel. Minimal strips it back. Synapse is our custom identity.',
        P?.presetLabel?.()||'Synapse',()=>{
          const current=set.personalizationPreset||'synapse';
          const next=cycle(current,['synapse','xbox','minimal']);
          P?.applyPreset?.(next);
          rerenderSettings(root,'preset');
        },'value','preset'),

      groupTitle('Background','The wallpaper is the main visual identity of Home. Uploaded files stay at original quality.'),
      settingsRow('Wallpaper','Choose the resting Home background',
        W?.modeLabel?.(set.wallpaperMode)||'Waves',
        ()=>pset('wallpaperMode',cycle(set.wallpaperMode||'waves',wallpaperModes),'wallpaperMode'),
        'value','wallpaperMode'),
      settingsRow('Wallpaper behavior','Static keeps the wallpaper. Adaptive reveals game art on focus. Dynamic also animates video wallpapers.',
        W?.behaviorLabel?.(set.wallpaperBehavior)||'Dynamic',
        ()=>pset('wallpaperBehavior',cycle(set.wallpaperBehavior||'dynamic',wallpaperBehaviors),'wallpaperBehavior'),
        'value','wallpaperBehavior'),
      settingsRow('Quality','Images and videos are stored without resizing, transcoding, or recompression',
        'Original / highest',null,'value','wallpaperQuality'),
      settingsRow('Brightness','Adjust the displayed background without touching the saved file',
        `${set.wallpaperBrightness??42}%`,
        ()=>pset('wallpaperBrightness',cycle(set.wallpaperBrightness??42,brightnessOptions),'wallpaperBrightness'),
        'value','wallpaperBrightness'),
      settingsRow('Background blur','Softens the background while keeping the interface sharp',
        set.wallpaperBlur?`${set.wallpaperBlur}px`:'Off',
        ()=>pset('wallpaperBlur',cycle(set.wallpaperBlur||0,blurOptions),'wallpaperBlur'),
        'value','wallpaperBlur'),
      settingsRow('Wallpaper motion','Off uses a still frame. Low slows video motion. Normal uses the original speed.',
        ({off:'Off',low:'Low',normal:'Normal'})[set.wallpaperMotion||'normal'],
        ()=>pset('wallpaperMotion',cycle(set.wallpaperMotion||'normal',['off','low','normal']),'wallpaperMotion'),
        'value','wallpaperMotion'),
      toggleRow('Dim while navigating','Darken the wallpaper while focus is in profile or system controls',
        set.wallpaperDimNavigation!==false,
        ()=>pset('wallpaperDimNavigation',set.wallpaperDimNavigation===false,'wallpaperDimNavigation'),
        'wallpaperDimNavigation'),
      settingsRow('Add image','Save the exact original image on this device','Choose',
        ()=>W?.upload?.('image',()=>{P?.markCustom?.();rerenderSettings(root,'wallpaperMode');}),
        'value','wallpaperImage'),
      settingsRow('Add video','Save the exact original video on this device','Choose',
        ()=>W?.upload?.('video',()=>{P?.markCustom?.();rerenderSettings(root,'wallpaperMode');}),
        'value','wallpaperVideo'),
      settingsRow('Manage wallpapers','Select, rename, or delete saved backgrounds','Manage',
        ()=>W?.openManager?.(()=>rerenderSettings(root,'wallpaperManage')),
        'value','wallpaperManage'),
      settingsRow('Artwork saturation','How vivid focused-game artwork appears',
        `${Math.round((set.saturation??1.35)*100)}%`,
        ()=>{P?.markCustom?.();setConsoleSetting(root,'saturation',cycle(set.saturation??1.35,[1,1.2,1.35,1.6]),'saturation');},
        'value','saturation'),

      groupTitle('Home layout','Change the dashboard itself instead of only changing the wallpaper.'),
      settingsRow('Customize Home','Drag games to reorder. X hides one. Y pins the current wallpaper for that game.',
        'Edit',()=>P?.startHomeEditor?.(),'value','customizeHome'),
      settingsRow('Games shown','Choose how many games stay visible in the first Home row',
        (set.homeVisibleGames||8)>=90?'All':String(set.homeVisibleGames||8),
        ()=>pset('homeVisibleGames',cycle(set.homeVisibleGames||8,counts),'homeVisibleGames'),
        'value','homeVisibleGames'),
      settingsRow('Tile size','Change the density of the first Home row',
        P?.tileSizeLabel?.(set.homeTileSize)||'Standard',
        ()=>pset('homeTileSize',cycle(set.homeTileSize||'standard',sizes),'homeTileSize'),
        'value','homeTileSize'),
      toggleRow('Promo row','Show Synapse Store and the lower Home cards',
        set.homePromoRow!==false,
        ()=>pset('homePromoRow',set.homePromoRow===false,'homePromoRow'),
        'homePromoRow'),
      settingsRow('Section order','Choose whether games or promo cards appear first',
        set.homeSectionOrder==='promos-first'?'Promos first':'Games first',
        ()=>pset('homeSectionOrder',set.homeSectionOrder==='promos-first'?'games-first':'promos-first','homeSectionOrder'),
        'value','homeSectionOrder'),
      settingsRow('Startup page','Choose what opens after the boot animation',
        set.startupView==='library'?'My games & apps':'Home',
        ()=>pset('startupView',set.startupView==='library'?'home':'library','startupView'),
        'value','startupView'),
      settingsRow('Start focus','Choose what is selected when Home opens',
        set.homeStartFocus==='first-game'?'First game':'Profile',
        ()=>pset('homeStartFocus',set.homeStartFocus==='first-game'?'profile':'first-game','homeStartFocus'),
        'value','homeStartFocus'),
      toggleRow('Game labels','Show game names directly on the tiles',
        !!set.homeTileLabels,
        ()=>pset('homeTileLabels',!set.homeTileLabels,'homeTileLabels'),
        'homeTileLabels'),
      settingsRow('Series X|S badges','Choose when X|S appears on supported games',
        P?.seriesLabel?.(set.homeSeriesBadges)||'On focus',
        ()=>pset('homeSeriesBadges',cycle(set.homeSeriesBadges||'hover',seriesModes),'homeSeriesBadges'),
        'value','homeSeriesBadges'),
      settingsRow('Tile corners','Square, Xbox-like, or more rounded',
        P?.radiusLabel?.(set.homeCornerRadius)||'Rounded',
        ()=>pset('homeCornerRadius',cycle(set.homeCornerRadius||'rounded',radii),'homeCornerRadius'),
        'value','homeCornerRadius'),
      toggleRow('Extra tile badges','Show PORT, FLASH and emulator tags where available',
        !!set.tileBadges,
        ()=>{P?.markCustom?.();setConsoleSetting(root,'tileBadges',!set.tileBadges,'tileBadges');},
        'tileBadges'),
      toggleRow('Game details on Home','Show focused-title information above Home',
        !!set.heroText,
        ()=>{P?.markCustom?.();setConsoleSetting(root,'heroText',!set.heroText,'heroText');},
        'heroText'),
      settingsRow('Reset Home layout','Restore the default game order and Home layout controls',
        'Reset',()=>{P?.resetHomeLayout?.();rerenderSettings(root,'customizeHome');},
        'value','resetHome'),

      groupTitle('Top bar','Reorder the connected capsule and hide buttons you do not use. Settings always stays available.'),
      settingsRow('Customize top bar','Move or hide top-bar buttons',
        P?.topbarLabel?.()||'Edit',
        ()=>P?.openTopBarEditor?.(()=>rerenderSettings(root,'topBarEditor')),
        'value','topBarEditor'),
      toggleRow('Top bar labels','Show the tiny black popup under a hovered or selected button',
        set.topBarTooltips!==false,
        ()=>pset('topBarTooltips',set.topBarTooltips===false,'topBarTooltips'),
        'topBarTooltips'),
      settingsRow('Top bar size','Choose the control capsule size',
        set.topBarSize==='compact'?'Compact':'Standard',
        ()=>pset('topBarSize',set.topBarSize==='compact'?'standard':'compact','topBarSize'),
        'value','topBarSize'),
      settingsRow('Profile position','Place the Home profile on the left or right',
        set.profilePosition==='right'?'Right':'Left',
        ()=>pset('profilePosition',set.profilePosition==='right'?'left':'right','profilePosition'),
        'value','profilePosition'),

      groupTitle('Appearance','Fine tune the Synapse look without changing the page structure.'),
      settingsRow('Theme','System chrome appearance',
        set.theme==='light'?'Light':'Dark',
        ()=>pset('theme',set.theme==='dark'?'light':'dark','theme'),
        'value','theme'),
      settingsRow('My color','Accent used for focus and highlights',
        set.accent||'#4ade4a',
        ()=>pset('accent',cycle(set.accent||'#4ade4a',accentOptions),'accent'),
        'value','accent'),
      settingsRow('Surface tone','Pure black or a softer graphite system surface',
        set.surfaceTone==='graphite'?'Graphite':'Black',
        ()=>pset('surfaceTone',cycle(set.surfaceTone||'black',surfaceModes),'surfaceTone'),
        'value','surfaceTone'),
      settingsRow('Transparency','Solid, balanced, or glassier system surfaces',
        ({solid:'Solid',normal:'Balanced',glass:'Glass'})[set.transparencyStrength||'normal'],
        ()=>pset('transparencyStrength',cycle(set.transparencyStrength||'normal',transparencyModes),'transparencyStrength'),
        'value','transparencyStrength'),
      settingsRow('UI scale','Scale the complete dashboard without changing browser zoom',
        `${Math.round((set.uiScale||1)*100)}%`,
        ()=>pset('uiScale',cycle(set.uiScale||1,scales),'uiScale'),
        'value','uiScale'),
      settingsRow('Animation strength','Tune the duration and weight of interface motion',
        P?.animationLabel?.(set.animationStrength)||'Normal',
        ()=>pset('animationStrength',cycle(set.animationStrength||'normal',animationModes),'animationStrength'),
        'value','animationStrength'),
      settingsRow('Motion blur','A very short blur only while focus lands, never continuously',
        P?.blurLabel?.(set.motionBlurStrength)||'Off',
        ()=>pset('motionBlurStrength',cycle(set.motionBlurStrength||'off',blurModes),'motionBlurStrength'),
        'value','motionBlurStrength'),
      toggleRow('Reduce motion','Skip most dashboard animation',
        set.motion==='reduced',
        ()=>pset('motion',set.motion==='reduced'?'full':'reduced','motion'),
        'motion')
    );

    W?.mountLibrary?.(panel,()=>rerenderSettings(root,'wallpaperMode'));
  }

  if(settingsMode==='display'){
    const scaleOptions=[.9,1,1.1,1.2,1.3];
    const safeOptions=[0,1,2,3,4];
    const nightOptions=[20,35,45,60,75];
    panel.append(
      statusCard('Display',`${window.innerWidth} × ${window.innerHeight}`,`${Math.round(window.devicePixelRatio||1)}× device pixel ratio`),
      groupTitle('Display','Adjust the browser-rendered Xbox interface.'),
      settingsRow('Text size','Scale dashboard text and rem-based UI',`${Math.round((set.textScale||1)*100)}%`,()=>setConsoleSetting(root,'textScale',cycle(set.textScale||1,scaleOptions),'textScale'),'value','textScale'),
      settingsRow('Safe area','Move important UI inward for overscan',set.safeArea? `Level ${set.safeArea}`:'Off',()=>setConsoleSetting(root,'safeArea',cycle(set.safeArea||0,safeOptions),'safeArea'),'value','safeArea'),
      toggleRow('Night mode','Apply a warm display filter',!!set.nightMode,()=>setConsoleSetting(root,'nightMode',!set.nightMode,'nightMode'),'nightMode'),
      settingsRow('Night mode strength','Warm filter intensity',`${set.nightStrength??45}%`,()=>setConsoleSetting(root,'nightStrength',cycle(set.nightStrength??45,nightOptions),'nightStrength'),'value','nightStrength'),
      toggleRow('CRT scanline overlay','Add the optional scanline effect',!!set.scanline,()=>setConsoleSetting(root,'scanline',!set.scanline,'scanline'),'scanline')
    );
  }

  if(settingsMode==='network'){
    const info=window.Features?.Network?.info?.() || {
      online:navigator.onLine,
      type:navigator.connection?.effectiveType||'Unknown',
      rtt:navigator.connection?.rtt||'—',
      downlink:navigator.connection?.downlink||'—'
    };
    panel.append(
      statusCard('Network status',info.online?'Connected':'Offline',info.online?'The browser reports an active network connection.':'Cloud gaming requires a network connection.',info.online?'ok':'warn'),
      groupTitle('Connection','Live information from your browser/device.'),
      settingsRow('Connection type','Reported effective network type',String(info.type||'Unknown'),null,'value','networkType'),
      settingsRow('Round-trip time','Browser-reported network latency',info.rtt==='—'?'Unavailable':`${info.rtt} ms`,null,'value','rtt'),
      settingsRow('Downlink estimate','Browser-reported connection estimate',info.downlink==='—'?'Unavailable':`${info.downlink} Mbps`,null,'value','downlink'),
      settingsRow('Test network connection','Run the project network connectivity check',networkTestState,async()=>{
        networkTestState='Testing…';
        rerenderSettings(root,'networkTest');
        try{
          const result=await window.Features?.Network?.test?.();
          networkTestState=result===false?'Failed':'Connected';
        }catch{ networkTestState='Failed'; }
        rerenderSettings(root,'networkTest');
      },'value','networkTest')
    );
  }

  if(settingsMode==='devices'){
    const pad=currentPad();
    const deadzones=[20,30,40,55,65,75];
    const swapped=set.buttonMap?.a==='b';
    panel.append(
      statusCard('Controller',xboxPadName(pad),pad?'Gamepad input is active on the dashboard.':'Connect or pair an Xbox controller, then press a button.',pad?'ok':''),
      groupTitle('Xbox controller','Dashboard navigation reads these settings live.'),
      settingsRow('Button layout','Which face button selects items',swapped?'Swapped (B selects)':'Standard (A selects)',()=>{
        const next=swapped
          ? {a:'a',b:'b',x:'x',y:'y'}
          : {a:'b',b:'a',x:'x',y:'y'};
        setConsoleSetting(root,'buttonMap',next,'buttonMap');
      },'value','buttonMap'),
      settingsRow('Left stick deadzone','How far the stick moves before dashboard navigation starts',`${set.stickDeadzone??55}%`,()=>setConsoleSetting(root,'stickDeadzone',cycle(set.stickDeadzone??55,deadzones),'stickDeadzone'),'value','stickDeadzone'),
      toggleRow('Controller vibration','Allow haptics where the browser/controller supports them',set.vibration!==false,()=>setConsoleSetting(root,'vibration',set.vibration===false,'vibration'),'vibration'),
      settingsRow('Test vibration',pad?'Send a short rumble to the connected controller':'Connect a controller first',pad?'Test':'Unavailable',pad?async()=>{
        const row=root.querySelector('[data-setting-key="rumble"] .console-settings-value');
        if(row) row.textContent='Testing…';
        const ok=await testControllerVibration(currentPad());
        if(row) row.textContent=ok?'Working':'Not supported';
      }:null,'value','rumble'),
      toggleRow('Microphone','System microphone status',!set.micMuted,()=>setConsoleSetting(root,'micMuted',!set.micMuted,'deviceMic'),'deviceMic')
    );
  }

  if(settingsMode==='cloud'){
    const cloud=Cloud();
    panel.append(
      statusCard('Xbox Cloud',cloud?.active?'Playing':'Ready',cloud?.active?'A cloud session is currently active.':'Cloud games can be launched from Home or My games & apps.',cloud?.active?'ok':''),
      groupTitle('Cloud gaming','Actions here connect to the project’s actual cloud flow.'),
      settingsRow('Cloud library','Open your Xbox Cloud games in My games & apps','Open',()=>window.App?.setView?.('library'),'value','cloudLibrary'),
      settingsRow('Streaming session',cloud?.active?'A cloud session is active':'No cloud session is running',cloud?.active?'Exit game':'Ready',cloud?.active?()=>cloud.quit?.():null,'value','cloudSession'),
      settingsRow('Controller passthrough','Game iframe is allowed to receive Gamepad API input','Enabled',null,'value','cloudController'),
      settingsRow('Player mode','Cloud games open in the full-screen Xbox player','Full screen',null,'value','cloudPlayer')
    );
  }

  if(settingsMode==='accessibility'){
    const filters=[
      {v:'none',label:'Off'},
      {v:'protanopia',label:'Protanopia'},
      {v:'deuteranopia',label:'Deuteranopia'},
      {v:'tritanopia',label:'Tritanopia'},
      {v:'mono',label:'Monochrome'}
    ];
    const currentFilter=filters.find(x=>x.v===(set.colorFilter||'none'))||filters[0];
    panel.append(
      groupTitle('Accessibility','These settings apply immediately across the dashboard.'),
      toggleRow('High contrast','Increase separation between interface surfaces',!!set.highContrast,()=>setConsoleSetting(root,'highContrast',!set.highContrast,'highContrast'),'highContrast'),
      toggleRow('Reduce motion','Shorten or skip dashboard animations',set.motion==='reduced',()=>setConsoleSetting(root,'motion',set.motion==='reduced'?'full':'reduced','motion'),'motion'),
      toggleRow('Reduce transparency','Replace translucent surfaces with more solid backgrounds',!!set.reduceTransparency,()=>setConsoleSetting(root,'reduceTransparency',!set.reduceTransparency,'reduceTransparency'),'reduceTransparency'),
      settingsRow('Color filter','Apply a color-vision filter to the dashboard',currentFilter.label,()=>{
        const next=cycle(currentFilter.v,filters.map(x=>x.v));
        setConsoleSetting(root,'colorFilter',next,'colorFilter');
      },'value','colorFilter'),
      settingsRow('Text size','Scale dashboard text',`${Math.round((set.textScale||1)*100)}%`,()=>setConsoleSetting(root,'textScale',cycle(set.textScale||1,[.9,1,1.1,1.2,1.3]),'accessTextScale'),'value','accessTextScale')
    );
  }

  if(settingsMode==='system'){
    const storageRow=settingsRow('Browser storage','Local profiles, preferences and cached assets','Checking…',null,'value','storage');
    panel.append(
      statusCard('System','Xbox Web Dashboard','Runs entirely in this browser.','ok'),
      groupTitle('Console information','Useful device and maintenance controls.'),
      settingsRow('Viewport', 'Current rendered dashboard size',`${window.innerWidth} × ${window.innerHeight}`,null,'value','viewport'),
      settingsRow('Browser mode','How the dashboard is currently running',window.matchMedia?.('(display-mode: standalone)')?.matches?'Installed app':'Browser tab',null,'value','displayMode'),
      storageRow,
      settingsRow('Restart dashboard','Reload the current Xbox build','Restart',()=>location.reload(),'value','restart'),
      settingsRow('Reset local console','Clear profiles, achievements and settings stored by this build','Reset',()=>window.App?.confirmReset?.(),'value','reset')
    );

    navigator.storage?.estimate?.().then(info=>{
      const value=storageRow.querySelector('.console-settings-value');
      if(!value) return;
      const usage=formatBytes(info.usage||0);
      const quota=info.quota?formatBytes(info.quota):'unknown';
      value.textContent=`${usage} / ${quota}`;
    }).catch(()=>{
      const value=storageRow.querySelector('.console-settings-value');
      if(value) value.textContent='Unavailable';
    });
  }

  main.append(panel);
  shell.append(main);
  root.append(shell);
  focusAfter(root,'.console-side-item.active');
}

V.renderLibrary = renderLibrary;
V.renderPass = renderPass;
V.renderSearch = renderSearch;
V.renderSettings = renderSettings;
window.ConsolePages = { renderLibrary, renderPass, renderSearch, renderSettings };
})();
