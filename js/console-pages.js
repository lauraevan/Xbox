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
  {id:'network',label:'Network settings',icon:'link'},
  {id:'devices',label:'Devices & connections',icon:'pad'},
  {id:'cloud',label:'Cloud settings',icon:'play'},
  {id:'accessibility',label:'Accessibility',icon:'person'},
  {id:'system',label:'System',icon:'apps'}
];

function pref(key, fallback){
  try { const v=localStorage.getItem('xbox.pref.'+key); return v==null?fallback:JSON.parse(v); } catch { return fallback; }
}
function setPref(key,val){ try { localStorage.setItem('xbox.pref.'+key,JSON.stringify(val)); } catch {} }

function settingsRow(title,sub,value,action,kind='value'){
  const b=nav(el('button','console-settings-row'),action||(()=>{}));
  b.innerHTML=`<span class="console-settings-copy"><strong>${safe(title)}</strong><small>${safe(sub)}</small></span><span class="console-settings-value ${kind}">${safe(value)}</span>`;
  return b;
}
function toggleRow(title,sub,on,action){
  const b=settingsRow(title,sub,'',action,'toggle');
  const v=b.querySelector('.console-settings-value'); v.innerHTML=`<i class="console-toggle ${on?'on':''}"><span></span></i>`; return b;
}

