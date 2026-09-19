const SOURCE = 'https://news.xbox.com/en-us/feed/';

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; XboxDashboard/1.0)',
  'accept': 'application/rss+xml,application/xml,text/xml,text/html;q=0.8'
};

function decodeHtml(value = ''){
  return String(value)
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function xmlTag(block, tag){
  const pattern = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i');
  const match = block.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : '';
}

function mediaUrl(block){
  const media = block.match(/<(?:media:content|media:thumbnail)\b[^>]+url=["']([^"']+)["']/i);
  if (media?.[1]) return decodeHtml(media[1]);

  const image = block.match(/<img\b[^>]+src=["']([^"']+)["']/i);
  return image?.[1] ? decodeHtml(image[1]) : '';
}

function collectFeedItems(xml){
  const rows = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
    const block = match[1];
    const url = xmlTag(block, 'link');
    const title = xmlTag(block, 'title');
    if (!url || !title) continue;
    rows.push({
      url,
      title,
      image:mediaUrl(block),
      description:xmlTag(block, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      published:xmlTag(block, 'pubDate')
    });
    if (rows.length >= 8) break;
  }
  return rows;
}

function meta(html, key){
  const keyPattern = new RegExp("(?:property|name)=[\"']" + key + "[\"']", 'i');
  const contentPattern = /content=["']([^"']+)["']/i;

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)){
    const tag = match[0];
    if (!keyPattern.test(tag)) continue;
    const content = tag.match(contentPattern);
    if (content?.[1]) return decodeHtml(content[1]);
  }
  return '';
}

async function enrichStory(story){
  let parsed;
  try { parsed = new URL(story.url); }
  catch { return story.image ? story : null; }

  if (parsed.hostname !== 'news.xbox.com') return story.image ? story : null;

  try {
    const response = await fetch(story.url, {
      headers:HEADERS,
      cache:'no-store',
      signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('article ' + response.status);

    const html = await response.text();
    const title = meta(html, 'og:title')
      .replace(/\s*-\s*XBOX Wire\s*$/i, '')
      .trim();

    return {
      title:title || story.title,
      image:meta(html, 'og:image') || story.image,
      description:meta(html, 'og:description') || story.description,
      published:meta(html, 'article:published_time') || story.published,
      url:story.url
    };
  } catch {
    return story.image ? story : null;
  }
}

export default async function handler(req, res){
  if (req.method !== 'GET'){
    res.status(405).json({ error:'GET required.' });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');

  try {
    const feed = await fetch(SOURCE, {
      headers:HEADERS,
      cache:'no-store',
      signal:AbortSignal.timeout(8000)
    });
    if (!feed.ok) throw new Error('Xbox Wire feed returned ' + feed.status);

    const items = collectFeedItems(await feed.text());
    const settled = await Promise.allSettled(items.slice(0, 6).map(enrichStory));
    const stories = settled
      .filter(row => row.status === 'fulfilled' && row.value?.title && row.value?.image && row.value?.url)
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
