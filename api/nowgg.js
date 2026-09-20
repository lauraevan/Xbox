import { Readable } from 'node:stream';

const ORIGIN = 'https://nowgg.fun';

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
    if (key === 'path') continue;
    if (Array.isArray(value)) value.forEach(item => target.searchParams.append(key, String(item)));
    else if (value != null) target.searchParams.set(key, String(value));
  }
  return target;
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
      "const fix=u=>{if(typeof u!=='string')return u;if(u.startsWith('https://nowgg.fun'))return P+u.slice(17);if(u.startsWith('http://nowgg.fun'))return P+u.slice(16);if(u.startsWith('/')&&!u.startsWith('/nowgg/'))return P+u;return u;};",
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
  const headers = {
    'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
    'accept': req.headers.accept || '*/*',
    'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
    'referer': ORIGIN + '/'
  };

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
  res.setHeader('X-NowGG-Proxy', 'nowgg.fun');
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
