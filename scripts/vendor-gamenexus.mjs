import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT = path.resolve('assets/game-details');
const games = [
  { id: 141503, slug: 'forza-horizon-5', expected: 'Forza Horizon 5' },
  { id: 1020, slug: 'grand-theft-auto-v', expected: 'Grand Theft Auto V' },
  { id: 115289, slug: 'hollow-knight-silksong', expected: 'Hollow Knight: Silksong' },
  { id: 119133, slug: 'elden-ring', expected: 'Elden Ring' },
  { id: 434, slug: 'red-dead-redemption', expected: 'Red Dead Redemption' },
  { id: 135400, slug: 'minecraft', expected: 'Minecraft' },
  { id: 1905, slug: 'fortnite', expected: 'Fortnite' },
  { id: 1877, slug: 'cyberpunk-2077', expected: 'Cyberpunk 2077' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function unwrapImage(src) {
  if (!src) return '';
  try {
    const u = new URL(src, 'https://gamenexus.geek-factory.xyz');
    const nested = u.searchParams.get('url');
    return nested || u.href;
  } catch {
    return src;
  }
}

function extFor(url) {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return ['.jpg','.jpeg','.png','.webp'].includes(ext) ? ext : '.jpg';
  } catch {
    return '.jpg';
  }
}

async function download(url, destination) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Xbox GameNexus vendor; local asset capture)',
      'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`Expected image, got ${type || 'unknown'} from ${url}`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length < 1024) throw new Error(`Image too small (${data.length} bytes): ${url}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, data);
}

function cleanList(values) {
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean).filter(v => v !== 'N/A'))];
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'en-US',
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
});

await context.addInitScript(() => {
  try { localStorage.setItem('gamenexus_lang', 'en'); } catch {}
});

const manifest = { version: 1, source: 'GameNexus / IGDB', games: {} };

for (const def of games) {
  const page = await context.newPage();
  const url = `https://gamenexus.geek-factory.xyz/games/${def.id}`;
  console.log(`\n=== ${def.expected} (${def.id}) ===`);

  let loaded = false;
  let lastError;
  for (let attempt = 1; attempt <= 4 && !loaded; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => {
        const text = document.body?.innerText || '';
        return /Screenshots|Captures d'écran/i.test(text) && document.querySelector('main h1');
      }, { timeout: 120000 });
      loaded = true;
    } catch (err) {
      lastError = err;
      console.warn(`Attempt ${attempt} failed for ${def.expected}: ${err.message}`);
      await sleep(3000 * attempt);
    }
  }
  if (!loaded) throw lastError || new Error(`Could not load ${def.expected}`);

  const data = await page.evaluate(() => {
    const norm = value => String(value || '').replace(/\s+/g, ' ').trim();

    const headingByText = (tag, wanted) =>
      [...document.querySelectorAll(tag)].find(el => norm(el.textContent).toLowerCase() === wanted.toLowerCase());

    const valueForHeading = label => {
      const h = headingByText('h3', label);
      if (!h) return { text: '', list: [] };
      const wrap = h.parentElement;
      const value = [...(wrap?.children || [])].find(el => el !== h) || h.nextElementSibling;
      if (!value) return { text: '', list: [] };
      const children = [...value.children].map(el => norm(el.textContent)).filter(Boolean);
      return {
        text: norm(value.textContent),
        list: children.length ? children : (norm(value.textContent) ? [norm(value.textContent)] : [])
      };
    };

    const bodyText = document.body?.innerText || '';
    const scoreMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*\/\s*100\s*\(Metascore\)/i);

    const title = norm(document.querySelector('main h1')?.textContent);
    const description =
      norm(document.querySelector('p.text-lg.text-muted-foreground.mb-8.max-w-3xl')?.textContent) ||
      '';

    const release = valueForHeading('Release Date');
    const developers = valueForHeading('Developers');
    const publishers = valueForHeading('Publishers');
    const genres = valueForHeading('Genres');
    const franchise = valueForHeading('Franchise');
    const gameModes = valueForHeading('Game Modes');
    const themes = valueForHeading('Themes');

    const platformTitles = [...document.querySelectorAll('main [title]')]
      .map(el => norm(el.getAttribute('title')))
      .filter(Boolean);

    const coverSrc = document.querySelector('main aside img')?.getAttribute('src') || '';

    const screenshotsHeading =
      headingByText('h2', 'Screenshots') ||
      [...document.querySelectorAll('h2')].find(el => /screenshots|captures d'écran/i.test(norm(el.textContent)));
    const screenshotWrap = screenshotsHeading?.parentElement;
    const screenshots = [...(screenshotWrap?.querySelectorAll('img') || [])]
      .map(img => img.getAttribute('src') || '')
      .filter(Boolean);

    const trailerSrc = document.querySelector('iframe[src*="youtube.com/embed/"]')?.getAttribute('src') || '';
    const trailerId = trailerSrc.match(/\/embed\/([^?&#/]+)/)?.[1] || '';

    return {
      title,
      description,
      rating: scoreMatch ? Number(scoreMatch[1]) : null,
      releaseDate: release.text,
      developers: developers.list,
      publishers: publishers.list,
      platforms: platformTitles,
      genres: genres.list,
      franchises: franchise.list,
      gameModes: gameModes.list,
      themes: themes.list,
      trailerId,
      coverSrc,
      screenshots
    };
  });

  if (!data.title || !data.title.toLowerCase().includes(def.expected.split(':')[0].toLowerCase())) {
    throw new Error(`Unexpected title for ${def.id}: ${data.title || '(blank)'}`);
  }

  const dir = path.join(OUT, def.slug);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.join(dir, 'screenshots'), { recursive: true });

  const coverUrl = unwrapImage(data.coverSrc);
  let coverPath = '';
  if (coverUrl) {
    const ext = extFor(coverUrl);
    const dest = path.join(dir, `cover${ext}`);
    await download(coverUrl, dest);
    coverPath = path.posix.join('assets/game-details', def.slug, `cover${ext}`);
  }

  const screenshotPaths = [];
  const sourceScreenshots = cleanList(data.screenshots.map(unwrapImage));
  for (let i = 0; i < sourceScreenshots.length; i++) {
    const source = sourceScreenshots[i];
    const ext = extFor(source);
    const filename = `${String(i + 1).padStart(2, '0')}${ext}`;
    const dest = path.join(dir, 'screenshots', filename);
    console.log(`Downloading screenshot ${i + 1}/${sourceScreenshots.length}`);
    await download(source, dest);
    screenshotPaths.push(path.posix.join('assets/game-details', def.slug, 'screenshots', filename));
  }

  if (!screenshotPaths.length) throw new Error(`No screenshots found for ${def.expected}`);

  manifest.games[def.expected] = {
    id: def.id,
    name: data.title,
    rating: data.rating,
    releaseDate: data.releaseDate,
    developers: cleanList(data.developers),
    publishers: cleanList(data.publishers),
    platforms: cleanList(data.platforms),
    genres: cleanList(data.genres),
    franchises: cleanList(data.franchises),
    gameModes: cleanList(data.gameModes),
    themes: cleanList(data.themes),
    trailerId: data.trailerId,
    cover: coverPath,
    screenshots: screenshotPaths
  };

  console.log(JSON.stringify(manifest.games[def.expected], null, 2));
  await page.close();
}

await browser.close();
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('\nGameNexus launcher assets captured locally.');
