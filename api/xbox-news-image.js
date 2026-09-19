const ALLOWED_HOSTS = [
  'news.xbox.com',
  'xbox.com',
  'www.xbox.com'
];

function allowedHost(hostname){
  const host = String(hostname || '').toLowerCase();
  return ALLOWED_HOSTS.includes(host)
    || host.endsWith('.xbox.com')
    || host.endsWith('.thesourcemediaassets.com');
}

export default async function handler(req, res){
  if (req.method !== 'GET'){
    res.status(405).json({ error:'GET required.' });
    return;
  }

  const raw = String(req.query?.url || '');
  let source;
  try {
    source = new URL(raw);
  } catch {
    res.status(400).json({ error:'Invalid image URL.' });
    return;
  }

  if (source.protocol !== 'https:' || !allowedHost(source.hostname)){
    res.status(403).json({ error:'Image host is not allowed.' });
    return;
  }

  try {
    const upstream = await fetch(source.toString(), {
      headers:{
        'user-agent':'Mozilla/5.0 (compatible; XboxDashboard/1.0)',
        'accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'referer':'https://news.xbox.com/'
      },
      redirect:'follow',
      cache:'no-store',
      signal:AbortSignal.timeout(10000)
    });

    if (!upstream.ok){
      res.status(upstream.status).json({ error:'Xbox image returned ' + upstream.status });
      return;
    }

    const type = upstream.headers.get('content-type') || 'image/jpeg';
    if (!type.toLowerCase().startsWith('image/')){
      res.status(415).json({ error:'Upstream did not return an image.' });
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).end(body);
  } catch (error){
    res.status(502).json({
      error:error?.message || 'Could not proxy Xbox image.'
    });
  }
}
