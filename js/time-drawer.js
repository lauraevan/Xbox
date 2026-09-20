/* Minimal clock drawer + quick personalization. */
(() => {
'use strict';

const clock=document.getElementById('clock');
if(!clock) return;

const DEFAULT_WEATHER=Object.freeze({lat:46.7216,lon:-92.4594});
let drawer=null,timer=null,lastWeatherAt=0;

const iconSvg=kind=>{
 const icons={
  clear:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="11"/><path d="M32 7v8M32 49v8M7 32h8M49 32h8M14.4 14.4l5.7 5.7M43.9 43.9l5.7 5.7M49.6 14.4l-5.7 5.7M20.1 43.9l-5.7 5.7"/></svg>',
  partly:'<svg viewBox="0 0 64 64"><path d="M21 27a12 12 0 1 1 22 6"/><path d="M18 48h27a9 9 0 0 0 0-18c-1 0-2 .1-3 .5A13 13 0 0 0 17.5 34 7 7 0 0 0 18 48Z"/></svg>',
  cloudy:'<svg viewBox="0 0 64 64"><path d="M17 48h31a10 10 0 0 0 0-20c-1.3 0-2.5.2-3.7.7A15 15 0 0 0 16 34.5 7.5 7.5 0 0 0 17 48Z"/></svg>',
  rain:'<svg viewBox="0 0 64 64"><path d="M17 38h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 26 7 7 0 0 0 17 38Z"/><path d="M20 47l-3 7M32 47l-3 7M44 47l-3 7"/></svg>',
  snow:'<svg viewBox="0 0 64 64"><path d="M17 37h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 25 7 7 0 0 0 17 37Z"/><path d="M21 48h.1M32 52h.1M43 47h.1"/></svg>',
  storm:'<svg viewBox="0 0 64 64"><path d="M17 36h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 24 7 7 0 0 0 17 36Z"/><path d="M34 40l-7 11h7l-4 8 12-14h-7l4-5"/></svg>',
  fog:'<svg viewBox="0 0 64 64"><path d="M17 33h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 21 7 7 0 0 0 17 33Z"/><path d="M13 42h38M17 49h30"/></svg>'
 };
 return icons[kind]||icons.cloudy;
};
function weatherMeta(code){
 code=Number(code);
 if(code===0)return['Clear','clear'];
 if([1,2].includes(code))return['Partly cloudy','partly'];
 if(code===3)return['Cloudy','cloudy'];
 if([45,48].includes(code))return['Foggy','fog'];
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return['Rain','rain'];
 if([71,73,75,77,85,86].includes(code))return['Snow','snow'];
 if([95,96,99].includes(code))return['Storms','storm'];
 return['Cloudy','cloudy'];
}
function formatTime(date=new Date()){
 const time=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(date);
 const dateText=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(date);
 return {time,dateText};
}
function renderTime(){
 if(!drawer)return;
 const p=formatTime();
 drawer.querySelector('[data-time-main]').textContent=p.time;
 drawer.querySelector('[data-date-main]').textContent=p.dateText;
}
function getCoords(){
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation)return reject(new Error('no location'));
  navigator.geolocation.getCurrentPosition(
   p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),reject,
   {enableHighAccuracy:false,timeout:5000,maximumAge:10*60*1000}
  );
 });
}
async function fetchWeather(coords){
 const u=new URL('https://api.open-meteo.com/v1/forecast');
 u.searchParams.set('latitude',coords.lat);u.searchParams.set('longitude',coords.lon);
 u.searchParams.set('current','temperature_2m,weather_code');
 u.searchParams.set('temperature_unit','fahrenheit');u.searchParams.set('timezone','auto');u.searchParams.set('forecast_days','1');
 const r=await fetch(u,{cache:'no-store'});
 if(!r.ok)throw new Error('weather');
 return r.json();
}
async function updateWeather(force=false){
 if(!drawer)return;
 if(!force&&Date.now()-lastWeatherAt<10*60*1000)return;
 const temp=drawer.querySelector('[data-weather-temp]');
 const cond=drawer.querySelector('[data-weather-condition]');
 const icon=drawer.querySelector('[data-weather-icon]');
 temp.textContent='--°';cond.textContent='';
 let coords=DEFAULT_WEATHER;
 try{coords=await getCoords();}catch{}
 try{
  const d=await fetchWeather(coords),c=d?.current;
  if(!c)throw new Error('weather');
  const [label,kind]=weatherMeta(c.weather_code);
  temp.textContent=Math.round(Number(c.temperature_2m))+'°';
  cond.textContent=label;icon.innerHTML=iconSvg(kind);lastWeatherAt=Date.now();
 }catch{cond.textContent='Unavailable';}
}
const cycle=(v,arr)=>arr[(Math.max(0,arr.indexOf(v))+1)%arr.length];
function set(key,value){
 if(window.Personalization?.set) window.Personalization.set(key,value);
 else window.State?.setSetting?.(key,value);
 refreshControls();
}
function labelMap(value,map){return map[value]||value;}
function control(title,value,action,id){
 const b=document.createElement('button');
 b.className='drawer-personal-control';b.type='button';b.dataset.nav='';b.dataset.personal=id;
 b.innerHTML='<span>'+title+'</span><strong>'+value+'</strong>';
 b._navActivate=action;b.addEventListener('click',action);return b;
}
function refreshControls(){
 if(!drawer)return;
 const host=drawer.querySelector('[data-personal-controls]');
 if(!host)return;
 host.innerHTML='';
 const s=window.State?.settings||{};
 host.append(
  control('Background',labelMap(s.homeBackgroundMode||'waves',{waves:'Waves',black:'Black',game:'Game art',custom:'Custom',random:'Random'}),()=>{
   set('homeBackgroundMode',cycle(s.homeBackgroundMode||'waves',['waves','black','game','custom','random']));
  },'background'),
  control('Waves',labelMap(s.waveTheme||'original',{original:'Original',cool:'Cool',mono:'Mono',warm:'Warm'}),()=>{
   set('waveTheme',cycle(s.waveTheme||'original',['original','cool','mono','warm']));
  },'waves'),
  control('Brightness',(s.backgroundBrightness??42)+'%',()=>{
   set('backgroundBrightness',cycle(s.backgroundBrightness??42,[25,42,55,70,85,100]));
  },'brightness'),
  control('Blur',(s.backgroundBlur||0)?(s.backgroundBlur+'px'):'Off',()=>{
   set('backgroundBlur',cycle(s.backgroundBlur||0,[0,2,4,8,12]));
  },'blur'),
  control('Motion',labelMap(s.backgroundMotion||'normal',{off:'Off',low:'Low',normal:'Normal'}),()=>{
   set('backgroundMotion',cycle(s.backgroundMotion||'normal',['off','low','normal']));
  },'motion'),
  control('Style',labelMap(s.personalizationPreset||'synapse',{synapse:'Synapse',xbox:'Xbox',minimal:'Minimal',custom:'Custom'}),()=>{
   const next=cycle(s.personalizationPreset||'synapse',['synapse','xbox','minimal']);
   window.Personalization?.applyPreset?.(next);refreshControls();
  },'style')
 );
 window.Nav?.repaint?.();
}
function makeDrawer(){
 const root=document.createElement('aside');root.className='time-drawer';root.setAttribute('aria-hidden','true');
 root.innerHTML=`
  <div class="time-drawer-scrim" data-time-close></div>
  <section class="time-drawer-panel" role="dialog" aria-modal="true" aria-label="Quick settings">
   <div class="time-drawer-head">
    <div class="time-drawer-clock" data-time-main>--:--</div>
    <div class="time-drawer-date" data-date-main></div>
    <div class="time-weather">
     <div class="time-weather-icon" data-weather-icon>${iconSvg('cloudy')}</div>
     <div class="time-weather-temp" data-weather-temp>--°</div>
     <div class="time-weather-condition" data-weather-condition></div>
    </div>
   </div>
   <div class="drawer-personal-controls" data-personal-controls></div>
  </section>`;
 document.body.append(root);
 root.querySelector('[data-time-close]').addEventListener('click',close);
 refreshControls();return root;
}
function open(){
 if(!drawer)drawer=makeDrawer();
 renderTime();refreshControls();drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');
 clock.setAttribute('aria-expanded','true');window.Nav?.hideRing?.();void updateWeather(true);
 requestAnimationFrame(()=>window.Nav?.focusIn?.(drawer,'.drawer-personal-control'));
}
function close(){
 if(!drawer?.classList.contains('open'))return;
 drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');clock.setAttribute('aria-expanded','false');
 window.Nav?.setRingVisible?.(true);window.Nav?.repaint?.();
}
clock.classList.add('clock-action');clock.setAttribute('role','button');clock.setAttribute('tabindex','0');
clock.setAttribute('aria-label','Open quick settings');clock.setAttribute('aria-expanded','false');
clock.dataset.nav='';clock.dataset.group='sysbar';clock.dataset.ringRadius='.45rem';clock._navActivate=open;
clock.addEventListener('click',e=>{e.preventDefault();open();});
clock.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
document.addEventListener('keydown',e=>{if(drawer?.classList.contains('open')&&e.key==='Escape'){e.preventDefault();close();}});
window.addEventListener('nav:button',e=>{if(drawer?.classList.contains('open')&&e.detail?.button==='b')close();});
window.State?.on?.(e=>{if(e?.type==='settings'&&drawer?.classList.contains('open'))refreshControls();});
timer=setInterval(renderTime,1000);renderTime();window.Nav?.repaint?.();
window.TimeDrawer={open,close,updateWeather};
})();
