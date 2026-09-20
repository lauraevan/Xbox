const ORIGIN = 'https://nowgg.fun';

function cleanPath(value){
  const raw = Array.isArray(value) ? value[0] : String(value || '');
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  const path = '/' + decoded.replace(/^\\/+/, '');
  if (path.includes('\\0')) throw new Error('Invalid path');
  return path;
}

function targetUrl(req){
  const target = new URL(cleanPath(req.query?.path), ORIGIN);

  for (const [key, value] of Object.entries(req.query || {})){
    if (key === 'path') continue;
    if (Array.isArray(value)){
      for (const item of value) target.searchParams.append(key, String(item));
    } else if (value != null){
      target.searchParams.set(key, String(value));
    }
  }

  if (target.origin !== ORIGIN) throw new Error('Blocked origin');
  return target;
}

function rewriteText(input, contentType){
  let text = String(input || '');

  text = text
    .replaceAll('https://nowgg.fun', '/nowgg')
    .replaceAll('http://nowgg.fun', '/nowgg')
    .replace(/((?:src|href|action|poster)=["'])\\/(?!\\/|nowgg(?:\\/|["']))/gi, '$1/nowgg/')
    .replace(/url\\((['"]?)\\/(?!\\/|nowgg\\/)/gi, 'url($1/nowgg/');

  if (contentType.includes('text/html')){
    const bridge = [
      '<script>',
      '(()=>{',
      "const P='/nowgg';",
      "const fix=u=>{if(typeof u!=='string')return u;if(u.startsWith('https://nowgg.fun'))return P+u.slice('https://nowgg.fun'.length);if(u.startsWith('http://nowgg.fun'))return P+u.slice('http://nowgg.fun'.length);if(u.startsWith('/')&&!u.startsWith('/nowgg/'))return P+u;return u;};",
      'const nativeFetch=window.fetch.bind(window);',
      "window.fetch=(input,init)=>{if(typeof input==='string')return nativeFetch(fix(input),init);if(input instanceof Request){const next=fix(input.url);if(next!==input.url)input=new Request(next,input);}return nativeFetch(input,init);};",
      'const nativeOpen=XMLHttpRequest.prototype.open;',
      'XMLHttpRequest.prototype.open=function(method,url,...rest){return nativeOpen.call(this,method,fix(url),...rest);};',
      '})();',
      '<\\/script>'
    ].join('');

    if (/<head[\\s>]/i.test(text)){
      text = text.replace(/<head([^>]*)>/i, '<head$1>' + bridge);
    } else {
      text = bridge + text;
    }
  }

  return text;
}

function copyCookies(upstream, res){
  const getSetCookie = upstream.headers.getSetCookie;
  if (typeof getSetCookie !== 'function') return;

  const cookies = getSetCookie.call(upstream.headers);
  if (!Array.isArray(cookies) || !cookies.length) return;

  res.setHeader('Set-Cookie', cookies.map(cookie =>
    cookie
      .replace(/;\\s*Domain=[^;]+/ig, '')
      .replace(/;\\s*Path=\\/(?=;|$)/ig, '; Path=/nowgg/')
  ));
}

export default async function handler(req, res){
  let target;
  try {
    target = targetUrl(req);
  } catch {
    res.status(400).send('Invalid nowgg.fun path');
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
  if (req.headers.range) headers.range = req.headers.range;

  let body;
  if (!['GET', 'HEAD'].includes(method) && req.body != null){
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string'){
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: controller.signal
    });
  } catch (error){
    clearTimeout(timer);
    res.status(502).send('nowgg.fun proxy error: ' + (error?.message || 'request failed'));
    return;
  }
  clearTimeout(timer);

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

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-NowGG-Proxy', 'nowgg.fun');
  res.setHeader(
    'Cache-Control',
    /text\\/html|application\\/json/i.test(contentType)
      ? 'no-store'
      : 'public, s-maxage=3600, stale-while-revalidate=86400'
  );

  const contentRange = upstream.headers.get('content-range');
  const acceptRanges = upstream.headers.get('accept-ranges');
  if (contentRange) res.setHeader('Content-Range', contentRange);
  if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

  copyCookies(upstream, res);

  if (method === 'HEAD' || !upstream.body){
    res.end();
    return;
  }

  if (/text\\/html|text\\/css|javascript|application\\/json/i.test(contentType)){
    res.send(rewriteText(await upstream.text(), contentType));
    return;
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.send(bytes);
}
