/* Weather + Xbox Wire refinement pass.
   Keeps the existing clock trigger and live current-weather updater, then
   upgrades the drawer with a compact forecast and live Xbox news at the bottom. */
(() => {
'use strict';

const FEED='https://news.xbox.com/en-us/feed/';
let patched=false;
let forecastStamp=0;
let newsStamp=0;

const weatherMeta=code=>{
  code=Number(code);
  if(code===0) return ['Clear','clear'];
  if([1,2].includes(code)) return ['Partly cloudy','partly'];
  if(code===3) return ['Cloudy','cloudy'];
  if([45,48].includes(code)) return ['Foggy','fog'];
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return ['Rain','rain'];
  if([71,73,75,77,85,86].includes(code)) return ['Snow','snow'];
  if([95,96,99].includes(code)) return ['Storms','storm'];
  return ['Cloudy','cloudy'];
};

const icon=kind=>{
  const icons={
    clear:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="10"/><path d="M32 7v8M32 49v8M7 32h8M49 32h8M14 14l6 6M44 44l6 6M50 14l-6 6M20 44l-6 6"/></svg>',
    partly:'<svg viewBox="0 0 64 64"><path d="M22 27a12 12 0 1 1 21 7"/><path d="M18 49h28a9 9 0 0 0 0-18c-1 0-2 .1-3 .5A13 13 0 0 0 18 35a7 7 0 0 0 0 14Z"/></svg>',
    cloudy:'<svg viewBox="0 0 64 64"><path d="M17 48h31a10 10 0 0 0 0-20c-1 0-2 .2-4 .7A15 15 0 0 0 16 35a8 8 0 0 0 1 13Z"/></svg>',
    rain:'<svg viewBox="0 0 64 64"><path d="M17 38h31a9 9 0 0 0 0-18c-1 0-2 .2-3 .6A14 14 0 0 0 18 26a7 7 0 0 0-1 12Z"/><path d="M21 47l-3 7M33 47l-3 7M45 47l-3 7"/></svg>',
    snow:'<svg viewBox="0 0 64 64"><path d="M17 38h31a9 9 0 0 0 0-18c-1 0-2 .2-3 .6A14 14 0 0 0 18 26a7 7 0 0 0-1 12Z"/><path d="M22 48h.1M32 53h.1M43 48h.1M27 57h.1"/></svg>',
    storm:'<svg viewBox="0 0 64 64"><path d="M17 36h31a9 9 0 0 0 0-18c-1 0-2 .2-3 .6A14 14 0 0 0 18 24a7 7 0 0 0-1 12Z"/><path d="M34 40l-7 11h7l-4 8 12-14h-7l4-5"/></svg>',
    fog:'<svg viewBox="0 0 64 64"><path d="M17 33h31a9 9 0 0 0 0-18c-1 0-2 .2-3 .6A14 14 0 0 0 18 21a7 7 0 0 0-1 12Z"/><path d="M13 42h38M17 49h30M22 56h20"/></svg>'
  };
  return icons[kind]||icons.cloudy;
};

function getCoords(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error('No geolocation'));
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),
      reject,
      {enableHighAccuracy:false,timeout:5000,maximumAge:10*60*1000}
    );
  });
}

async function fetchForecast(){
  const coords=await getCoords();
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude',coords.lat);
  url.searchParams.set('longitude',coords.lon);
  url.searchParams.set('daily','weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('temperature_unit','fahrenheit');
  url.searchParams.set('timezone','auto');
  url.searchParams.set('forecast_days','4');
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok) throw new Error('Forecast unavailable');
  return res.json();
}

function dayName(value,index){
  if(index===0) return 'Today';
  if(index===1) return 'Tomorrow';
  const d=new Date(value+'T12:00:00');
  return new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(d);
}

function renderForecast(data){
  const host=document.querySelector('[data-weather-forecast-row]');
  if(!host) return;
  const d=data?.daily;
  host.innerHTML='';
  (d?.time||[]).slice(0,4).forEach((date,i)=>{
    const [,kind]=weatherMeta(d.weather_code?.[i]);
    const hi=Number(d.temperature_2m_max?.[i]);
    const lo=Number(d.temperature_2m_min?.[i]);
    const rain=Number(d.precipitation_probability_max?.[i]);
    const card=document.createElement('div');
    card.className='weather-day';
    card.innerHTML='<strong>'+dayName(date,i)+'</strong>'+
      '<span class="weather-day-icon">'+icon(kind)+'</span>'+
      '<span class="weather-day-temp">'+(Number.isFinite(hi)?Math.round(hi)+'°':'—')+' <i>'+(Number.isFinite(lo)?Math.round(lo)+'°':'—')+'</i></span>'+
      '<small>'+(Number.isFinite(rain)?Math.round(rain)+'% rain':'Forecast')+'</small>';
    host.append(card);
  });
}

async function updateForecast(force=false){
  if(!force && Date.now()-forecastStamp<10*60*1000) return;
  const host=document.querySelector('[data-weather-forecast-row]');
  if(!host) return;
  try{
    renderForecast(await fetchForecast());
    forecastStamp=Date.now();
  }catch{
    host.innerHTML='<div class="weather-forecast-unavailable">Forecast needs location access</div>';
  }
}