function renderSettings(root){
  root.innerHTML=''; root.classList.add('console-page-view');
  const shell=el('div','console-shell console-settings');
  const main=el('main','console-main console-settings-main');
  shell.append(sidebar(SETTINGS_ITEMS,settingsMode,id=>{settingsMode=id;renderSettings(root);},'Settings'));
  const labels=Object.fromEntries(SETTINGS_ITEMS.map(x=>[x.id,x.label]));
  main.append(topBar(labels[settingsMode],'Xbox console settings'));
  const panel=el('section','console-settings-panel');
  const state=S(); const set=state.settings;

  if(settingsMode==='general'){
    panel.append(
      settingsRow('Online safety & family','Manage privacy, family and content settings','Open',()=>{settingsMode='account';renderSettings(root);}),
      settingsRow('Power options','Sleep, shutdown and energy settings',pref('power','Sleep'),()=>{const next=pref('power','Sleep')==='Sleep'?'Shutdown (energy saving)':'Sleep';setPref('power',next);renderSettings(root);}),
      settingsRow('TV & display options','Resolution, video modes and calibration',pref('display','Auto detect'),()=>window.App?.toast?.('TV & display options','Using browser display settings')),
      settingsRow('Volume & audio output','Speaker, headset and chat mixer',`${set.volume ?? 70}%`,()=>window.App?.toast?.('Audio','Use Display & sound for detailed audio controls')),
      settingsRow('Personalization','Background, color, Home and guide','Open',()=>{settingsMode='personalization';renderSettings(root);}),
      settingsRow('Network settings','Connection status and advanced settings','Open',()=>{settingsMode='network';renderSettings(root);})
    );
  }

  if(settingsMode==='account'){
    panel.append(
      settingsRow('Sign-in, security & PIN','Control sign-in preferences','No barriers',()=>window.App?.toast?.('Sign-in','xboxtest is signed in')),
      settingsRow('Linked social accounts','Connect supported social services','Manage',()=>window.App?.toast?.('Linked accounts','No linked accounts')),
      settingsRow('Subscriptions','View active memberships',state.data?.tier || 'Ultimate',()=>window.App?.toast?.('Subscriptions',state.data?.tier || 'Ultimate')),
      settingsRow('Payment & billing','Payment methods and order history','Manage',()=>window.App?.toast?.('Billing','No payment required in this replica')),
      settingsRow('Privacy & online safety','Communication and multiplayer permissions','Adult defaults',()=>window.App?.toast?.('Privacy','Default privacy settings')),
      settingsRow('Gamertag','Name shown across Xbox','xboxtest',()=>window.App?.promptGamertag?.())
    );
  }

  if(settingsMode==='personalization'){
    panel.append(
      settingsRow('My background','Dynamic game art or custom image',set.wallpaper?'Custom':'Game art',()=>window.App?.promptWallpaper?.()),
      settingsRow('My color','Accent color used by Xbox',set.accent || '#4ade4a',()=>window.App?.toast?.('My color','Use the color options in the original settings panel')),
      toggleRow('Dynamic backgrounds','Change background with the selected game',set.background==='dynamic',()=>{state.setSetting('background',set.background==='dynamic'?'plain':'dynamic');renderSettings(root);}),
      toggleRow('Navigation sounds','Play UI sounds while moving around',!!set.sounds,()=>{state.setSetting('sounds',!set.sounds);renderSettings(root);}),
      settingsRow('Home','Customize games, apps and groups on Home','Customize',()=>window.App?.setView?.('home')),
      settingsRow('My games & apps','Poster artwork, status icons and filters','Customize',()=>window.App?.setView?.('library')),
      settingsRow('Customize the guide','Accent and guide preferences','Open',()=>window.App?.toast?.('Guide','Guide customization is available from the Xbox button'))
    );
  }

  if(settingsMode==='network'){
    const info=window.Features?.Network?.info?.() || {online:navigator.onLine,type:'Unknown',rtt:'—',downlink:'—'};
    panel.append(
      settingsRow('Network status','Current console connection',info.online?'Connected':'Offline'),
      settingsRow('Connection type',`Round trip ${info.rtt || '—'} • ${info.downlink || '—'}`,info.type || 'Unknown'),
      settingsRow('Test network connection','Run connectivity checks','Test',async()=>{window.App?.toast?.('Network test','Checking connection…');try{await window.Features?.Network?.test?.();window.App?.toast?.('Network test','Connection looks good');}catch{window.App?.toast?.('Network test','Could not complete test');}}),
      settingsRow('Test remote play','Check streaming readiness','Test',()=>window.App?.toast?.('Remote play','Browser streaming path is available')),
      settingsRow('Advanced settings','IP, DNS, port and alternate MAC address','Open',()=>window.App?.toast?.('Advanced network','Managed by your browser and device'))
    );
  }

  if(settingsMode==='devices'){
    const vibration=pref('vibration',true);
    panel.append(
      settingsRow('Controllers & headsets','Configure connected Xbox accessories','Configure',()=>window.App?.toast?.('Accessories','Controller input is enabled')),
      toggleRow('Controller vibration','Allow controller vibration in supported games',vibration,()=>{setPref('vibration',!vibration);renderSettings(root);}),
      settingsRow('Remote features','Allow remote play and device connections',pref('remote',true)?'Enabled':'Disabled',()=>{setPref('remote',!pref('remote',true));renderSettings(root);}),
      settingsRow('Digital assistants','Voice and assistant integrations','Not connected',()=>{}),
      settingsRow('Media remote','Button mapping and media controls','Default',()=>{})
    );
  }

  if(settingsMode==='cloud'){
    const resolution=pref('cloudResolution','Auto');
    const nqi=pref('nqi',true);
    const opts=['Auto','720p','1080p'];
    panel.append(
      settingsRow('Cloud gaming resolution','Preferred stream resolution before a session starts',resolution,()=>{setPref('cloudResolution',opts[(opts.indexOf(resolution)+1)%opts.length]);renderSettings(root);}),
      toggleRow('Network Quality Indicator','Show lightweight stream health information',nqi,()=>{setPref('nqi',!nqi);renderSettings(root);}),
      settingsRow('Cloud gaming provider','Streaming backend used by this project','Stratus Cloud',()=>{}),
      settingsRow('Session length','Maximum cloud play session','15 minutes',()=>{}),
      settingsRow('Streaming status','Current session',Cloud()?.active?'Playing':'Ready',()=>{})
    );
  }

  if(settingsMode==='accessibility'){
    const motion=set.motion==='reduced';
    panel.append(
      settingsRow('Narrator','Read screen text aloud','Off',()=>window.App?.toast?.('Narrator','Browser accessibility APIs remain available')),
      settingsRow('Magnifier','Zoom parts of the screen','Off',()=>{}),
      settingsRow('High contrast','Increase visual separation',pref('contrast',false)?'On':'Off',()=>{setPref('contrast',!pref('contrast',false));document.body.classList.toggle('console-high-contrast',pref('contrast',false));renderSettings(root);}),
      toggleRow('Reduce motion','Shorten dashboard animation',motion,()=>{state.setSetting('motion',motion?'full':'reduced');document.documentElement.dataset.motion=motion?'full':'reduced';renderSettings(root);}),
      toggleRow('Mono output','Combine stereo audio channels',pref('mono',false),()=>{setPref('mono',!pref('mono',false));renderSettings(root);})
    );
  }

  if(settingsMode==='system'){
    const starts=['Xbox Series','Xbox One','Modern Xbox'];
    const startup=pref('startup','Modern Xbox');
    panel.append(
      settingsRow('Console info','Name, OS and device information','Xbox',()=>window.App?.toast?.('Console info','Xbox browser replica')),
      settingsRow('Updates','Keep console software current','Up to date',()=>{}),
      settingsRow('Language & location','System language and regional format','English (United States)',()=>{}),
      settingsRow('Time','Clock and time zone','Automatic',()=>{}),
      settingsRow('Startup animation','Choose the Xbox startup experience',startup,()=>{setPref('startup',starts[(starts.indexOf(startup)+1)%starts.length]);renderSettings(root);}),
      settingsRow('Backup & transfer','Network transfer and backup options','Open',()=>{}),
      settingsRow('Storage devices','Manage browser storage and captures','Manage',()=>window.App?.toast?.('Storage','Game streams do not require local installs')),
      settingsRow('Reset console','Reset local profile and console settings','Reset',()=>window.App?.confirmReset?.())
    );
  }

  main.append(panel); shell.append(main); root.append(shell); focusAfter(root,'.console-side-item.active');
}

V.renderLibrary = renderLibrary;
V.renderPass = renderPass;
V.renderSearch = renderSearch;
V.renderSettings = renderSettings;
window.ConsolePages = { renderLibrary, renderPass, renderSearch, renderSettings };
})();
