import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const BASE = 'https://gamenexus.geek-factory.xyz';
const OUT = path.resolve('assets/game-details');
const cloud = JSON.parse(await fs.readFile('stratus/cloud.json', 'utf8'));
const coverManifest = JSON.parse(await fs.readFile('assets/stratus-covers/manifest.json', 'utf8'));
let existingManifest = null;
try {
  existingManifest = JSON.parse(await fs.readFile(path.join(OUT,'manifest.json'),'utf8'));
} catch {}


const ALIASES = new Map(Object.entries({
  'god of war 4':'God of War',
  'world war z aftermath':'World War Z: Aftermath',
  'diablo ii resurrected':'Diablo II: Resurrected',
  'tomb raider definitive edition':'Tomb Raider: Definitive Edition',
  'guilty gear strive':'Guilty Gear Strive',
  'schedule 1':'Schedule I',
  'cities skylines 2':'Cities: Skylines II',
  'dead space 3':'Dead Space 3',
  'the last of us part ii':'The Last of Us Part II',
  'the last of us part i':'The Last of Us Part I',
  'uncharted 4':'Uncharted 4: A Thief\'s End',
  'god of war ragnarok':'God of War Ragnarök',
  'alan wake 2':'Alan Wake II',
  'marvel s spider man miles morales':'Marvel\'s Spider-Man: Miles Morales',
  'ranch simulator22':'Ranch Simulator',
  'marvel s spider man remastered':'Marvel\'s Spider-Man Remastered',
  'subnautica zero':'Subnautica: Below Zero',
  'assassin s creed revelations':'Assassin\'s Creed: Revelations',
  'assassin s creed black flag':'Assassin\'s Creed IV: Black Flag',
  'football pes 2021':'eFootball PES 2021 Season Update',
  'party hard2':'Party Hard 2',
  'overcooked 2':'Overcooked! 2',
  'batman arkham origins':'Batman: Arkham Origins',
  'batman arkham knight':'Batman: Arkham Knight',
  'tom clancy s ghost recon wildlands':'Tom Clancy\'s Ghost Recon Wildlands',
  'doraemon story of seasons':'Doraemon Story of Seasons',
  'nier automata':'NieR: Automata',
  'baldur s gate 3':'Baldur\'s Gate 3',
  'witchers 3':'The Witcher 3: Wild Hunt',
  'subnautica zero':'Subnautica: Below Zero',
  'sniper ghost warrior contracts2':'Sniper Ghost Warrior Contracts 2',
  'tekken8':'Tekken 8',
  'fifa23':'FIFA 23',
  'fifa19':'FIFA 19',
  'pes 2017':'Pro Evolution Soccer 2017',
  'football pes 2021':'eFootball PES 2021 Season Update',
  'cod6 modern warfare':'Call of Duty: Modern Warfare 2',
  'attack on titan2':'Attack on Titan 2',
  'minecraft dungeons':'Minecraft Dungeons',
  'dead space tm 3':'Dead Space 3',
  'the last of us tm part i':'The Last of Us Part I',
  'the last of us tm part ii':'The Last of Us Part II',
  'nier automata tm':'NieR: Automata',
  'batman tm arkham origins':'Batman: Arkham Origins',
  'batman tm arkham knight':'Batman: Arkham Knight',
  'tom clancy s ghost recon r wildlands':'Tom Clancy\'s Ghost Recon Wildlands',
  'resident evil 2 remake':'Resident Evil 2',
  'resident evil 7 biohazard':'Resident Evil 7: Biohazard',
  'one piece pirate warriors 4':'One Piece: Pirate Warriors 4',
  'one piece burning blood':'One Piece: Burning Blood',
  'final fantasy vii remake intergrade':'Final Fantasy VII Remake Intergrade',
  'assassin s creed odyssey the fate of atlantis':'Assassin\'s Creed Odyssey',
  'assassin s creed odyssey':'Assassin\'s Creed Odyssey',
  'assassin s creed brotherhood':'Assassin\'s Creed: Brotherhood',
  'assassin s creed revelations':'Assassin\'s Creed: Revelations',
  'assassin s creed black flag':'Assassin\'s Creed IV: Black Flag',
  'assassin s creed syndicate':'Assassin\'s Creed Syndicate'
}));

const RETIRED = new Set(['bs0096','jy0333','jy0532']);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const norm = value => clean(value)
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[™®©]/g,' ')
  .replace(/[^a-z0-9]+/g,' ')
  .trim();

