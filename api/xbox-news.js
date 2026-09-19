const SOURCE = 'https://news.xbox.com/en-us/recent-news/';

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; XboxDashboard/1.0)',
  'accept': 'text/html,application/xhtml+xml'
};

function decodeHtml(value = ''){
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function meta(html, key){
  const keyPattern = new RegExp("(?:property|name)=[\"']" + key + "[\"']", 'i');
  const contentPattern = /content=["']([^"']+)["']/i;

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)){
    const tag = match[0];
    if (!keyPattern.test(tag)) continue;
    const content = tag.match(contentPattern);
    if (content?.[1]) return decodeHtml(content[1].trim());
  }
  return '';
}

function collectArticleUrls(html){
  const out = [];
  const seen = new Set();

  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)){
    let url;
    try { url = new URL(match[1], SOURCE); }
    catch { continue; }

    if (url.hostname !== 'news.xbox.com') continue;
    if (!/^\/en-us\/20\d{2}\/\d{2}\/\d{2}\/[a-z0-9][^?#]*\/?$/i.test(url.pathname)) continue;

    url.hash = '';
    url.search = '';
    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= 8) break;
  }

  return out;
}

async function loadStory(url){
  const response = await fetch(url, {
    headers:HEADERS,
    cache:'no-store',
    signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Xbox Wire article returned ' + response.status);

  const html = await response.text();
  const title = meta(html, 'og:title')
    .replace(/\s*-\s*XBOX Wire\s*$/i, '')
    .trim();
  const image = meta(html, 'og:image');
  const description = meta(html, 'og:description');
  const published = meta(html, 'article:published_time');

  if (!title || !image) return null;
  return { title, image, description, published, url };
}

export default async function handler(req, res){
  if (req.method !== 'GET'){
    res.status(405).json({ error:'GET required.' });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');

  try {
    const page = await fetch(SOURCE, {
      headers:HEADERS,
      cache:'no-store',
      signal:AbortSignal.timeout(8000)
    });
    if (!page.ok) throw new Error('Xbox Wire returned ' + page.status);

    const urls = collectArticleUrls(await page.text());
    const settled = await Promise.allSettled(urls.slice(0, 6).map(loadStory));
    const stories = settled
      .filter(row => row.status === 'fulfilled' && row.value)
      .map(row => row.value)
      .slice(0, 3);

    if (!stories.length) throw new Error('No Xbox Wire stories could be parsed.');

    res.status(200).json({
      source:'Xbox Wire',
      updatedAt:new Date().toISOString(),
      stories
    });
  } catch (error){
    res.status(502).json({
      error:error?.message || 'Could not load Xbox Wire.'
    });
  }
}
