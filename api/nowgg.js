import { Readable } from 'node:stream';

const ORIGIN = 'https://nowgg.fun';

const CURATED_GAMES = [
  {
    game_key:'nowgg:stumble-guys',
    name:'Stumble Guys',
    description:'Instant cloud play.',
    image:'/assets/nowgg/stumble-guys.jpg',
    cover:'/assets/nowgg/stumble-guys.jpg',
    tags:['Cloud','Multiplayer','Party'],
    nowgg:true,
    launch_url:'/nowgg/apps/a/10011/b.html'
  },
  {
    game_key:'nowgg:call-of-duty',
    name:'Call of Duty',
    description:'Instant cloud play.',
    image:'/assets/nowgg/call-of-duty.jpg',
    cover:'/assets/nowgg/call-of-duty.jpg',
    tags:['Cloud','Action','Shooter'],
    nowgg:true,
    launch_url:'/nowgg/apps/a/10008/b.html'
  },
  {
    game_key:'nowgg:geometry-dash',
    name:'Geometry Dash',
    description:'Instant cloud play.',
    image:'/assets/nowgg/geometry-dash.jpg',
    cover:'/assets/nowgg/geometry-dash.jpg',
    tags:['Cloud','Arcade','Rhythm'],
    nowgg:true,
    launch_url:'/nowgg/apps/robtop-games/1400/geometry-dash.html'
  },
  {
    game_key:'nowgg:rocket-league',
    name:'Rocket League',
    description:'Instant cloud play.',
    image:'/assets/nowgg/rocket-league.jpg',
    cover:'/assets/nowgg/rocket-league.jpg',
    tags:['Cloud','Sports','Racing'],
    nowgg:true,
    launch_url:'/nowgg/apps/psyonix-studios/4656/rocket-league.html'
  }
];

function cleanPath(value){
  const raw = Array.isArray(value) ? value[0] : String(value || '');
  const decoded = (() => {
    try { return decodeURIComponent(raw); } catch { return raw; }
  })();
  const path = '/' + decoded.replace(/^\/+/, '');
  if (path.includes('\0')) throw new Error('Invalid path');
  return path;
}

function proxyURL(req){
  const target = new URL(cleanPath(req.query?.path), ORIGIN);
  for (const [key, value] of Object.entries(req.query || {})){
    if (key === 'path' || key === 'catalog') continue;
    if (Array.isArray(value)) value.forEach(item => target.searchParams.append(key, String(item)));
    else if (value != null) target.searchParams.set(key, String(value));
  }
  return target;
}

function decodeHtml(value=''){
  return String(value)
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
}

