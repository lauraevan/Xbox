/* Local rich launcher metadata.
   Factual fields and screenshots are vendored into assets/game-details from
   GameNexus. Runtime never calls GameNexus or IGDB. */
(() => {
'use strict';

const SUMMARIES = {
  'Forza Horizon 5': 'Race across a huge open-world version of Mexico filled with cities, jungles, deserts, beaches and changing weather. Build a car collection, tackle expeditions and events, and jump into solo or multiplayer driving whenever you want.',
  'Grand Theft Auto V': 'Explore Los Santos and the surrounding countryside through the intertwined stories of Michael, Franklin and Trevor. Missions, driving, combat and free-roam exploration all share the same sprawling open world.',
  'Hollow Knight: Silksong': 'Play as Hornet on a journey through the haunted kingdom of Pharloom. Fast acrobatic combat, new abilities, strange creatures and layered environments turn the climb toward the kingdom\'s peak into a new adventure.',
  'Elden Ring': 'Explore the Lands Between as a Tarnished in a vast action RPG built around discovery, difficult combat and flexible character builds. Follow the trail of the shattered Elden Ring while choosing how and where to explore.',
  'Red Dead Redemption': 'Ride across the fading American frontier as former outlaw John Marston, forced to track down members of his old gang. Open-world exploration, gunfights and a Western story unfold across towns, wilderness and the Mexican borderlands.',
  'Minecraft': 'Explore and reshape a block-built world where gathering, crafting and construction are the core tools. Play creatively or survive hostile nights, then build alone or together across open-ended worlds.',
  'Fortnite': 'Drop into Fortnite\'s constantly changing multiplayer world, where shooting, movement, building and seasonal events reshape the experience. Play competitive modes or jump into the wider collection of creator-made experiences.',
  'Cyberpunk 2077': 'Become V, a mercenary navigating Night City in a first-person open-world RPG. Shape your build with weapons, cyberware and skills while choices, jobs and character relationships drive the story forward.'
};

const ALIASES = {
  'gta v':'Grand Theft Auto V',
  'gta 5':'Grand Theft Auto V',
  'grand theft auto 5':'Grand Theft Auto V',
  'silksong':'Hollow Knight: Silksong',
  'rdr':'Red Dead Redemption',
  'rdr1':'Red Dead Redemption',
  'red dead redemption 1':'Red Dead Redemption',
  'cyberpunk2077':'Cyberpunk 2077'
};

const normal = value => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[™®©]/g,' ')
  .replace(/[^a-z0-9]+/g,' ')
  .trim();

let manifestPromise = null;

function canonical(value){
  const n = normal(value);
  const direct = Object.keys(SUMMARIES).find(name => normal(name) === n);
  return direct || ALIASES[n] || value;
}

async function load(){
  if (!manifestPromise){
    manifestPromise = fetch('assets/game-details/manifest.json', { cache:'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Game details manifest ' + res.status);
        return res.json();
      })
      .then(data => {
        if (!data || typeof data !== 'object') return { games:{}, byName:{} };
        if (data.byName) return data;

        // v1 compatibility. Older manifests keyed games directly by title.
        const games = data.games || {};
        const byName = {};
        for (const [name,row] of Object.entries(games)) byName[normal(name)] = name;
        return { ...data, games, byName };
      })
      .catch(err => {
        console.warn('Local GameNexus details unavailable', err);
        return { games:{}, byName:{} };
      });
  }
  return manifestPromise;
}

async function get(input){
  const manifest = await load();
  const games = manifest.games || {};
  const gameKey = input && typeof input === 'object' ? String(input.gameKey || '') : '';
  const requestedName = input && typeof input === 'object'
    ? String(input.name || '')
    : String(input || '');

  let row = gameKey ? games[gameKey] : null;
  let key = gameKey;

  if (!row){
    const canonicalName = canonical(requestedName);
    const lookup = manifest.byName?.[normal(canonicalName)] || manifest.byName?.[normal(requestedName)] || canonicalName;
    row = games[lookup] || null;
    key = lookup;
  }
  if (!row) return null;

  const name = row.name || requestedName || key;
  const summary = SUMMARIES[canonical(name)] || row.summary || row.description || '';
  const screenshots = Array.isArray(row.screenshots) ? row.screenshots.filter(Boolean) : [];

  return {
    ...row,
    name,
    summary,
    screenshots,
    hero: row.hero || screenshots[0] || row.cover || '',
    source: row.source || 'local'
  };
}

window.GameDetails = { load, get, canonical, summaries:SUMMARIES };
})();
