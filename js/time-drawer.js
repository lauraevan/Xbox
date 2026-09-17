/* Xbox-style time/weather drawer opened from the top-right clock. */
(() => {
'use strict';

const clock = document.getElementById('clock');
if (!clock) return;

/* Used only when browser/device location is unavailable or denied. */
const DEFAULT_WEATHER = Object.freeze({ lat:46.7216, lon:-92.4594 });
const WALLPAPER_MODE_KEY = 'xbox.wallpaperLight';

let drawer = null;
let timer = null;
let weatherTimer = null;
let lastWeatherAt = 0;

const iconSvg = kind => {
  const icons = {
    clear:'<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="11"/><path d="M32 7v8M32 49v8M7 32h8M49 32h8M14.4 14.4l5.7 5.7M43.9 43.9l5.7 5.7M49.6 14.4l-5.7 5.7M20.1 43.9l-5.7 5.7"/></svg>',
    partly:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 27a12 12 0 1 1 22 6"/><path d="M18 48h27a9 9 0 0 0 0-18c-1 0-2 .1-3 .5A13 13 0 0 0 17.5 34 7 7 0 0 0 18 48Z"/><path d="M17 13l4 4M33 8v6M9 29h6"/></svg>',
    cloudy:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 48h31a10 10 0 0 0 0-20c-1.3 0-2.5.2-3.7.7A15 15 0 0 0 16 34.5 7.5 7.5 0 0 0 17 48Z"/></svg>',
    rain:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 38h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 26 7 7 0 0 0 17 38Z"/><path d="M20 47l-3 7M32 47l-3 7M44 47l-3 7"/></svg>',
    snow:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 37h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 25 7 7 0 0 0 17 37Z"/><path d="M21 48h.1M32 52h.1M43 47h.1M26 56h.1M48 55h.1"/></svg>',
    storm:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 36h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 24 7 7 0 0 0 17 36Z"/><path d="M34 40l-7 11h7l-4 8 12-14h-7l4-5"/></svg>',
    fog:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 33h31a9 9 0 0 0 0-18c-1.2 0-2.3.2-3.4.6A14 14 0 0 0 18 21 7 7 0 0 0 17 33Z"/><path d="M13 42h38M17 49h30M22 56h20"/></svg>'
  };
  return icons[kind] || icons.cloudy;
};

const wallpaperIcon = light => light
  ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.1A7.8 7.8 0 0 1 9.9 3.5 8.7 8.7 0 1 0 20.5 14.1Z"/></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.4"/><path d="M12 2.2v2.1M12 19.7v2.1M2.2 12h2.1M19.7 12h2.1M5.1 5.1l1.5 1.5M17.4 17.4l1.5 1.5M18.9 5.1l-1.5 1.5M6.6 17.4l-1.5 1.5"/></svg>';

function storedWallpaperLight(){
  try { return localStorage.getItem(WALLPAPER_MODE_KEY) === '1'; }
  catch { return false; }
}

function setWallpaperLight(light, persist = true){
  document.body.classList.toggle('wallpaper-light', !!light);
  if (persist){
    try { localStorage.setItem(WALLPAPER_MODE_KEY, light ? '1' : '0'); } catch {}
  }
  const btn = drawer?.querySelector('[data-wallpaper-toggle]');
  if (btn){
    btn.setAttribute('aria-pressed', light ? 'true' : 'false');
    btn.setAttribute('aria-label', light ? 'Dim wallpaper' : 'Brighten wallpaper');
    btn.innerHTML = wallpaperIcon(light);
  }
}

function weatherMeta(code){
  code = Number(code);
  if (code === 0) return ['Clear', 'clear'];
  if ([1,2].includes(code)) return ['Partly cloudy', 'partly'];
  if (code === 3) return ['Cloudy', 'cloudy'];
  if ([45,48].includes(code)) return ['Foggy', 'fog'];
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return ['Rain', 'rain'];
  if ([71,73,75,77,85,86].includes(code)) return ['Snow', 'snow'];
  if ([95,96,99].includes(code)) return ['Thunderstorms', 'storm'];
  return ['Cloudy', 'cloudy'];
}

function formatTimeParts(date = new Date()){
  const parts = new Intl.DateTimeFormat(undefined, {
    hour:'numeric', minute:'2-digit', hour12:true
  }).formatToParts(date);
  return {
    time:parts.filter(p => p.type === 'hour' || p.type === 'minute' || p.type === 'literal').map(p => p.value).join('').trim(),
    period:parts.find(p => p.type === 'dayPeriod')?.value || '',
    monthYear:new Intl.DateTimeFormat(undefined,{ month:'long', year:'numeric' }).format(date)
  };
}

function renderTime(){
  if (!drawer) return;
  const p = formatTimeParts();
  drawer.querySelector('[data-time-main]').textContent = p.time;
  drawer.querySelector('[data-time-period]').textContent = p.period;
  drawer.querySelector('[data-month-year]').textContent = p.monthYear;
}

function stat(label, key){
  return `<div class="time-weather-stat"><span>${label}</span><strong data-weather-${key}>—</strong></div>`;
}

function makeDrawer(){
  const root = document.createElement('aside');
  root.className = 'time-drawer';
  root.setAttribute('aria-hidden','true');
  root.innerHTML = `
    <div class="time-drawer-scrim" data-time-close></div>
    <section class="time-drawer-panel" role="dialog" aria-modal="true" aria-label="Time and weather">
      <header class="time-drawer-head">
        <button class="time-wallpaper-toggle" type="button" data-wallpaper-toggle aria-pressed="false" aria-label="Brighten wallpaper">${wallpaperIcon(false)}</button>
        <div class="time-drawer-eyebrow">Time</div>
        <div>
          <span class="time-drawer-clock" data-time-main>--:--</span>
          <span class="time-drawer-period" data-time-period></span>
        </div>
        <div class="time-drawer-month" data-month-year></div>
      </header>
      <div class="time-drawer-body">
        <div class="time-drawer-eyebrow">Weather</div>
        <div class="time-weather">
          <div class="time-weather-icon" data-weather-icon>${iconSvg('cloudy')}</div>
          <div>
            <div class="time-weather-temp" data-weather-temp>--°</div>
            <div class="time-weather-condition" data-weather-condition>Loading weather…</div>
          </div>
        </div>
        <div class="time-weather-status" data-weather-status>Getting current conditions…</div>
        <div class="time-weather-stats" aria-label="Current weather details">
          ${stat('Feels like','feels')}
          ${stat('Humidity','humidity')}
          ${stat('Wind','wind')}
          ${stat('Precipitation','precip')}
          ${stat('High / Low','range')}
          ${stat('Sunrise / Sunset','sun')}
        </div>
      </div>
      <footer class="time-drawer-foot">
        <div class="time-drawer-hint">Press B or Esc to close</div>
      </footer>
    </section>`;
  document.body.append(root);
  root.querySelector('[data-time-close]').addEventListener('click', close);
  root.querySelector('[data-wallpaper-toggle]').addEventListener('click', e => {
    e.stopPropagation();
    setWallpaperLight(!document.body.classList.contains('wallpaper-light'));
  });
  setWallpaperLight(document.body.classList.contains('wallpaper-light'), false);
  return root;
}

function getCoords(){
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location unavailable'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat:pos.coords.latitude, lon:pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy:false, timeout:6500, maximumAge:10 * 60 * 1000 }
    );
  });
}

