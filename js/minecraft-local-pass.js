/* Local Minecraft integration.
   The launcher + game are vendored into games/minecraft-launcher from the
   user's lauraevan/mclauncherrep repository. No runtime jsDelivr/t9os hop. */
(() => {
'use strict';

const ROOT = 'games/minecraft-launcher';
const LAUNCHER = `${ROOT}/index.html`;
const COVER = 'https://store-images.s-microsoft.com/image/apps.53095.13850085746326678.06e2dc5c-7997-46e9-a8e6-0e48b57cb13b.419e3c9d-9dd3-4a28-a9f3-a12350215871?h=1024&q=95&w=1024';
const HERO = 'https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/NewKeyArt_Header.jpg';
const COVER_SENTINEL = '__xbox_local_minecraft_cover__';
const HOME = document.getElementById('view-home');

const isMinecraft = value => String(value || '').trim().toLowerCase() === 'minecraft';

/* Use official high-resolution Minecraft artwork everywhere Xbox presents the game. */
if (window.Artwork?.hero && !window.Artwork.__minecraftLocalHero){
  const originalHero = window.Artwork.hero.bind(window.Artwork);
  window.Artwork.hero = name => isMinecraft(name)
    ? Promise.resolve(HERO)
    : originalHero(name);
  window.Artwork.__minecraftLocalHero = true;
}

/* App.launch normally resolves catalogue cover filenames through the game CDN.
   This one cover is already in this repo, so hand it straight back. */
if (window.Media?.resolveCover && !window.Media.__minecraftLocalCover){
  const originalResolve = window.Media.resolveCover.bind(window.Media);
  window.Media.resolveCover = (file, onURL, onFail, opts) => {
    if (file === COVER_SENTINEL){
      queueMicrotask(() => onURL?.(COVER));
      return () => {};
    }
    return originalResolve(file, onURL, onFail, opts);
  };
  window.Media.__minecraftLocalCover = true;
}

const MINECRAFT_GAME = {
  id: 'minecraft-local-launcher',
  numericId: 26012,
  name: 'Minecraft',
  author: 'Minecraft Launcher',
  authorLink: null,
  cover: COVER,
  coverAlt: '',
  coverFile: COVER_SENTINEL,
  play: LAUNCHER,
  playAlt: '',
  external: false,
  featured: true,
  special: [],
  tag: null,
  shelf: 'Games',
  index: -1
};

function launchMinecraft(){
  window.XboxHomeRecents?.mark?.('Minecraft');
  if (!window.App?.launch){
    location.href = LAUNCHER;
    return;
  }

  window.App.launch(MINECRAFT_GAME);

  /* Use the larger local art immediately on the Xbox launch splash. */
  requestAnimationFrame(() => {
    const art = document.getElementById('launchArt');
    if (art) art.style.backgroundImage = `url("${HERO}")`;
  });
}

function patchMinecraftTile(){
  if (!HOME) return;

  const tile = [...HOME.querySelectorAll('.ref-tile[data-ref-title]')]
    .find(node => isMinecraft(node.dataset.refTitle));
  if (tile){
    tile.dataset.minecraftLocal = '1';
    tile.dataset.homeDirectLaunch = 'Minecraft';
    tile._navActivate = launchMinecraft;

    const img = tile.querySelector('.ref-art img');
    if (img && img.getAttribute('src') !== COVER){
      img.src = COVER;
      img.alt = '';
      img.loading = 'eager';
      img.decoding = 'async';
      img.classList.add('loaded');
      img.style.objectFit = 'cover';
    }
  }

  /* Keep the My games & apps mosaic on the same local Minecraft art too. */
  HOME.querySelectorAll('.ref-library-mosaic img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (/Minecraft_2024_cover_art|minecraft.*cover/i.test(src)) img.src = COVER;
  });
}

let queued = false;
if (HOME){
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patchMinecraftTile();
    });
  }).observe(HOME, { childList:true, subtree:true });
}

patchMinecraftTile();
window.XboxLocalMinecraft = { launch:launchMinecraft, game:MINECRAFT_GAME, root:ROOT };
})();