function searchTitle(name){
  return ALIASES.get(norm(name)) || name;
}

function unique(values){
  return [...new Set((values || []).map(clean).filter(Boolean).filter(v => v !== 'N/A'))];
}

function sourceUrl(src){
  if (!src) return '';
  try {
    const url = new URL(src, BASE);
    return url.searchParams.get('url') || url.href;
  } catch {
    return '';
  }
}

function tokenScore(a,b){
  const aa = new Set(norm(a).split(' ').filter(Boolean));
  const bb = new Set(norm(b).split(' ').filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let same = 0;
  for (const token of aa) if (bb.has(token)) same++;
  return same / Math.max(aa.size, bb.size);
}

async function fetchBuffer(url, attempts=3){
  let last;
  for (let i=0;i<attempts;i++){
    try {
      const res = await fetch(url, {
        headers:{
          'user-agent':'Mozilla/5.0 (Xbox local asset vendor)',
          'accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        redirect:'follow'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get('content-type') || '';
      if (!type.startsWith('image/')) throw new Error(`not an image: ${type}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 512) throw new Error('image payload too small');
      return buffer;
    } catch (err){
      last = err;
      await sleep(700 * (i+1));
    }
  }
  throw last || new Error('download failed');
}

async function saveWebp(url, destination, {width=1280,height=720,quality=68}={}){
  const buffer = await fetchBuffer(url);
  await fs.mkdir(path.dirname(destination), {recursive:true});
  await sharp(buffer)
    .rotate()
    .resize({width,height,fit:'inside',withoutEnlargement:true})
    .webp({quality,effort:4})
    .toFile(destination);
}

async function findGame(searchPage, wanted){
  const query = searchTitle(wanted);
  const input = searchPage.locator('#search-game');
  await input.fill('');
  await input.fill(query);
  await sleep(650);

  let results = [];
  for (let attempt=0;attempt<4;attempt++){
    try {
      await searchPage.waitForFunction(q => {
        const input = document.querySelector('#search-game');
        if (!input || input.value !== q) return false;
        const links = [...document.querySelectorAll('a[href^="/games/"]')];
        const noResults = /No games found|Aucun jeu trouvé/i.test(document.body.innerText || '');
        return links.length > 0 || noResults;
      }, query, {timeout:12000});

      results = await searchPage.evaluate(() => {
        const found = new Map();
        for (const link of document.querySelectorAll('a[href^="/games/"]')){
          const href = link.getAttribute('href') || '';
          if (!/^\/games\/\d+$/.test(href)) continue;
          const card = link.closest('[class*="card"]') || link.parentElement?.parentElement;
          const name =
            card?.querySelector('[class*="CardTitle"], .text-lg')?.textContent ||
            [...(card?.querySelectorAll('a') || [])].map(a => a.textContent).find(Boolean) ||
            link.textContent || '';
          if (!found.has(href)) found.set(href,{href,name:String(name).trim()});
        }
        return [...found.values()];
      });
      break;
    } catch {
      await sleep(1000);
    }
  }

  if (!results.length) return null;
  const exactWanted = norm(wanted);
  const exactQuery = norm(query);
  let best = results.find(r => norm(r.name) === exactWanted) ||
             results.find(r => norm(r.name) === exactQuery) || null;
  if (best) return best;

  const ranked = results
    .map(r => ({...r,score:Math.max(tokenScore(wanted,r.name),tokenScore(query,r.name))}))
    .sort((a,b)=>b.score-a.score);
  return ranked[0]?.score >= .5 ? ranked[0] : null;
}

async function readDetails(detailPage, href){
  await detailPage.goto(new URL(href,BASE).href,{waitUntil:'domcontentloaded',timeout:90000});
  await detailPage.waitForSelector('main h1',{timeout:60000});
  await sleep(350);

  return detailPage.evaluate(() => {
    const clean = value => String(value || '').replace(/\s+/g,' ').trim();
    const heading = (tag,label) => [...document.querySelectorAll(`main ${tag}`)]
      .find(el => clean(el.textContent).toLowerCase() === label.toLowerCase());

    const valueFor = label => {
      const h = heading('h3',label);
      if (!h) return [];
      const box = h.parentElement;
      const value = [...(box?.children || [])].find(el => el !== h) || h.nextElementSibling;
      if (!value) return [];
      const childText = [...value.children].map(el => clean(el.textContent)).filter(Boolean);
      return childText.length ? childText : (clean(value.textContent) ? [clean(value.textContent)] : []);
    };

    const body = document.body?.innerText || '';
    const score = body.match(/(\d+(?:\.\d+)?)\s*\/\s*100\s*\(Metascore\)/i);
    const title = clean(document.querySelector('main h1')?.textContent);

    const description =
      clean(document.querySelector('main p.text-lg.text-muted-foreground.mb-8.max-w-3xl')?.textContent) ||
      [...document.querySelectorAll('main p')].map(p=>clean(p.textContent)).find(t=>t.length>80) || '';

    const coverSrc = document.querySelector('main aside img')?.getAttribute('src') || '';

    const screenshotsHeading =
      heading('h2','Screenshots') ||
      [...document.querySelectorAll('main h2')].find(el => /screenshots|captures d'écran/i.test(clean(el.textContent)));
    const screenshots = [...(screenshotsHeading?.parentElement?.querySelectorAll('img') || [])]
      .map(img => img.getAttribute('src') || '').filter(Boolean);

    const trailerSrc = document.querySelector('main iframe[src*="youtube.com/embed/"]')?.getAttribute('src') || '';
    const trailerId = trailerSrc.match(/\/embed\/([^?&#/]+)/)?.[1] || '';

    return {
      title,
      description,
      rating: score ? Number(score[1]) : null,
      releaseDate: valueFor('Release Date')[0] || '',
      developers: valueFor('Developers'),
      publishers: valueFor('Publishers'),
      genres: valueFor('Genres'),
      franchises: valueFor('Franchise'),
      gameModes: valueFor('Game Modes'),
      themes: valueFor('Themes'),
      platforms:[...document.querySelectorAll('main [title]')]
        .map(el=>clean(el.getAttribute('title')))
        .filter(Boolean),
      trailerId,
      coverSrc,
      screenshots
    };
  });
}

await fs.mkdir(OUT,{recursive:true});

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({
  locale:'en-US',
  viewport:{width:1440,height:1000},
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
});
await context.addInitScript(() => {
  try { localStorage.setItem('gamenexus_lang','en'); } catch {}
});

const searchPage = await context.newPage();
const detailPage = await context.newPage();
await searchPage.goto(`${BASE}/games`,{waitUntil:'domcontentloaded',timeout:90000});
await searchPage.waitForSelector('#search-game',{timeout:60000});

const manifest = existingManifest?.version === 3 && existingManifest?.games
  ? {
      ...existingManifest,
      version:3,
      source:'GameNexus / IGDB, vendored at build time',
      gameCount:cloud.length,
      games:{...existingManifest.games},
      byName:{...(existingManifest.byName || {})}
    }
  : {
      version:3,
      source:'GameNexus / IGDB, vendored at build time',
      gameCount:cloud.length,
      games:{},
      byName:{}
    };

const missingOnly = existingManifest?.version === 3 && process.env.FULL_REFRESH !== '1';
const targets = missingOnly
  ? cloud.filter(raw => {
      const key = String(raw.game_key || raw.key || '');
      return manifest.games?.[key]?.source !== 'GameNexus / IGDB';
    })
  : cloud;

let matched = 0;
let screenshotCount = 0;
let failures = 0;

for (let index=0; index<targets.length; index++){
  const raw = targets[index];
  const key = String(raw.game_key || raw.key || `game-${index+1}`);
  const name = clean(raw.name || key);
  const localCover = coverManifest[key]?.path || '';
  const dir = path.join(OUT,key);
  await fs.mkdir(path.join(dir,'screenshots'),{recursive:true});
  console.log(`\n[${index+1}/${targets.length}] ${name} (${key})`);

  const previous = manifest.games?.[key] || {};
  const fallback = {
    ...previous,
    gameKey:key,
    name,
    matchName:previous.matchName || '',
    gameNexusId:previous.gameNexusId ?? null,
    source:previous.source || (RETIRED.has(key) ? 'Stratus fallback (retired)' : 'Stratus fallback'),
    description:clean(previous.description || raw.description || raw.desc || ''),
    rating:previous.rating ?? null,
    releaseDate:previous.releaseDate || '',
    developers:unique(previous.developers || []),
    publishers:unique(previous.publishers || []),
    platforms:unique(previous.platforms || []),
    genres:unique(previous.genres?.length ? previous.genres : (raw.tags || [])),
    franchises:unique(previous.franchises || []),
    gameModes:unique(previous.gameModes || []),
    themes:unique(previous.themes || []),
    trailerId:previous.trailerId || '',
    cover:previous.cover || localCover,
    hero:previous.hero || localCover,
    screenshots:Array.isArray(previous.screenshots) ? previous.screenshots : []
  };

  try {
    const heroDisk = path.join(dir,'hero.webp');
    let hasHero = false;
    try { await fs.access(heroDisk); hasHero = true; } catch {}
    if (raw.image && !hasHero){
      const heroPath = path.posix.join('assets/game-details',key,'hero.webp');
      await saveWebp(String(raw.image), heroDisk, {width:1600,height:900,quality:70});
      fallback.hero = heroPath;
    } else if (hasHero && !fallback.hero) {
      fallback.hero = path.posix.join('assets/game-details',key,'hero.webp');
    }
  } catch (err){
    console.warn(`  hero fallback failed: ${err.message}`);
  }

  let row = fallback;
  try {
    const match = await findGame(searchPage,name);
    if (!match) throw new Error('no close GameNexus match');

    const id = Number(match.href.split('/').pop());
    const detail = await readDetails(detailPage,match.href);
    if (!detail.title) throw new Error('detail page had no title');

    const score = Math.max(tokenScore(name,detail.title),tokenScore(searchTitle(name),detail.title));
    if (score < .5) throw new Error(`weak match: ${detail.title}`);

    matched++;
    const screenshotPaths = [];
    const shots = unique(detail.screenshots.map(sourceUrl));
    for (let i=0;i<shots.length;i++){
      const target = path.join(dir,'screenshots',`${String(i+1).padStart(2,'0')}.webp`);
      try {
        await saveWebp(shots[i],target,{width:1280,height:720,quality:66});
        screenshotPaths.push(path.posix.join('assets/game-details',key,'screenshots',`${String(i+1).padStart(2,'0')}.webp`));
        screenshotCount++;
      } catch (err){
        console.warn(`  screenshot ${i+1} failed: ${err.message}`);
      }
    }

    let nexusCover = '';
    const coverSource = sourceUrl(detail.coverSrc);
    if (coverSource){
      try {
        await saveWebp(coverSource,path.join(dir,'cover.webp'),{width:720,height:1080,quality:76});
        nexusCover = path.posix.join('assets/game-details',key,'cover.webp');
      } catch (err){
        console.warn(`  cover failed: ${err.message}`);
      }
    }

    row = {
      ...fallback,
      matchName:detail.title,
      gameNexusId:Number.isFinite(id) ? id : null,
      source:'GameNexus / IGDB',
      description:clean(detail.description) || fallback.description,
      rating:detail.rating,
      releaseDate:clean(detail.releaseDate),
      developers:unique(detail.developers),
      publishers:unique(detail.publishers),
      platforms:unique(detail.platforms),
      genres:unique(detail.genres).length ? unique(detail.genres) : fallback.genres,
      franchises:unique(detail.franchises),
      gameModes:unique(detail.gameModes),
      themes:unique(detail.themes),
      trailerId:clean(detail.trailerId),
      cover:nexusCover || fallback.cover,
      hero:screenshotPaths[0] || fallback.hero || nexusCover || fallback.cover,
      screenshots:screenshotPaths
    };

    console.log(`  matched -> ${detail.title}; ${screenshotPaths.length} screenshots`);
  } catch (err){
    failures++;
    console.warn(`  GameNexus fallback: ${err.message}`);
  }

  manifest.games[key] = row;
  manifest.byName[norm(name)] = key;
}

await browser.close();

for (const raw of cloud){
  const key = String(raw.game_key || raw.key || '');
  const name = clean(raw.name || key);
  if (key && name) manifest.byName[norm(name)] = key;
}

await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const allRows = Object.values(manifest.games || {});
const totalEnriched = allRows.filter(row => row?.source === 'GameNexus / IGDB').length;
const totalScreenshots = allRows.reduce((sum,row) => sum + (Array.isArray(row?.screenshots) ? row.screenshots.length : 0),0);
console.log(`\nDone: ${cloud.length} games total; retried ${targets.length}; ${matched} newly matched; ${totalEnriched} enriched total; ${totalScreenshots} local screenshots; ${failures} retry fallbacks.`);
if (Object.keys(manifest.games).length !== cloud.length) process.exitCode = 1;
