/* Synapse personalization: Home layout, presets, chrome and wallpaper pinning.
   Wallpaper file storage/rendering stays owned by wallpaper-system.js. */
(() => {
'use strict';

const TOP_IDS = ['library','store','search','settings'];
const TOP_LABELS = {
  library:'My games & apps',
  store:'Store',
  search:'Search',
  settings:'Settings'
};
const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');

const PRESETS = {
  xbox: {
    personalizationPreset:'xbox',
    wallpaperMode:'waves',
    wallpaperBehavior:'dynamic',
    wallpaperBrightness:100,
    wallpaperBlur:0,
    wallpaperMotion:'normal',
    wallpaperDimNavigation:true,
    homeVisibleGames:8,
    homeTileSize:'standard',
    homePromoRow:true,
    homeSectionOrder:'games-first',
    homeTileLabels:false,
    homeSeriesBadges:'hover',
    homeCornerRadius:'xbox',
    homeStartFocus:'profile',
    startupView:'home',
    topBarOrder:['library','store','search','settings'],
    topBarHidden:[],
    topBarTooltips:true,
    topBarSize:'standard',
    profilePosition:'left',
    surfaceTone:'black',
    transparencyStrength:'normal',
    uiScale:1,
    animationStrength:'normal',
    motionBlurStrength:'off',
    accent:'#107c10',
    theme:'light'
  },
  minimal: {
    personalizationPreset:'minimal',
    wallpaperMode:'black',
    wallpaperBehavior:'static',
    wallpaperBrightness:100,
    wallpaperBlur:0,
    wallpaperMotion:'off',
    wallpaperDimNavigation:false,
    homeVisibleGames:5,
    homeTileSize:'compact',
    homePromoRow:false,
    homeSectionOrder:'games-first',
    homeTileLabels:false,
    homeSeriesBadges:'off',
    homeCornerRadius:'xbox',
    homeStartFocus:'profile',
    startupView:'home',
    topBarOrder:['library','store','search','settings'],
    topBarHidden:['library'],
    topBarTooltips:false,
    topBarSize:'compact',
    profilePosition:'left',
    surfaceTone:'black',
    transparencyStrength:'solid',
    uiScale:.95,
    animationStrength:'subtle',
    motionBlurStrength:'off',
    accent:'#f2f2f2',
    theme:'dark'
  },
  synapse: {
    personalizationPreset:'synapse',
    wallpaperMode:'waves',
    wallpaperBehavior:'dynamic',
    wallpaperBrightness:42,
    wallpaperBlur:0,
    wallpaperMotion:'normal',
    wallpaperDimNavigation:true,
    homeVisibleGames:8,
    homeTileSize:'standard',
    homePromoRow:true,
    homeSectionOrder:'games-first',
    homeTileLabels:false,
    homeSeriesBadges:'hover',
    homeCornerRadius:'rounded',
    homeStartFocus:'profile',
    startupView:'home',
    topBarOrder:['library','store','search','settings'],
    topBarHidden:[],
    topBarTooltips:true,
    topBarSize:'standard',
    profilePosition:'left',
    surfaceTone:'black',
    transparencyStrength:'normal',
    uiScale:1,
    animationStrength:'expressive',
    motionBlurStrength:'low',
    accent:'#4ade4a',
    theme:'dark'
  }
};

let applyingPreset = false;
let homeEditing = false;
let drag = null;
let homeMutationQueued = false;

function state(){ return window.State; }
function settings(){ return state()?.settings || {}; }
function wallpaper(){ return window.WallpaperSystem; }

function cloneValue(value){
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') return {...value};
  return value;
}

function markCustom(){
  if (applyingPreset) return;
  if (settings().personalizationPreset === 'custom') return;
  state()?.setSetting('personalizationPreset','custom');
}

function set(key,value,{custom=true}={}){
  if (custom) markCustom();
  if (key.startsWith('wallpaper') && wallpaper()?.set){
    wallpaper().set(key,value);
  } else {
    state()?.setSetting(key,value);
  }
  apply();
}

function applyPreset(name){
  const preset = PRESETS[name];
  if (!preset || !state()) return;
  applyingPreset = true;
  try{
    Object.entries(preset).forEach(([key,value]) => {
      state().setSetting(key,cloneValue(value));
    });
  } finally {
    applyingPreset = false;
  }
  wallpaper()?.apply?.();
  apply();
  window.App?.toast?.('Personalization',
    name === 'synapse' ? 'Synapse preset applied' :
    name === 'minimal' ? 'Minimal preset applied' : 'Xbox preset applied');
}

function presetLabel(value=settings().personalizationPreset){
  return ({xbox:'Xbox',minimal:'Minimal',synapse:'Synapse',custom:'Custom'})[value] || 'Custom';
}
function tileSizeLabel(value=settings().homeTileSize){
  return ({compact:'Compact',standard:'Standard',large:'Large'})[value] || 'Standard';
}
function radiusLabel(value=settings().homeCornerRadius){
  return ({square:'Square',xbox:'Xbox',rounded:'Rounded'})[value] || 'Rounded';
}
function seriesLabel(value=settings().homeSeriesBadges){
  return ({off:'Off',hover:'On focus',always:'Always'})[value] || 'On focus';
}
function animationLabel(value=settings().animationStrength){
  return ({subtle:'Subtle',normal:'Normal',expressive:'Expressive'})[value] || 'Normal';
}
function blurLabel(value=settings().motionBlurStrength){
  return ({off:'Off',low:'Low',strong:'Strong'})[value] || 'Off';
}

function applyMotionVars(){
  const s = settings();
  const root = document.documentElement;
  const strength = s.animationStrength || 'normal';
  const ramp = {
    subtle:['.06s','.12s','.18s','.25s'],
    normal:['.083s','.167s','.25s','.333s'],
    expressive:['.095s','.21s','.32s','.44s']
  }[strength] || ['.083s','.167s','.25s','.333s'];
  root.style.setProperty('--dur-fast',ramp[0]);
  root.style.setProperty('--dur',ramp[1]);
  root.style.setProperty('--dur-mid',ramp[2]);
  root.style.setProperty('--dur-slow',ramp[3]);
}

function applyTopBar(){
  const s = settings();
  const nav = document.getElementById('sysnav');
  if (!nav) return;
  const buttons = [...nav.querySelectorAll('.sysnav-btn[data-view]')];
  const byId = new Map(buttons.map(btn => [btn.dataset.view,btn]));
  const order = Array.isArray(s.topBarOrder) && s.topBarOrder.length ? s.topBarOrder : TOP_IDS;

  [...order,...TOP_IDS].forEach(id => {
    const btn = byId.get(id);
    if (btn && btn.parentElement === nav) nav.append(btn);
  });

  const hidden = new Set(Array.isArray(s.topBarHidden) ? s.topBarHidden : []);
  byId.forEach((btn,id) => {
    btn.hidden = id === 'settings' ? false : hidden.has(id);
    btn.classList.remove('personal-first','personal-last');
  });
  const visible = [...nav.querySelectorAll('.sysnav-btn[data-view]')].filter(btn => !btn.hidden);
  visible[0]?.classList.add('personal-first');
  visible.at(-1)?.classList.add('personal-last');
}

function applyHomeLayout(){
  const s = settings();
  const home = document.getElementById('view-home');
  if (!home) return;

  const games = [...home.querySelectorAll('.ref-strip .ref-tile[data-ref-title]')];
  const max = Number(s.homeVisibleGames || 8);
  games.forEach((tile,index) => {
    tile.hidden = max < 90 && index >= max;
    tile.dataset.wallpaperPinned = s.perGameWallpaperPinned?.[norm(tile.dataset.refTitle)] ? '1' : '0';
  });

  if (homeEditing) syncHomeEditorTiles();
}

function apply(){
  const s = settings();
  const body = document.body;
  const root = document.documentElement;

  body.dataset.homeTileSize = s.homeTileSize || 'standard';
  body.dataset.homePromos = s.homePromoRow === false ? 'off' : 'on';
  body.dataset.homeSectionOrder = s.homeSectionOrder || 'games-first';
  body.dataset.homeLabels = s.homeTileLabels ? 'on' : 'off';
  body.dataset.homeSeriesBadges = s.homeSeriesBadges || 'hover';
  body.dataset.homeRadius = s.homeCornerRadius || 'rounded';
  body.dataset.topbarTooltips = s.topBarTooltips === false ? 'off' : 'on';
  body.dataset.topbarSize = s.topBarSize || 'standard';
  body.dataset.profilePosition = s.profilePosition || 'left';
  body.dataset.surfaceTone = s.surfaceTone || 'black';
  body.dataset.transparencyStrength = s.transparencyStrength || 'normal';
  body.dataset.animationStrength = s.animationStrength || 'normal';
  body.dataset.motionBlur = s.motionBlurStrength || 'off';
  body.dataset.theme = s.theme || 'light';

  root.style.setProperty('--accent',s.accent || '#4ade4a');
  root.style.setProperty('--text-scale',String((s.textScale || 1) * (s.uiScale || 1)));
  root.dataset.motion = s.motion || 'full';

  applyMotionVars();
  applyTopBar();
  applyHomeLayout();
  handleHomeFocus(document.querySelector('[data-focused]'));
}

function topbarLabel(){
  const s = settings();
  const hidden = new Set(s.topBarHidden || []);
  const order = Array.isArray(s.topBarOrder) ? s.topBarOrder : TOP_IDS;
  return order.filter(id => id === 'settings' || !hidden.has(id)).map(id => TOP_LABELS[id]).join(' · ');
}

function makePreview(){
  const s = settings();
  const box = document.createElement('div');
  box.className = 'personal-preview';
  box.dataset.mode = s.wallpaperMode || 'waves';

  const bg = document.createElement('div');
  bg.className = 'personal-preview-bg';
  const top = document.createElement('div');
  top.className = 'personal-preview-top';
  for(let i=0;i<4;i++) top.append(document.createElement('i'));

  const row = document.createElement('div');
  row.className = 'personal-preview-row';
  const visible = Math.min(6,Number(s.homeVisibleGames || 8));
  for(let i=0;i<visible;i++) row.append(document.createElement('i'));

  const copy = document.createElement('div');
  copy.className = 'personal-preview-copy';
  const strong = document.createElement('strong');
  strong.textContent = presetLabel();
  const small = document.createElement('span');
  small.textContent = (wallpaper()?.modeLabel?.(s.wallpaperMode) || 'Waves') + ' · ' +
    tileSizeLabel() + ' tiles · autosaved';
  copy.append(strong,small);

  box.append(bg,top,row,copy);

  if ((s.wallpaperMode === 'custom') && s.wallpaperId && wallpaper()?.get){
    wallpaper().get(s.wallpaperId).then(rec => {
      if (!box.isConnected || !rec?.blob || rec.type !== 'image') return;
      const url = URL.createObjectURL(rec.blob);
      bg.style.backgroundImage = 'linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.25)),url("' + url + '")';
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    }).catch(()=>{});
  }
  return box;
}

function closeEditor(){
  document.querySelector('.personal-editor')?.remove();
}

function openTopBarEditor(done){
  closeEditor();
  const overlay = document.createElement('div');
  overlay.className = 'personal-editor';
  const panel = document.createElement('div');
  panel.className = 'personal-editor-panel';
  const head = document.createElement('div');
  head.className = 'personal-editor-head';
  head.innerHTML = '<div><h2>Customize top bar</h2><p>Move buttons or hide the ones you do not need.</p></div>';
  const close = document.createElement('button');
  close.textContent = 'Done';
  close.dataset.nav = '';
  const finish = () => { closeEditor(); done?.(); };
  close._navActivate = finish;
  close.addEventListener('click',finish);
  head.append(close);
  panel.append(head);
  overlay.append(panel);
  document.body.append(overlay);

  function draw(){
    panel.querySelectorAll('.personal-editor-row').forEach(node=>node.remove());
    const s = settings();
    const order = (Array.isArray(s.topBarOrder) ? s.topBarOrder : TOP_IDS).filter(id=>TOP_IDS.includes(id));
    const hidden = new Set(s.topBarHidden || []);

    order.forEach((id,index)=>{
      const row = document.createElement('div');
      row.className = 'personal-editor-row';
      const label = document.createElement('strong');
      label.textContent = TOP_LABELS[id];

      const up = document.createElement('button');
      const down = document.createElement('button');
      const show = document.createElement('button');
      up.textContent = '↑';
      down.textContent = '↓';
      show.textContent = id === 'settings' ? 'Pinned' : (hidden.has(id) ? 'Show' : 'Hide');
      [up,down,show].forEach(btn=>btn.dataset.nav='');

      const move = delta => {
        const next = [...order];
        const target = Math.max(0,Math.min(next.length-1,index+delta));
        if(target === index) return;
        [next[index],next[target]] = [next[target],next[index]];
        set('topBarOrder',next);
        draw();
      };
      up._navActivate = ()=>move(-1);
      down._navActivate = ()=>move(1);
      up.addEventListener('click',()=>move(-1));
      down.addEventListener('click',()=>move(1));

      const toggle = () => {
        if(id === 'settings') return;
        const next = new Set(settings().topBarHidden || []);
        next.has(id) ? next.delete(id) : next.add(id);
        set('topBarHidden',[...next]);
        draw();
      };
      show._navActivate = toggle;
      show.addEventListener('click',toggle);

      row.append(label,up,down,show);
      panel.append(row);
    });
    window.Nav?.repaint?.();
  }

  draw();
  requestAnimationFrame(()=>window.Nav?.focusIn?.(overlay,'.personal-editor-head button'));
}

function editorBanner(){
  document.querySelector('.home-customize-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'home-customize-banner';
  const copy = document.createElement('div');
  copy.innerHTML = '<strong>Customize Home</strong><span>Drag or use ← → to reorder · X hides · Y pins this wallpaper · B finishes</span>';
  const done = document.createElement('button');
  done.textContent = 'Done';
  done.dataset.nav = '';
  done._navActivate = finishHomeEditor;
  done.addEventListener('click',finishHomeEditor);
  banner.append(copy,done);
  document.body.append(banner);
}

function syncHomeEditorTiles(){
  if(!homeEditing) return;
  document.querySelectorAll('#view-home .ref-strip .ref-tile[data-ref-title]').forEach(tile=>{
    tile.dataset.homeEditable='1';
  });
}

function startHomeEditor(){
  homeEditing = true;
  document.body.dataset.homeEditing = 'true';
  window.App?.setView?.('home');
  editorBanner();
  setTimeout(()=>{
    syncHomeEditorTiles();
    const first = document.querySelector('#view-home .ref-strip .ref-tile[data-ref-title]:not([hidden])');
    if(first) window.Nav?.focus?.(first,{silent:true});
  },100);
}

function finishHomeEditor(){
  if(!homeEditing) return;
  homeEditing = false;
  drag = null;
  document.body.dataset.homeEditing = 'false';
  document.querySelector('.home-customize-banner')?.remove();
  document.querySelectorAll('.personal-dragging').forEach(x=>x.classList.remove('personal-dragging'));
  window.App?.toast?.('Home','Layout saved');
}

async function saveHomeOrder(){
  const titles = [...document.querySelectorAll('#view-home .ref-strip .ref-tile[data-ref-title]')]
    .map(tile=>tile.dataset.refTitle).filter(Boolean);
  if(titles.length) await window.XboxHome?.reorderByTitles?.(titles);
}

function focusedHomeTile(){
  return document.querySelector(
    '#view-home .ref-tile[data-focused][data-ref-title], #view-home .ref-tile:focus[data-ref-title]'
  );
}

function moveFocused(delta){
  if(!homeEditing) return;
  const tile = focusedHomeTile();
  const strip = tile?.parentElement;
  if(!tile || !strip) return;
  const list = [...strip.querySelectorAll('.ref-tile[data-ref-title]')];
  const index = list.indexOf(tile);
  const target = Math.max(0,Math.min(list.length-1,index+delta));
  if(target === index) return;
  if(delta < 0) strip.insertBefore(tile,list[target]);
  else strip.insertBefore(tile,list[target].nextSibling);
  void saveHomeOrder();
  window.Nav?.repaint?.();
  window.Nav?.focus?.(tile,{silent:true});
}

async function gameForTitle(title){
  try{
    const all = await window.StratusCloud?.loadCatalogue?.() || [];
    const key = norm(title);
    return all.find(game=>norm(game?.name)===key) || null;
  }catch{
    return null;
  }
}

async function hideFocusedGame(){
  const tile = focusedHomeTile();
  if(!tile) return;
  const game = await gameForTitle(tile.dataset.refTitle) || { name:tile.dataset.refTitle };
  window.XboxHome?.remove?.(game);
}

function isWallpaperPinned(title){
  return !!settings().perGameWallpaperPinned?.[norm(title)];
}

function toggleFocusedWallpaperPin(){
  const tile = focusedHomeTile();
  if(!tile) return;
  const key = norm(tile.dataset.refTitle);
  const map = {...(settings().perGameWallpaperPinned || {})};
  if(map[key]){
    delete map[key];
    window.App?.toast?.('Game background',tile.dataset.refTitle + ' follows normal background behavior');
  }else{
    map[key] = true;
    window.App?.toast?.('Game background','Pinned current wallpaper for ' + tile.dataset.refTitle);
  }
  set('perGameWallpaperPinned',map);
  if(map[key]) wallpaper()?.restore?.();
}

function shouldPaintGameArt(title){
  if(isWallpaperPinned(title)) return false;
  return wallpaper()?.shouldPaintGameArt?.(title) ?? true;
}

function handleHomeFocus(target){
  if(document.body.dataset.view !== 'home') return;
  const tile = target?.closest?.('.ref-tile[data-ref-title]');
  const dim = settings().wallpaperDimNavigation !== false && !tile;
  document.body.dataset.wallpaperDim = dim ? 'on' : 'off';
  if(tile && isWallpaperPinned(tile.dataset.refTitle)){
    void wallpaper()?.restore?.();
  }
}

function resetHomeLayout(){
  if(!state()) return;
  const defaults = {
    homeVisibleGames:8,
    homeTileSize:'standard',
    homePromoRow:true,
    homeSectionOrder:'games-first',
    homeTileLabels:false,
    homeSeriesBadges:'hover',
    homeCornerRadius:'rounded',
    homeStartFocus:'profile',
    perGameWallpaperPinned:{}
  };
  markCustom();
  Object.entries(defaults).forEach(([key,value])=>state().setSetting(key,cloneValue(value)));
  window.XboxHome?.reset?.();
  apply();
  window.App?.toast?.('Home','Home layout reset');
}

document.addEventListener('pointerdown',event=>{
  if(!homeEditing) return;
  const tile = event.target.closest?.('#view-home .ref-tile[data-ref-title]');
  if(!tile) return;
  drag = {tile,startX:event.clientX,startY:event.clientY,moved:false,pointerId:event.pointerId};
  try{ tile.setPointerCapture?.(event.pointerId); }catch{}
},true);

document.addEventListener('pointermove',event=>{
  if(!homeEditing || !drag || drag.pointerId !== event.pointerId) return;
  const dx = event.clientX-drag.startX;
  const dy = event.clientY-drag.startY;
  if(!drag.moved && Math.hypot(dx,dy)<10) return;
  drag.moved = true;
  drag.tile.classList.add('personal-dragging');
  const hit = document.elementFromPoint(event.clientX,event.clientY)
    ?.closest?.('#view-home .ref-tile[data-ref-title]');
  if(!hit || hit===drag.tile || hit.parentElement!==drag.tile.parentElement) return;
  const rect = hit.getBoundingClientRect();
  drag.tile.parentElement.insertBefore(drag.tile,event.clientX < rect.left+rect.width/2 ? hit : hit.nextSibling);
},true);

document.addEventListener('pointerup',event=>{
  if(!drag || drag.pointerId !== event.pointerId) return;
  const moved = drag.moved;
  drag.tile.classList.remove('personal-dragging');
  drag = null;
  if(moved) void saveHomeOrder();
},true);

document.addEventListener('click',event=>{
  if(!homeEditing) return;
  const tile = event.target.closest?.('#view-home .ref-tile[data-ref-title]');
  if(!tile) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.Nav?.focus?.(tile,{silent:true});
},true);

document.addEventListener('keydown',event=>{
  if(!homeEditing) return;
  if(event.key==='ArrowLeft'){ event.preventDefault(); event.stopImmediatePropagation(); moveFocused(-1); }
  if(event.key==='ArrowRight'){ event.preventDefault(); event.stopImmediatePropagation(); moveFocused(1); }
  if(event.key==='Escape'){ event.preventDefault(); event.stopImmediatePropagation(); finishHomeEditor(); }
},true);

window.addEventListener('nav:button',event=>{
  if(!homeEditing) return;
  const button = event.detail?.button;
  if(button==='b'){
    event.stopImmediatePropagation?.();
    finishHomeEditor();
  } else if(button==='x'){
    event.stopImmediatePropagation?.();
    void hideFocusedGame();
  } else if(button==='y'){
    event.stopImmediatePropagation?.();
    toggleFocusedWallpaperPin();
  }
},true);

window.addEventListener('nav:focus',event=>{
  handleHomeFocus(event.detail?.el || event.detail?.node || event.target);
});

const home = document.getElementById('view-home');
if(home){
  new MutationObserver(()=>{
    if(homeMutationQueued) return;
    homeMutationQueued = true;
    requestAnimationFrame(()=>{
      homeMutationQueued = false;
      applyHomeLayout();
    });
  }).observe(home,{childList:true,subtree:true});
}

state()?.on?.(event=>{
  if(event?.type==='settings') apply();
});

window.Personalization = {
  PRESETS,
  apply,
  set,
  markCustom,
  applyPreset,
  presetLabel,
  tileSizeLabel,
  radiusLabel,
  seriesLabel,
  animationLabel,
  blurLabel,
  topbarLabel,
  makePreview,
  openTopBarEditor,
  startHomeEditor,
  finishHomeEditor,
  resetHomeLayout,
  shouldPaintGameArt,
  isWallpaperPinned,
  get isEditingHome(){ return homeEditing; }
};

apply();
})();