async function fetchWeather(coords){
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(coords.lat));
  url.searchParams.set('longitude', String(coords.lon));
  url.searchParams.set('current', [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'weather_code',
    'wind_speed_10m',
    'wind_direction_10m',
    'precipitation',
    'cloud_cover'
  ].join(','));
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,sunrise,sunset');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');

  const res = await fetch(url, { cache:'no-store' });
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  const data = await res.json();
  const current = data?.current;
  if (!current || !Number.isFinite(Number(current.temperature_2m)))
    throw new Error('No current weather');
  return { current, daily:data?.daily || null };
}

function num(value, suffix = '', digits = 0){
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}${suffix}` : '—';
}

function compass(degrees){
  const n = Number(degrees);
  if (!Number.isFinite(n)) return '';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round((((n % 360) + 360) % 360) / 45) % 8];
}

function shortClock(value){
  if (!value || typeof value !== 'string') return '—';
  const m = value.match(/T(\d{2}):(\d{2})/);
  if (!m) return '—';
  let hour = Number(m[1]);
  const minute = m[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

function setStat(key, value){
  const el = drawer?.querySelector(`[data-weather-${key}]`);
  if (el) el.textContent = value;
}

function clearStats(){
  ['feels','humidity','wind','precip','range','sun'].forEach(key => setStat(key, '—'));
}

function paintWeather(payload, usingDefault){
  const { current, daily } = payload;
  const condition = drawer.querySelector('[data-weather-condition]');
  const temp = drawer.querySelector('[data-weather-temp]');
  const icon = drawer.querySelector('[data-weather-icon]');
  const status = drawer.querySelector('[data-weather-status]');
  const [label, kind] = weatherMeta(current.weather_code);

  temp.textContent = `${Math.round(Number(current.temperature_2m))}°`;
  condition.textContent = label;
  icon.innerHTML = iconSvg(kind);

  const windDir = compass(current.wind_direction_10m);
  const wind = num(current.wind_speed_10m, ' mph');
  setStat('feels', num(current.apparent_temperature, '°'));
  setStat('humidity', num(current.relative_humidity_2m, '%'));
  setStat('wind', wind === '—' ? '—' : `${wind}${windDir ? ` ${windDir}` : ''}`);
  setStat('precip', num(current.precipitation, ' in', 2));

  const hi = Number(daily?.temperature_2m_max?.[0]);
  const lo = Number(daily?.temperature_2m_min?.[0]);
  setStat('range', Number.isFinite(hi) && Number.isFinite(lo) ? `${Math.round(hi)}° / ${Math.round(lo)}°` : '—');

  const rise = shortClock(daily?.sunrise?.[0]);
  const set = shortClock(daily?.sunset?.[0]);
  setStat('sun', rise !== '—' && set !== '—' ? `${rise} / ${set}` : '—');

  const cloud = Number(current.cloud_cover);
  const cloudText = Number.isFinite(cloud) ? ` • ${Math.round(cloud)}% cloud cover` : '';
  status.textContent = `${usingDefault ? 'Default location' : 'Current location'}${cloudText}`;
  status.classList.toggle('default', usingDefault);
  lastWeatherAt = Date.now();
}

async function updateWeather(force = false){
  if (!drawer) return;
  const now = Date.now();
  if (!force && now - lastWeatherAt < 10 * 60 * 1000) return;

  const condition = drawer.querySelector('[data-weather-condition]');
  const temp = drawer.querySelector('[data-weather-temp]');
  const icon = drawer.querySelector('[data-weather-icon]');
  const status = drawer.querySelector('[data-weather-status]');

  condition.textContent = 'Loading weather…';
  temp.textContent = '--°';
  icon.innerHTML = iconSvg('cloudy');
  clearStats();
  status.classList.remove('default');
  status.textContent = 'Getting current conditions…';

  let coords = DEFAULT_WEATHER;
  let usingDefault = true;

  try {
    coords = await getCoords();
    usingDefault = false;
  } catch {
    /* Permission denied, unsupported browser, or timeout: use default weather. */
  }

  try {
    const payload = await fetchWeather(coords);
    paintWeather(payload, usingDefault);
  } catch {
    if (!usingDefault){
      try {
        const fallback = await fetchWeather(DEFAULT_WEATHER);
        paintWeather(fallback, true);
        return;
      } catch {}
    }

    /* No invented values. If live weather cannot be fetched, say so. */
    temp.textContent = '--°';
    condition.textContent = 'Weather unavailable';
    icon.innerHTML = iconSvg('cloudy');
    clearStats();
    status.textContent = 'No live weather data';
    status.classList.add('default');
  }
}

function open(){
  if (!drawer) drawer = makeDrawer();
  renderTime();
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
  clock.setAttribute('aria-expanded','true');
  window.Nav?.hideRing?.();
  void updateWeather(true);
}

function close(){
  if (!drawer?.classList.contains('open')) return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden','true');
  clock.setAttribute('aria-expanded','false');
  window.Nav?.setRingVisible?.(true);
  window.Nav?.repaint?.();
}

clock.classList.add('clock-action');
clock.setAttribute('role','button');
clock.setAttribute('tabindex','0');
clock.setAttribute('aria-label','Open time and weather');
clock.setAttribute('aria-expanded','false');
clock.dataset.nav = '';
clock.dataset.group = 'sysbar';
clock.dataset.ringRadius = '.45rem';
clock._navActivate = open;
clock.addEventListener('click', e => { e.preventDefault(); open(); });
clock.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); }
});

document.addEventListener('keydown', e => {
  if (!drawer?.classList.contains('open')) return;
  if (e.key === 'Escape'){
    e.preventDefault();
    close();
  }
});

window.addEventListener('nav:button', e => {
  if (drawer?.classList.contains('open') && e.detail?.button === 'b') close();
});

timer = setInterval(renderTime, 1000);
weatherTimer = setInterval(() => {
  if (drawer?.classList.contains('open')) void updateWeather();
}, 10 * 60 * 1000);

setWallpaperLight(storedWallpaperLight(), false);
renderTime();
window.Nav?.repaint?.();

window.TimeDrawer = { open, close, updateWeather, setWallpaperLight };
})();