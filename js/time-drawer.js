/* Xbox-style time/weather drawer opened from the top-right clock. */
(() => {
'use strict';

const clock = document.getElementById('clock');
if (!clock) return;

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

function makeDrawer(){
  const root = document.createElement('aside');
  root.className = 'time-drawer';
  root.setAttribute('aria-hidden','true');
  root.innerHTML = `
    <div class="time-drawer-scrim" data-time-close></div>
    <section class="time-drawer-panel" role="dialog" aria-modal="true" aria-label="Time and weather">
      <div class="time-drawer-eyebrow">Time</div>
      <div>
        <span class="time-drawer-clock" data-time-main>--:--</span>
        <span class="time-drawer-period" data-time-period></span>
      </div>
      <div class="time-drawer-month" data-month-year></div>
      <div class="time-drawer-rule"></div>
      <div class="time-drawer-eyebrow">Weather</div>
      <div class="time-weather" style="margin-top:1.4rem">
        <div class="time-weather-icon" data-weather-icon>${iconSvg('cloudy')}</div>
        <div>
          <div class="time-weather-temp" data-weather-temp>--°</div>
          <div class="time-weather-condition" data-weather-condition>Loading weather…</div>
        </div>
      </div>
      <div class="time-weather-status" data-weather-status>Uses your device location for current conditions.</div>
      <div class="time-drawer-spacer"></div>
      <div class="time-drawer-hint">Press B or Esc to close</div>
    </section>`;
  document.body.append(root);
  root.querySelector('[data-time-close]').addEventListener('click', close);
  return root;
}

function getCoords(){
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is unavailable'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat:pos.coords.latitude, lon:pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy:false, timeout:8000, maximumAge:10 * 60 * 1000 }
    );
  });
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
  status.textContent = 'Getting current conditions…';

  try {
    const { lat, lon } = await getCoords();
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'temperature_2m,weather_code');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '1');

    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(`Weather ${res.status}`);
    const data = await res.json();
    const current = data?.current;
    if (!current || !Number.isFinite(Number(current.temperature_2m))) throw new Error('No current weather');

    const [label, kind] = weatherMeta(current.weather_code);
    temp.textContent = `${Math.round(Number(current.temperature_2m))}°`;
    condition.textContent = label;
    icon.innerHTML = iconSvg(kind);
    status.textContent = 'Current conditions';
    lastWeatherAt = Date.now();
  } catch (err){
    temp.textContent = '--°';
    condition.textContent = 'Weather unavailable';
    status.textContent = err?.code === 1
      ? 'Allow location access to show local weather.'
      : 'Could not load current conditions.';
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

renderTime();
window.Nav?.repaint?.();

window.TimeDrawer = { open, close, updateWeather };
})();