function stripTags(value=''){
  return decodeHtml(String(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
}

function attr(attrs, name){
  const match = String(attrs || '').match(new RegExp('(?:^|\\\\s)' + name + '=["\\\\\\']([^"\\\\\\']+)["\\\\\\']','i'));
  return match?.[1] ? decodeHtml(match[1].trim()) : '';
}

function toInternalUrl(value){
  if (!value) return null;
  let url;
  try { url = new URL(value, ORIGIN); } catch { return null; }
  if (url.origin !== ORIGIN) return null;
  return url;
}

function proxied(value){
  const url = toInternalUrl(value);
  return url ? '/nowgg' + url.pathname + url.search + url.hash : '';
}

function appKey(value){
  return String(value || '')
    .toLowerCase()
    .replace(/^https?:\/\/nowgg\.fun/i,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,72) || 'cloud-arcade';
}

function isAppPath(url){
  if (!url || url.origin !== ORIGIN) return false;
  const p = url.pathname.toLowerCase();
  if (p === '/' || !p) return false;
  if (/\.(?:png|jpe?g|webp|svg|gif|css|js|json|woff2?|ttf|ico|mp4|webm)$/i.test(p)) return false;
  if (/^\/(?:img|images|icons|assets|css|js|fonts|api)(?:\/|$)/i.test(p)) return false;
  return true;
}

function catalogFromHtml(html){
  const games = [];
  const seen = new Set();

  for (const match of String(html || '').matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)){
    const attrs = (match[1] || '') + ' ' + (match[3] || '');
    const href = decodeHtml(match[2]);
    const url = toInternalUrl(href);
    if (!isAppPath(url)) continue;

    const body = match[4] || '';
    const imageMatch = body.match(/<img\b([^>]*)>/i);
    const imageAttrs = imageMatch?.[1] || '';
    const image = attr(imageAttrs,'src') || attr(imageAttrs,'data-src');
    const rawName =
      attr(attrs,'data-name') ||
      attr(attrs,'title') ||
      attr(imageAttrs,'alt') ||
      stripTags(body);

    const name = String(rawName || '')
      .replace(/\b(?:play|open|launch)\b/gi,' ')
      .replace(/\s+/g,' ')
      .trim();

    if (!name || /^(?:image|app|game|open|play)$/i.test(name)) continue;

    const launchUrl = proxied(url.toString());
    const key = 'nowgg:' + appKey(url.pathname + url.search);
    if (!launchUrl || seen.has(key)) continue;
    seen.add(key);

    games.push({
      game_key:key,
      name,
      description:'Play instantly through Stratus Cloud.',
      image:proxied(image) || '/nowgg/img/landscape.png',
      cover:proxied(image) || '/nowgg/img/landscape.png',
      tags:['Cloud','Instant play'],
      nowgg:true,
      launch_url:launchUrl
    });

    if (games.length >= 40) break;
  }

  if (!games.length){
    games.push({
      game_key:'nowgg:cloud-arcade',
      name:'Cloud Arcade',
      description:'More instant-play cloud games.',
      image:'/nowgg/img/landscape.png',
      cover:'/nowgg/img/landscape.png',
      tags:['Cloud','Instant play'],
      nowgg:true,
      launch_url:'/nowgg/'
    });
  }

  return games;
}

async function fetchRoot(headers){
  const response = await fetch(ORIGIN + '/', {
    headers,
    cache:'no-store',
    redirect:'follow',
    signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('nowgg.fun returned ' + response.status);
  return response;
}

function rewriteText(text, type){
  let out = String(text || '');

  out = out
    .replaceAll('https://nowgg.fun', '/nowgg')
    .replaceAll('http://nowgg.fun', '/nowgg')
    .replace(/((?:src|href|action|poster)=["'])\/(?!\/|nowgg(?:\/|["']))/gi, '$1/nowgg/')
    .replace(/url\((['"]?)\/(?!\/|nowgg\/)/gi, 'url($1/nowgg/');

  if (type.includes('text/html')){
    const bridge = [
      '<script>',
      '(()=>{',
      "const P='/nowgg';",
      "const fix=u=>{if(typeof u!=='string')return u;if(u.startsWith('https://nowgg.fun'))return P+u.slice('https://nowgg.fun'.length);if(u.startsWith('http://nowgg.fun'))return P+u.slice('http://nowgg.fun'.length);if(u.startsWith('/')&&!u.startsWith('/nowgg/'))return P+u;return u;};",
      'const nf=window.fetch.bind(window);',
      "window.fetch=(input,init)=>{if(typeof input==='string')return nf(fix(input),init);if(input instanceof Request){const next=fix(input.url);if(next!==input.url)input=new Request(next,input);}return nf(input,init);};",
      'const no=XMLHttpRequest.prototype.open;',
      'XMLHttpRequest.prototype.open=function(method,url,...rest){return no.call(this,method,fix(url),...rest);};',
      'const nb=navigator.sendBeacon?.bind(navigator);if(nb)navigator.sendBeacon=(url,data)=>nb(fix(url),data);',
      '})();',
      '<\\/script>'
    ].join('');

    if (/<head[\s>]/i.test(out)) out = out.replace(/<head([^>]*)>/i, '<head$1>'+bridge);
    else out = bridge + out;
  }

  return out;
}

function forwardCookies(upstream, res){
  const list = upstream.headers.getSetCookie?.() || [];
  if (!list.length) return;
  const safe = list.map(cookie =>
    cookie
      .replace(/;\s*Domain=[^;]+/ig, '')
      .replace(/;\s*Path=\/(?=;|$)/ig, '; Path=/nowgg/')
  );
  res.setHeader('Set-Cookie', safe);
}

export default async function handler(req, res){
  const headers = {
    'user-agent':req.headers['user-agent'] || 'Mozilla/5.0',
    'accept':req.headers.accept || '*/*',
    'accept-language':req.headers['accept-language'] || 'en-US,en;q=0.9',
    'referer':ORIGIN + '/'
  };

  if (String(req.query?.catalog || '') === '1'){
    res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=86400');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.status(200).json(CURATED_GAMES);
    return;
  }

  let target;
  try { target = proxyURL(req); }
  catch {
    res.status(400).send('Bad nowgg.fun path');
    return;
  }

  if (target.origin !== ORIGIN){
    res.status(403).send('Only https://nowgg.fun is allowed');
    return;
  }

  const method = String(req.method || 'GET').toUpperCase();
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

  let body;
  if (!['GET','HEAD'].includes(method) && req.body != null){
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') body = req.body;
    else body = JSON.stringify(req.body);
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect:'manual',
      signal:AbortSignal.timeout(25000)
    });
  } catch (error){
    res.status(502).send('nowgg.fun proxy error: ' + (error?.message || 'request failed'));
    return;
  }

  if (upstream.status >= 300 && upstream.status < 400){
    const location = upstream.headers.get('location');
    if (!location){
      res.status(upstream.status).end();
      return;
    }
    let next;
    try { next = new URL(location, target); }
    catch {
      res.status(502).send('Invalid nowgg.fun redirect');
      return;
    }
    if (next.origin !== ORIGIN){
      res.status(502).send('Blocked redirect outside https://nowgg.fun');
      return;
    }
    res.setHeader('Location', '/nowgg' + next.pathname + next.search + next.hash);
    res.status(upstream.status).end();
    return;
  }

  const type = upstream.headers.get('content-type') || 'application/octet-stream';
  res.status(upstream.status);
  res.setHeader('Content-Type', type);
  res.setHeader('X-NowGG-Proxy','nowgg.fun');
  res.setHeader('Cache-Control',
    /text\/html|application\/json/i.test(type)
      ? 'no-store'
      : 'public, s-maxage=3600, stale-while-revalidate=86400'
  );
  forwardCookies(upstream, res);

  if (method === 'HEAD' || !upstream.body){
    res.end();
    return;
  }

  if (/text\/html|text\/css|javascript|application\/json/i.test(type)){
    res.send(rewriteText(await upstream.text(), type));
    return;
  }

  Readable.fromWeb(upstream.body).pipe(res);
}