function stripHtml(value=''){
  const doc=new DOMParser().parseFromString(String(value),'text/html');
  return (doc.body.textContent||'').replace(/\s+/g,' ').trim();
}

function articleImage(item){
  if(item?.thumbnail) return item.thumbnail;
  if(item?.enclosure?.link) return item.enclosure.link;
  if(item?.enclosure?.url) return item.enclosure.url;
  const html=String(item?.content||item?.description||'');
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]||'';
}

function age(value){
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return 'Xbox Wire';
  const h=Math.max(1,Math.round((Date.now()-d.getTime())/36e5));
  if(h<24) return h+'h ago';
  const days=Math.round(h/24);
  return days===1?'Yesterday':days+'d ago';
}

async function fetchNews(){
  const api='https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(FEED);
  const res=await fetch(api,{cache:'no-store'});
  if(!res.ok) throw new Error('Xbox Wire unavailable');
  const data=await res.json();
  if(data?.status!=='ok'||!Array.isArray(data?.items)) throw new Error('Xbox Wire unavailable');
  return data.items.slice(0,4);
}

function renderNews(items){
  const host=document.querySelector('[data-xbox-news-list]');
  if(!host) return;
  host.innerHTML='';
  items.forEach(item=>{
    const a=document.createElement('a');
    a.className='xbox-news-card';
    a.href=item.link||'https://news.xbox.com/en-us/recent-news/';
    a.target='_blank';
    a.rel='noopener noreferrer';

    const img=articleImage(item);
    const title=stripHtml(item.title||'Xbox Wire');
    const cat=Array.isArray(item.categories)&&item.categories[0]?item.categories[0]:'Xbox Wire';

    a.innerHTML='<span class="xbox-news-art">'+
      (img?'<img src="'+img+'" alt="" loading="lazy" decoding="async">':'<span class="xbox-news-placeholder">XBOX</span>')+
      '</span><span class="xbox-news-copy"><small>'+cat+' · '+age(item.pubDate)+'</small><strong>'+title+'</strong></span>';
    host.append(a);
  });
}

async function updateNews(force=false){
  if(!force && Date.now()-newsStamp<15*60*1000) return;
  const host=document.querySelector('[data-xbox-news-list]');
  if(!host) return;
  try{
    renderNews(await fetchNews());
    newsStamp=Date.now();
  }catch{
    host.innerHTML='<a class="xbox-news-fallback" href="https://news.xbox.com/en-us/recent-news/" target="_blank" rel="noopener noreferrer"><span><strong>Xbox Wire</strong><small>Live headlines unavailable</small></span><b>Open news ›</b></a>';
  }
}

function patchDrawer(drawer){
  if(patched||!drawer) return;
  patched=true;

  const head=drawer.querySelector('.time-drawer-head');
  const body=drawer.querySelector('.time-drawer-body');
  if(!head||!body) return;

  head.classList.add('weather-news-head');

  const weather=body.querySelector('.time-weather');
  const status=body.querySelector('.time-weather-status');
  const stats=body.querySelector('.time-weather-stats');

  if(weather){
    const hero=document.createElement('section');
    hero.className='weather-news-hero';
    hero.innerHTML='<div class="weather-news-hero-label">Current weather</div>';
    hero.append(weather);
    if(status) hero.append(status);
    body.insertBefore(hero,body.firstChild);
  }

  if(stats){
    const details=document.createElement('section');
    details.className='weather-news-details';
    details.innerHTML='<h3>Weather details</h3>';
    details.append(stats);
    body.insertBefore(details,stats.nextSibling);
  }

  const forecast=document.createElement('section');
  forecast.className='weather-news-forecast';
  forecast.innerHTML='<h3>Forecast</h3><div class="weather-forecast-row" data-weather-forecast-row><div class="weather-forecast-unavailable">Loading forecast…</div></div>';
  if(stats?.parentElement) stats.parentElement.insertAdjacentElement('beforebegin',forecast);
  else body.append(forecast);

  const news=document.createElement('section');
  news.className='xbox-news-section';
  news.innerHTML='<div class="xbox-news-title"><div><span>Xbox Wire</span><h3>Latest Xbox news</h3></div><a href="https://news.xbox.com/en-us/recent-news/" target="_blank" rel="noopener noreferrer">View all</a></div><div class="xbox-news-list" data-xbox-news-list><div class="xbox-news-loading">Loading Xbox Wire…</div></div>';
  body.append(news);

  updateForecast(true);
  updateNews(true);
}

function observeDrawer(){
  const existing=document.querySelector('.time-drawer');
  if(existing) patchDrawer(existing);

  new MutationObserver(muts=>{
    for(const m of muts){
      for(const n of m.addedNodes){
        if(!(n instanceof Element)) continue;
        const drawer=n.matches?.('.time-drawer')?n:n.querySelector?.('.time-drawer');
        if(drawer) patchDrawer(drawer);
      }
    }
  }).observe(document.body,{childList:true,subtree:true});

  new MutationObserver(()=>{
    const drawer=document.querySelector('.time-drawer');
    if(drawer?.classList.contains('open')){
      updateForecast();
      updateNews();
    }
  }).observe(document.body,{attributes:true,subtree:true,attributeFilter:['class']});
}

observeDrawer();
window.WeatherNewsPass={updateForecast,updateNews};
})();