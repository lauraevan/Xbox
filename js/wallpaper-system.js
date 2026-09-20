/* Original-quality Home wallpaper system.
   Custom files are stored as their untouched Blob bytes in IndexedDB.
   No canvas resize, transcoding, recompression, or quality reduction. */
(() => {
'use strict';

const DB_NAME = 'synapse.wallpapers.v1';
const STORE = 'wallpapers';

let dbPromise = null;
let media = null;
let mediaUrl = '';
let mediaId = '';
let randomId = '';

const State = () => window.State;
const settings = () => State()?.settings || {};

function openDb(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)){
        req.result.createObjectStore(STORE,{keyPath:'id'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open wallpaper storage'));
  });
  return dbPromise;
}

async function list(){
  try{
    const db = await openDb();
    return await new Promise((resolve,reject) => {
      const req = db.transaction(STORE,'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a,b)=>(b.created||0)-(a.created||0)));
      req.onerror = () => reject(req.error);
    });
  }catch{
    return [];
  }
}

async function get(id){
  if (!id) return null;
  try{
    const db = await openDb();
    return await new Promise((resolve,reject) => {
      const req = db.transaction(STORE,'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }catch{
    return null;
  }
}

async function saveOriginal(file){
  try { await navigator.storage?.persist?.(); } catch {}
  const rec = {
    id:'wall-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
    name:String(file.name || 'Wallpaper').slice(0,100),
    type:file.type.startsWith('video/') ? 'video' : 'image',
    mime:file.type || '',
    size:file.size || 0,
    created:Date.now(),
    blob:file
  };
  const db = await openDb();
  await new Promise((resolve,reject) => {
    const tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not save wallpaper'));
  });
  return rec;
}

async function remove(id){
  if (!id) return;
  try{
    const db = await openDb();
    await new Promise((resolve,reject) => {
      const tx = db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }catch{}
}

async function rename(id,name){
  const rec = await get(id);
  const next = String(name || '').trim().slice(0,100);
  if (!rec || !next) return false;
  rec.name = next;
  const db = await openDb();
  await new Promise((resolve,reject) => {
    const tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return true;
}

function clearGameArt(){
  for (const id of ['bgA','bgB']){
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.remove('on','wide','reference-wide');
    el.style.backgroundImage = 'none';
    delete el.dataset.dynamicTitle;
  }
}

function destroyMedia(){
  document.body.classList.remove('wallpaper-custom-active');
  if (media?.tagName === 'VIDEO'){
    try { media.pause(); } catch {}
  }
  media?.remove();
  media = null;
  mediaId = '';
  if (mediaUrl){
    try { URL.revokeObjectURL(mediaUrl); } catch {}
    mediaUrl = '';
  }
}

function stopMedia(){
  document.body.classList.remove('wallpaper-custom-active');
  if (media?.tagName === 'VIDEO'){
    try { media.pause(); } catch {}
  }
}

function ensureMedia(type){
  const tag = type === 'video' ? 'VIDEO' : 'IMG';
  if (media?.tagName === tag) return media;
  destroyMedia();
  media = document.createElement(type === 'video' ? 'video' : 'img');
  media.className = 'wallpaper-custom-media';
  media.setAttribute('aria-hidden','true');
  if (type === 'video'){
    media.muted = true;
    media.defaultMuted = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = 'auto';
    media.setAttribute('muted','');
    media.setAttribute('playsinline','');
    media.setAttribute('webkit-playsinline','');
  } else {
    media.alt = '';
    media.decoding = 'async';
  }
  const backdrop = document.querySelector('.backdrop');
  const waves = document.getElementById('homeNeutralVideo');
  backdrop?.insertBefore(media,waves?.nextSibling || backdrop.firstChild);
  return media;
}

function videoMayPlay(){
  const s = settings();
  return (s.wallpaperMotion || 'normal') !== 'off'
    && (s.wallpaperBehavior || 'dynamic') === 'dynamic'
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

async function showRecord(rec){
  if (!rec?.blob) return false;
  if (mediaId !== rec.id){
    const el = ensureMedia(rec.type);
    if (mediaUrl){
      try { URL.revokeObjectURL(mediaUrl); } catch {}
    }
    /* Object URL points directly at the exact original Blob. */
    mediaUrl = URL.createObjectURL(rec.blob);
    el.src = mediaUrl;
    mediaId = rec.id;
  }
  document.body.classList.add('wallpaper-custom-active');
  if (media?.tagName === 'VIDEO'){
    if (document.body.dataset.view === 'home' && !document.hidden && videoMayPlay()){
      try { await media.play(); } catch {}
    } else {
      try { media.pause(); } catch {}
    }
  }
  return true;
}

async function randomRecord(){
  const all = await list();
  if (!all.length) return null;
  if (!randomId || !all.some(x=>x.id===randomId)){
    try{
      const saved = sessionStorage.getItem('synapse.wallpaper.random');
      if (saved && all.some(x=>x.id===saved)) randomId = saved;
    }catch{}
  }
  if (!randomId){
    randomId = all[Math.floor(Math.random()*all.length)].id;
    try { sessionStorage.setItem('synapse.wallpaper.random',randomId); } catch {}
  }
  return all.find(x=>x.id===randomId) || all[0];
}

async function restore(){
  if (document.body.dataset.view && document.body.dataset.view !== 'home') {
    stopMedia();
    return;
  }
  const s = settings();
  const mode = s.wallpaperMode || 'waves';
  document.body.dataset.wallpaperMode = mode;
  document.body.dataset.homeNeutral = 'true';
  clearGameArt();

  if (mode === 'custom'){
    const rec = await get(s.wallpaperId);
    if (rec && await showRecord(rec)) return;
  } else if (mode === 'random'){
    const rec = await randomRecord();
    if (rec && await showRecord(rec)) return;
  } else if (s.wallpaper && /^https?:|^data:|^blob:/.test(s.wallpaper)){
    /* Preserve the old URL wallpaper setting if a user already had one. */
    destroyMedia();
    const img = ensureMedia('image');
    img.src = s.wallpaper;
    document.body.classList.add('wallpaper-custom-active');
    return;
  }

  stopMedia();
}

function shouldPaintGameArt(){
  const s = settings();
  if ((s.wallpaperMode || 'waves') === 'game') return true;
  return ['adaptive','dynamic'].includes(s.wallpaperBehavior || 'dynamic');
}

function onGameArtPaint(){
  stopMedia();
  document.body.dataset.homeNeutral = 'false';
}

function apply(){
  const s = settings();
  const root = document.documentElement;
  document.body.dataset.wallpaperMode = s.wallpaperMode || 'waves';
  document.body.dataset.wallpaperBehavior = s.wallpaperBehavior || 'dynamic';
  root.style.setProperty('--wallpaper-brightness',
    String(Math.max(10,Math.min(120,Number(s.wallpaperBrightness ?? 42)))/100));
  root.style.setProperty('--wallpaper-blur',
    String(Math.max(0,Math.min(18,Number(s.wallpaperBlur || 0))))+'px');

  const focusedGame = document.querySelector('#view-home .ref-tile[data-focused][data-ref-title]');
  if (document.body.dataset.view === 'home' && (!focusedGame || !shouldPaintGameArt())){
    void restore();
  } else if (document.body.dataset.view !== 'home'){
    stopMedia();
  }
}

function set(key,value){
  State()?.setSetting(key,value);
  apply();
}

function modeLabel(v=settings().wallpaperMode){
  return ({waves:'Waves',black:'Solid black',game:'Game artwork',custom:'Custom',random:'Random saved'})[v] || 'Waves';
}
function behaviorLabel(v=settings().wallpaperBehavior){
  return ({static:'Static',adaptive:'Adaptive',dynamic:'Dynamic'})[v] || 'Dynamic';
}

function bytes(n){
  const value=Number(n)||0;
  if(value<1024*1024) return (value/1024).toFixed(value>10240?0:1)+' KB';
  if(value<1024*1024*1024) return (value/(1024*1024)).toFixed(1)+' MB';
  return (value/(1024*1024*1024)).toFixed(2)+' GB';
}

async function upload(kind,done){
  const input=document.createElement('input');
  input.type='file';
  input.accept=kind==='video'?'video/*':'image/*';
  input.hidden=true;
  document.body.append(input);
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];
    input.remove();
    if(!file) return;
    try{
      const rec=await saveOriginal(file);
      State()?.setSetting('wallpaperId',rec.id);
      State()?.setSetting('wallpaperMode','custom');
      apply();
      window.App?.toast?.('Wallpaper',rec.name+' · original quality');
      done?.();
    }catch(err){
      window.App?.toast?.('Wallpaper',err?.message || 'Not enough browser storage for that original file.');
    }
  },{once:true});
  input.click();
}

async function use(id,done){
  const rec=await get(id);
  if(!rec) return;
  State()?.setSetting('wallpaperId',id);
  State()?.setSetting('wallpaperMode','custom');
  apply();
  done?.();
}

function closeManager(){
  document.querySelector('.wallpaper-manager')?.remove();
}

function openManager(done){
  closeManager();
  const overlay=document.createElement('div');
  overlay.className='wallpaper-manager';
  const panel=document.createElement('div');
  panel.className='wallpaper-manager-panel';
  panel.innerHTML='<div class="wallpaper-manager-head"><h2>My wallpapers</h2><button data-nav>Done</button></div>';
  overlay.append(panel);
  document.body.append(overlay);
  const doneBtn=panel.querySelector('button');
  const finish=()=>{closeManager();done?.();};
  doneBtn._navActivate=finish;
  doneBtn.addEventListener('click',finish);

  async function draw(){
    panel.querySelectorAll('.wallpaper-manager-row,.wallpaper-manager-empty').forEach(x=>x.remove());
    const all=await list();
    if(!overlay.isConnected) return;
    if(!all.length){
      const empty=document.createElement('div');
      empty.className='wallpaper-manager-empty';
      empty.textContent='No custom wallpapers saved yet.';
      panel.append(empty);
      return;
    }
    all.forEach(rec=>{
      const row=document.createElement('div');
      row.className='wallpaper-manager-row';
      const name=document.createElement('div');
      name.innerHTML='<strong></strong><small></small>';
      name.querySelector('strong').textContent=rec.name;
      name.querySelector('small').textContent=(rec.type==='video'?'Video':'Image')+' · '+bytes(rec.size)+' · Original file';
      const useBtn=document.createElement('button');
      useBtn.textContent=settings().wallpaperId===rec.id?'Selected':'Use';
      useBtn.dataset.nav='';
      const renameBtn=document.createElement('button');
      renameBtn.textContent='Rename';
      renameBtn.dataset.nav='';
      const delBtn=document.createElement('button');
      delBtn.textContent='Delete';
      delBtn.dataset.nav='';

      const select=async()=>{await use(rec.id);draw();};
      useBtn._navActivate=select; useBtn.addEventListener('click',select);

      const renameIt=async()=>{
        const next=prompt('Wallpaper name',rec.name);
        if(next!=null && await rename(rec.id,next)) draw();
      };
      renameBtn._navActivate=renameIt; renameBtn.addEventListener('click',renameIt);

      const removeIt=async()=>{
        if(!confirm('Delete "'+rec.name+'"?')) return;
        await remove(rec.id);
        if(mediaId===rec.id) destroyMedia();
        if(settings().wallpaperId===rec.id){
          State()?.setSetting('wallpaperId','');
          State()?.setSetting('wallpaperMode','waves');
        }
        if(randomId===rec.id) randomId='';
        apply();
        draw();
      };
      delBtn._navActivate=removeIt; delBtn.addEventListener('click',removeIt);

      row.append(name,useBtn,renameBtn,delBtn);
      panel.append(row);
    });
    window.Nav?.repaint?.();
  }
  void draw();
  requestAnimationFrame(()=>window.Nav?.focusIn?.(overlay,'.wallpaper-manager-head button'));
}

async function mountLibrary(panel,rerender){
  const old=panel.querySelector('.wallpaper-library');
  old?.remove();
  const wrap=document.createElement('div');
  wrap.className='wallpaper-library';
  wrap.innerHTML='<div class="console-settings-group-title"><strong>My wallpapers</strong><span>Stored locally in their original uploaded quality.</span></div>';
  const grid=document.createElement('div');
  grid.className='wallpaper-grid';
  wrap.append(grid);
  panel.append(wrap);

  const all=await list();
  if(!wrap.isConnected) return;
  if(!all.length){
    const empty=document.createElement('div');
    empty.className='wallpaper-empty';
    empty.textContent='Add an image or video above. Files are saved without recompression.';
    grid.append(empty);
    return;
  }
  all.slice(0,8).forEach(rec=>{
    const card=document.createElement('button');
    card.className='wallpaper-card'+(rec.type==='video'?' video':'');
    card.dataset.nav='';
    card.setAttribute('aria-label',rec.name);
    const label=document.createElement('span');
    label.textContent=rec.name;
    const quality=document.createElement('small');
    quality.textContent='Original · '+bytes(rec.size);
    card.append(label,quality);
    if(rec.type==='image'){
      const img=document.createElement('img');
      const url=URL.createObjectURL(rec.blob);
      img.alt='';
      img.src=url;
      img.onload=()=>setTimeout(()=>URL.revokeObjectURL(url),1000);
      card.prepend(img);
    }
    const select=()=>void use(rec.id,rerender);
    card._navActivate=select;
    card.addEventListener('click',select);
    grid.append(card);
  });
  window.Nav?.repaint?.();
}

function handleFocus(target){
  if(document.body.dataset.view!=='home') return;
  const game=target?.closest?.('.ref-tile[data-ref-title]');
  if(game) return;
  void restore();
}

window.addEventListener('nav:focus',e=>handleFocus(e.detail?.el || e.detail?.node || e.target));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) stopMedia();
  else if(document.body.dataset.view==='home') void restore();
});
new MutationObserver(()=>{
  if(document.body.dataset.view==='home') apply();
  else stopMedia();
}).observe(document.body,{attributes:true,attributeFilter:['data-view']});
State()?.on?.(e=>{ if(e?.type==='settings') apply(); });

window.WallpaperSystem={
  apply,set,modeLabel,behaviorLabel,upload,use,list,get,openManager,mountLibrary,
  shouldPaintGameArt,onGameArtPaint,restore
};

apply();
})();
