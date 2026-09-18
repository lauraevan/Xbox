# CLAUDE.md

Read this before changing anything. It describes what this project is trying
to be and the conventions that keep ~28 layered scripts from breaking each
other.

## What this is

A **console OS that runs in a browser** — not an Xbox-themed web launcher.
Every convention below exists to defend that distinction. If a change would
make this read as a web dashboard, it is the wrong change.

Content comes from a catalogue of ~742 browser games streamed from a CDN at
runtime. Nothing about the games is vendored except the Minecraft launcher.

## Run and verify

```bash
python3 -m http.server 8777        # then open http://127.0.0.1:8777
```

Static site, no build step. Every file is loaded directly by `index.html`.

**Verify visual work by measuring, not by looking.** The layout is authored
against real coordinates; read them back out of the page:

```js
const b = document.querySelector('.tile-hero').getBoundingClientRect();
```

Eyeballing a screenshot has repeatedly produced wrong conclusions here.
If a change claims a position, prove it with a number.

## The canvas

Authored against **1920×1080**. The root font size is
`min(100vw / 192, 100vh / 108)`, so **`1rem` = 10px at 1080p** and every
value in the stylesheets reads as "pixels at 1080p".

Measured anchors, from the reference frames:

| Element | Position |
| --- | --- |
| Content margin | `--safe-x: 10rem` (x=100) |
| Nav band | y=120, slightly left of centre |
| Profile block | y=240 |
| Carousel | selected tile starts y=640 |
| Card row | y=890 |
| Selected tile | 200px, against 140px neighbours, bottoms aligned at 840 |
| Home row | 9 tiles: selected + 6 + Friends + browse |

Do not "clean up" these into round numbers or a uniform scale. They are
measurements, not preferences.

## Design tokens

Defined on `:root` in `css/base.css`. Use them; do not hardcode equivalents.

- Surfaces: `--bg #06080a`, `--panel`, `--panel-2`, `--panel-3`
- Accent: `--green`, `--green-bright`, `--accent`
- Text: `--text`, `--text-2`, `--text-3` (three opacities, not new greys)
- Radius: `--tile-r`, `--card-r`
- Motion: `--ease-decel` in, `--ease-accel` out, `--ease-standard` between;
  durations `--dur-fast/-dur/-dur-mid/-dur-slow` (83/167/250/333ms)
- Type: Segoe UI Variable Display → Segoe UI
- Icons: Fluent System Icons (Microsoft, MIT) via `js/icons.js`. Do not
  introduce a second icon family.

## Architecture: base modules, then passes

Load order in `index.html` is **load-bearing**. Roughly:

```
icons media features artwork catalog state audio nav views
  console-pages stratus store cloud-library guide reference app
  …then the passes: app-patch, *-pass, *-custom
```

Base modules own the data and the first render. Everything named
`*-pass.js`, `app-patch.js` or `*-custom.js` is a **layer on top** that
augments what already exists.

### House rules for passes

These are the conventions the existing passes follow. Breaking them
silently breaks the layers above.

1. **Wrap, do not rewrite.** Keep the original and call through:
   ```js
   const originalHero = window.Artwork.hero.bind(window.Artwork);
   window.Artwork.hero = async name => { /* … */ return originalHero(name); };
   ```
2. **Attach through the nav event seam**, not by reaching into internals:
   `nav:focus`, `nav:button`, `nav:activate`, `nav:move`, `nav:padconnected`.
3. **Use `MutationObserver` + `requestAnimationFrame`** to attach to DOM the
   base renderer owns, rather than re-rendering it yourself.
4. **Never resize or replace a base surface.** Existing passes state this
   explicitly in their own headers ("the existing Home renderer is not
   replaced or resized"). Honour it.
5. **Fail soft.** A pass that cannot do its job must leave the app working.

## Module seams

| Module | Surface |
| --- | --- |
| `Catalog` | `all() get(id) count() featured() byTag() standard() alphabetical() search() shelves() studios() visible()` |
| `Media` | `loadCover(file, img, {priority, onFail})`, `resolveCover(file, onURL, onFail)`, `placeholderHue()`, `health()` |
| `State` | `setSetting() togglePin() markPlayed() unlock() profiles() switchProfile() isBlocked() flush()` |
| `Nav` | `focus() focusFirst() focusIn() restore() hideRing()` |
| `App` | `setView() openDetail() launch() quitGame() toast() modal() setBackdrop()` |
| `Features` | `Captures Network ScreenTime QuickResume Storage Wallpaper` |
| `Artwork` | `hero(name)` — optional widescreen art, returns null when unavailable |

A catalogue game is: `id numericId name sortName author authorLink cover
coverAlt coverFile play playAlt featured shelf special tag`.

Load images through `Media`, never with a bare `img.src`. It handles the
mirror chain, the bounded queue, retries, per-host health and placeholders.
Large prominent art passes `priority: true`.

## State

One `localStorage` key holds profile and console settings; captures and the
wallpaper live in IndexedDB. Multiple profiles are supported — profile-owned
fields are parked and restored on switch.

Writes are debounced. If a change must survive an immediate reload, call
`State.flush()`.

## Known hazards

**Script-order fragility.** 28 sequentially loaded scripts where later ones
patch earlier ones. One failing to arrive leaves a half-patched app rather
than a clean failure. An inline failsafe in `index.html` clears the boot
screen after 13s and names the missing modules — do not remove it. Adding a
pass makes this worse; prefer extending an existing one.

**Hotlinked artwork.** `js/reference.js` pins artwork to third-party image
URLs (press CDNs, wikis). Measured: 16 distinct hosts refused requests in a
single load and 6 of 16 images failed. Those hosts commonly block by referer
and their URLs rot. Anything routed through `Media` degrades to a designed
placeholder instead; bare `<img src>` shows a broken icon.

**The wallpaper.** The catalogue only ships square 1:1 covers, so cropping
one to a widescreen backdrop looks wrong. The fix is a real 16:9 image:
Settings → Personalization → Home wallpaper accepts a file (stored in
IndexedDB) or a URL, and pins it behind the dashboard like the console does.

**Network assumptions.** Covers average ~80KB and reach 400KB. Do not fire
unbounded parallel requests at one host — that is what caused tiles to fail
permanently before `Media` existed.

## Boot

`assets/boot.{mp4,webm}` with a poster taken from the clip's **final** frame,
so a skipped boot lands where the animation would have ended. Audio is
stripped because autoplay requires a muted track. Guards: 2.5s ready budget,
1.2s stall grace, 10s hard ceiling, plus data-saver and reduced-motion
opt-outs. The boot must never be able to hang.

## Working with more than one agent

This repo has had two agents pushing to one branch and they diverged by 154
commits. Before starting: `git fetch` and merge. Never force-push over
commits you did not write.
