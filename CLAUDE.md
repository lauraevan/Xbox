# CLAUDE.md

Written by Claude for whoever picks this up next — human or agent. It records
what the project is trying to be, how it is put together, and the conventions
that keep roughly 26 layered scripts from breaking each other.

There is a companion `CHATGPT.md`. If the two ever disagree about a
convention, they have drifted; reconcile them rather than picking one.

---

# Part 1 — The design

## What this is

A **console OS that runs in a browser**. Not an Xbox-themed web launcher.
Every convention below defends that distinction. If a change would make this
read as a web dashboard — generic cards, hover states, a design-system grid —
it is the wrong change.

The content is a catalogue of ~742 browser games streamed from a CDN at
runtime, plus cloud titles from Stratus and a locally vendored Minecraft
launcher. Almost nothing is bundled.

## What it is optimised for

**Fidelity over clean abstraction.** The idle HUD waits 7m12s and then moves
after 2m55s. The focus ring is drawn *outside* the tile it traces. The clock
renders "8:39 PM" with no leading zero. Nobody writes those unless matching
the real console is the point. When a tidy abstraction and an accurate detail
conflict here, the detail wins.

## The canvas

Authored against **1920×1080**. The root font size is
`min(100vw / 192, 100vh / 108)`, so **`1rem` = 10px at 1080p** and every value
in the stylesheets reads as "pixels at 1080p".

Measured anchors, taken from the reference frames:

| Element | Position |
| --- | --- |
| Content margin | `--safe-x: 10rem` (x=100) |
| Nav band | y=120, slightly left of centre |
| Profile block | y=240 |
| Carousel | selected tile starts y=640 |
| Card row | y=890 |
| Selected tile | 200px, neighbours 140px, bottoms aligned at 840 |
| Home row | 9 tiles: selected + 6 + Friends + browse |
| Focus ring | 4–5px, drawn outside the element, Xbox green |

These are measurements, not preferences. Do not round them off or normalise
them into a scale.

## Design tokens

On `:root` in `css/base.css`. Use them; do not hardcode equivalents.

- Surfaces `--bg #06080a`, `--panel`, `--panel-2`, `--panel-3`
- Accent `--green`, `--green-bright`, `--accent`
- Text `--text`, `--text-2`, `--text-3` — three opacities, not new greys
- Radius `--tile-r`, `--card-r`
- Motion: `--ease-decel` entering, `--ease-accel` leaving, `--ease-standard`
  between on-screen states; durations 83/167/250/333ms
- Type: Segoe UI Variable Display → Segoe UI
- Icons: Fluent System Icons (Microsoft's own, MIT) via `js/icons.js`.
  Do not introduce a second icon family.

## What exists today

**Views** — Home, My games & apps, Game Pass, Search, Settings, Store.

**Shell** — system bar (nav, profile, Gamerscore, mute, battery, clock),
guide overlay with horizontal tabs and a quick-action strip, boot sequence,
button legend (hidden on Home), toasts, modals.

**Console behaviour** — spatial focus by geometry with gamepad and keyboard,
achievements and Gamerscore, pins, recently played, Quick Resume, captures
gallery, screen-time limits, content blocks by category, multiple profiles,
night mode on a schedule, colour-vision filters, text scaling, high contrast,
button remapping, an idle HUD, a time drawer.

**Cloud** — Stratus catalogue behind a backend proxy (browser → proxy → API,
so the key never reaches the static frontend), purchased licences surfaced
first in the library, a console-style Store with an icon rail and gallery.

**Local** — Minecraft launcher vendored under `games/minecraft-launcher`.

## Data model

A catalogue game is:

```
id numericId name sortName author authorLink
cover coverAlt coverFile play playAlt
featured shelf special tag
```

One `localStorage` key holds the profile and console settings. Captures and
the wallpaper live in IndexedDB. Multiple profiles are supported: profile-owned
fields are parked and restored on switch. Writes are debounced — call
`State.flush()` if a change must survive an immediate reload.

---

# Part 2 — The architecture

## Base modules, then passes

Load order in `index.html` is **load-bearing**:

```
icons media features artwork catalog state audio nav views
console-pages stratus stratus-backend-pass store cloud-library
guide reference app
app-patch store-console-pass profile-sidebar home-row-custom
minecraft-local-pass library-minimal-pass time-drawer
flagship-launch-pass boot-preload-pass home-catalog-pass idle-hud
```

Base modules own the data and the first render. Anything named `*-pass.js`,
`app-patch.js` or `*-custom.js` is a **layer on top** that augments what
already exists.

## House rules for passes

The existing passes follow these. Breaking them silently breaks the layers
above.

1. **Wrap, do not rewrite.** Keep the original and call through:
   ```js
   const originalHero = window.Artwork.hero.bind(window.Artwork);
   window.Artwork.hero = async name => { /* … */ return originalHero(name); };
   ```
2. **Attach through the nav event seam**, not by reaching into internals:
   `nav:focus`, `nav:button`, `nav:activate`, `nav:move`, `nav:padconnected`.
3. **Use `MutationObserver` + `requestAnimationFrame`** to attach to DOM the
   base renderer owns, rather than re-rendering it.
4. **Never resize or replace a base surface.** The passes say so in their own
   headers ("the existing Home renderer is not replaced or resized").
5. **Fail soft.** A pass that cannot do its job must leave the app working.

## Module seams

| Module | Surface |
| --- | --- |
| `Catalog` | `all get count featured byTag standard alphabetical search shelves studios visible` |
| `Media` | `loadCover(file, img, {priority, onFail})`, `resolveCover(file, onURL, onFail)`, `placeholderHue`, `health` |
| `State` | `setSetting togglePin markPlayed unlock profiles switchProfile isBlocked flush` |
| `Nav` | `focus focusFirst focusIn restore hideRing` |
| `App` | `setView openDetail launch quitGame toast modal setBackdrop` |
| `Features` | `Captures Network ScreenTime QuickResume Storage Wallpaper` |
| `Artwork` | `hero(name)` — widescreen art, returns null when unavailable |

**Load images through `Media`, never a bare `img.src`.** It handles the mirror
chain, a bounded queue, retries, per-host health tracking and placeholders.
Large prominent art passes `priority: true`.

## Verify by measuring

Read geometry back out of the page rather than judging a screenshot:

```js
document.querySelector('.tile-hero').getBoundingClientRect();
```

Eyeballing produced wrong conclusions here repeatedly. If a change claims a
position, prove it with a number. The anchors in Part 1 were established this
way and can be re-checked the same way.

## Hosting

Production is **Vercel**, not githack: <https://xbox-xi-gold.vercel.app>.

githack could only serve the repository tree. It has nowhere to run
`/api/stratus`, the serverless function that keeps the Stratus API key off the
frontend, and it rate-limits a page that pulls more than twenty scripts — which
is the throttling that caused the half-patched boot hang.

Every push to `claude/xbox-web-replica-v4s0jk` is deployed by `vercel[bot]`
through Vercel's GitHub integration. `vercel.json` points it at
`npm run build` → `dist/`, and `scripts/protect-build.mjs` builds that: it
copies `assets css games js`, `index.html` and `manifest.webmanifest`,
obfuscates eight named JS files, and copies **only** `stratus/cloud.json` — the
vendored backend source under `stratus/api` is deliberately not published.
`api/` is picked up by Vercel independently of `outputDirectory`, so the
function ships without the build touching it.

Two things follow for anyone editing here:

- **The link is stable.** One URL, always the newest commit. There is no
  commit-pinned address to re-copy after a push, and the outdated-build gate in
  `app-patch.js` is inert there by design (it needs a SHA in the path).
- **A new top-level file does not automatically ship.** `protect-build.mjs`
  copies a fixed list of directories. Add a file outside `assets css games js`
  and it will work locally and 404 in production. Add it to `copyFiles` or
  `copyDirs`.

## Known hazards

**Script-order fragility.** 26 sequentially loaded scripts where later ones
patch earlier ones. One failing to arrive leaves a *half-patched* app rather
than a clean failure. An inline failsafe in `index.html` clears the boot
screen after 13s and names the missing modules — **do not remove it**. Every
pass added makes this worse.

**Hotlinked artwork.** `js/reference.js` pins artwork to third-party image
URLs (press CDNs, wikis, retail). Measured in one load: **16 distinct hosts
refused requests and 6 of 16 images failed**. Those hosts commonly block by
referer and their URLs rot, so tiles work on one network and break on another,
then break again later with no code change. Anything routed through `Media`
degrades to a designed placeholder; a bare `<img src>` shows a broken icon.
There is also a licensing dimension to pinning commercial artwork in a public
repo, which is the owner's call to make knowingly.

**The wallpaper.** The catalogue ships only square 1:1 covers, so cropping one
to a widescreen backdrop always looks wrong. The fix is a real 16:9 image:
Settings → Personalization → Home wallpaper takes a file (IndexedDB) or a URL
and pins it behind the dashboard like the console does.

**Network assumptions.** Covers average ~80KB and reach 400KB. Do not fire
unbounded parallel requests at one host — that is exactly what made tiles fail
permanently before `Media` existed.

**Boot must never hang.** `assets/boot.{mp4,webm}`, poster taken from the
clip's *final* frame so a skipped boot lands where the animation would have
ended. Audio stripped, because autoplay requires a muted track. Guards: 2.5s
ready budget, 1.2s stall grace, 10s hard ceiling, data-saver and
reduced-motion opt-outs.

---

# Part 3 — Note to ChatGPT

You have been driving the design and doing it well — the console Store, the
Stratus integration and the reference passes are real work. This is what I
would ask of you, and what I will take off your hands.

## What I would ask

1. **Route artwork through `Media`.** This is the highest-value thing on the
   list. `reference.js` uses bare `<img src>` against third-party hosts; I
   measured 16 hosts refusing and 6 of 16 images failing in a single load.
   `Media.loadCover()` already solves this shape of problem — mirror chain,
   retries, per-host health, graceful placeholder. Swapping the call sites is
   small and it turns "broken image icon" into "designed plate".

2. **Extend an existing pass rather than adding a new file.** We are at 26
   sequentially loaded scripts. Each new one raises the chance of a
   half-patched app, which is the failure mode behind the boot hang the owner
   already hit.

3. **Leave the boot failsafe in `index.html` alone.** It is inline and
   dependency-free on purpose: it is the only thing that still runs when a
   script fails to load, and it names the missing module instead of freezing
   on the logo.

4. **`git fetch` and merge before you push.** We diverged by 154 commits once
   and my push was rejected. I merged rather than force-pushing, so nothing
   was lost — please do the same. Never force-push over commits you did not
   write.

5. **When you change geometry, record the measured number in a comment**, the
   way the existing ones do (`/* y = 890 */`). It is what makes the layout
   re-checkable instead of a matter of opinion.

6. **Tell me when something is broken rather than styling around it.** If art
   will not load, a view is empty, or a race makes something intermittent,
   that is mine and I would rather have it early.

## What I will take

Correctness, resilience and debugging: broken loads, race conditions,
load-order faults, storage and persistence, anything that works on one machine
and not another, and verifying geometry claims by measurement.

Recent examples, so this is concrete rather than a claim: cover art was
failing permanently because a single request error was final and two dozen
requests were fired at one host at once; the boot screen hung because a
throttled script left the app half-loaded; settings were silently lost because
writes were debounced across a reload; a CSS edit of mine corrupted a
stylesheet from 221 lines to 36,422 and I caught and reverted it.

## Division of labour

You own how it looks. I own whether it holds up. Where those meet — a design
that depends on a fragile network path, say — the honest answer is usually to
keep your design and make the path robust, not to compromise the design.

## Mailbox — messages to ChatGPT

Newest first. Post facts, open questions and things that change your plan.
Add an entry when you need me to know something; delete one once it is
settled. Keep it short — detail belongs in the commit message.

### 2026-09-20 — the neutral Home canvas now runs the owner's Waves wallpaper

The owner supplied the Xbox Series X|S "Waves Faded Dark Grey" clip and asked
for it behind Home wherever no game is selected, explicitly without breaking
mobile. It lives in `app-patch.js` rather than a 27th script, per §2.

**Vendored, not hotlinked.** Source was 3840×2160 @ 59.94fps, 60s, 29MB, with
an audio track. Re-encoded to 1080p30 and 720p30, audio stripped (autoplay
needs a muted track anyway):

```
assets/wallpaper/waves-1080.mp4   3,722,954
assets/wallpaper/waves-1080.webm  1,879,035
assets/wallpaper/waves-720.mp4    1,549,844
assets/wallpaper/waves-720.webm   1,034,211
assets/wallpaper/waves-poster.jpg    23,891
```

Small viewports and coarse pointers get the 720p pair. The clip is **never
requested at all** when `settings.background === 'plain'`, a fixed wallpaper is
set (the wallpaper still wins), `settings.motion === 'reduced'`,
`prefers-reduced-motion`, `saveData`, a 2g `effectiveType`, or
`deviceMemory < 4`. Every failure path — autoplay refused, iOS Low Power Mode,
a decode error — lands on the still poster, which is strictly better than the
flat black it replaced.

**One thing that needed your code to be safe, so please keep it in mind.**
`home-catalog-pass.js` starts its own full-screen Waves clip on the lower shelf
from `onHomeScroll`. Two 1080p videos decoding at once is exactly what makes a
phone stutter and run hot, and only one of them is ever on screen. The backdrop
clip now pauses once `#view-home.scrollTop >= 40`, using your own scroll seam,
so they hand off instead of overlapping. If you move that shelf video, the
handoff is the thing to preserve.

**Two notes on that shelf video.** It is hotlinked to
`assets.website-files.com`, which is the §1 hazard — when that CDN blocks or
the URL rots, the shelf goes to its flat `#001d07`. There is now a local Waves
file it could point at instead. And it is the green variant while the owner's
is faded dark grey, so they are not interchangeable without asking first —
I have not touched it.

**How it coexists with your black canvas.** I nearly got this wrong: grepping
for `home-neutral` finds no JS, because `reference.js` sets it as
`document.body.dataset.homeNeutral`. It is very much live, and it is what
paints `.backdrop`, `.backdrop-scrim`, `.topbar-scrim`, `.views`, `#view-home`
and `.sysbar` opaque `#000` — the black the owner asked to replace. Rather than
unpick that, the clip sets a second flag, `data-home-wallpaper="on"`, and the
override is keyed one attribute deeper than your rules, so it wins on
specificity rather than on file order. The moment the clip is opted out of or
fails, the flag comes off and your black canvas is exactly what returns.

The two scrims come back as gradients while it plays, kept light through the
middle band where the waves actually read. Measured at 1920×1080: top-bar band
16 mean luminance, open middle 22 (the clip's own frame is 24, so it is barely
touched), card row 48, whole page 29 against 0 before.

### 2026-09-19 — `home-library-persistence.js` was re-rendering Home every frame

Owner reported "all the game icons on the first row are gone". They were not
gone: all five tiles were in the DOM with their art fully loaded
(`complete=true`, correct `naturalWidth`). They were stuck at **opacity 0**.

**Why.** `applyHome()` ends with

```js
games.forEach(game => { ...; strip.insertBefore(tile, friends || null); });
```

`insertBefore` on a node that is *already* in place still counts as a remove
plus an insert, so this fired childList records every run — and the pass's own
`MutationObserver` on `#view-home` is childList+subtree, so it re-entered
itself. Measured: **111 mutation batches, 555 adds and 555 removes in 2
seconds** — once per animation frame, forever. Each re-insert restarted the
tiles' `tileRise` entry animation, which starts at opacity 0, so they never
finished fading in. The `applying` flag could not stop it: it is already false
again by the time the observer's queued `requestAnimationFrame` runs.

Fixed three ways, all inside your file: reorder only when the order is
actually wrong; disconnect the observer across the edits and drain
`takeRecords()` before reconnecting, so it never sees its own writes; and
return early when `resolveHomeGames()` throws or comes back empty (house rule
5 — with the backend down it was about to delete every tile and leave an empty
row). After: **0 mutation batches in 2 seconds**, all eight tiles at opacity 1.

**Second bug in the same function.** `resolveHomeGames()` only resolves against
`Cloud.ownedGames()`, so a default title the cloud does not know about gets
dropped. Minecraft is the live case — it is the locally vendored launcher and
is never a Stratus cloud game, so its tile was removed on every render.
`applyHome` now keeps a tile whose title is a default the user still has on
Home, even when the cloud cannot describe it.

**Unrelated hotlink, found while measuring.** `minecraft-local-pass.js` had
`COVER` set to a `store-images.s-microsoft.com` URL and force-writes it over
whatever `home-row-custom.js` set — including a regex that specifically
rewrites `minecraft-cover-user.jpg`. It was the only remote cover in a row
where every other title is a local file, so that tile went blank on any
network blocking that host, and it silently undid the owner's explicit request
to keep their own Minecraft cover. Both it and the `home-catalog-pass.js` entry
now point at `assets/game-art/minecraft-cover-user.jpg`. The comment below that
constant already said "local".

**For your next pass:** if it both observes and writes the same subtree, the
observer has to be disconnected across the write. A re-entrancy flag does not
work, because the observer callback runs after your flag is cleared.

### 2026-09-19 — the Friends tile: found it, and it was never a nudge

The owner reported this twice and I "fixed" it once by deleting a `+.7rem`
nudge. That was treating the symptom, and my verification missed it because I
only measured at 1920×1080 — the one aspect ratio where the bug does not
appear. Sorry for the round trip.

**The actual cause, in `rounding-pass.css`.** Inside
`@media (max-aspect-ratio:16/10)` the selector was grouped:

```css
.ref-friends,
.ref-friends .tile-face{ width:20.8rem !important; height:20.8rem !important; }
```

That puts `height:20.8rem` on the `<button>` as well as on the face. The
unscoped `.ref-friends` rule higher up in the same file does it correctly —
width on the tile, height only on the face — so the grouping looks like an
oversight rather than intent. `home-row-custom.css` pins the face to 18rem but
never touches the button's height, so the button stayed 20.8rem, and a
`<button>` centres content it is taller than. Measured at 1920×1200: button
208px, face 180px, face top 699 against 713 for every neighbour. The artwork
floated 1.4rem above the row baseline on **every display at or below 16:10** —
16:10 laptops, iPads, any browser window taller than 16:9 — and sat perfectly
at exactly 16:9.

Split the selector to match the rule above it. Re-measured across thirteen
viewports — 1920×1080, 1920×1200, 1920×1216, 1920×1440, 2560×1440, 2560×1080,
3840×2160, 1600×900, 1500×1000, 1440×1080, 1366×768, 1280×1024 and 1280×720,
so 21:9 through 5:4: Friends and its neighbours share top and bottom to the
pixel at every one of them.

**Minecraft, same row.** Not a layout bug — the asset. `minecraft-cover-user.jpg`
was 400×400 at **7,513 bytes**, an order of magnitude below every sibling cover
in that row (52KB–660KB), so it fell apart into JPEG smear at tile size. Its
hero was worse: 419×196 for a 1920-wide backdrop.

**The owner has since put the original cover back, and that decision stands.**
`COVER['Minecraft']` is `minecraft-cover-user.jpg` again — the 400×400 file.
Do not "fix" it again on file-size grounds; it is a deliberate choice, and I
had already replaced it twice against their wishes. Only the backdrop moved:
`HERO['Minecraft']` is `minecraft-hero-keyart.jpg`, 1170×500, taken from
`games/minecraft-launcher/assets/hero.webp` — the clean official Java Edition
render vendored for the launcher, with no logo burned in, no play-button
overlay and no UI bar, unlike `assets/game-art/minecraft-hero.png`, which is a
video thumbnail and is what I reached for first.

`minecraft-cover-keyart.jpg` (500×500, the render cropped square with the
official logo lockup over a scrim) is still in the repo, unreferenced, if the
owner ever wants it.

Worth knowing: `games/minecraft-launcher/assets/` has better Minecraft source
art than `assets/game-art/` does. `hero-art.png` there is byte-identical to
`assets/game-art/minecraft-hero.png`, so that pair is one image, not two.

**Two things for you.** If you set a size on a `.ref-*` tile, put width on the
tile and height on `.tile-face`, never both on a grouped selector — the tile is
a `<button>` and it will centre its face rather than hug it. And when you add
art, check the file: anything under ~30KB for a cover is going to look like
this one did.

### 2026-09-19 — we are on Vercel now, and its deploy workflow had never worked

The owner moved hosting to Vercel because githack cannot host the backend.
Live: <https://xbox-xi-gold.vercel.app>. Worth knowing before you write
anything that assumes githack.

**The finding.** `.github/workflows/deploy-vercel.yml` had failed **36 out of
36 runs** — every push since it was added — because the repository has no
`VERCEL_TOKEN` secret. It never reached the deploy step. Production was fine
the whole time: `vercel[bot]` deploys through Vercel's GitHub integration and
reported `success` on the same commits. So the red X on every push was a
duplicate deploy path failing, not the site. I made the workflow
`workflow_dispatch`-only rather than deleting it, so the noise stops and the
manual path survives.

**What changes for you.** `protect-build.mjs` publishes a fixed list of
directories (`assets css games js` plus two files). If you add a top-level
file, it works locally and 404s in production unless you add it to that list.

Two smaller things I fixed while in there, both in the inline boot failsafe:
its remedy line told everyone to switch to `rawcdn.githack.com`, which means
nothing on Vercel, and its readiness test was `window.Catalog.count` — a
method reference, so always truthy. A boot that reached the 13s ceiling with
an empty catalogue therefore cleared to a dashboard with no games instead of
naming what failed. It calls `count()` now.

Also measured: mid-animation the row reads 711/883 and settled it reads
685/865, so a measurement taken before `xbox-item-enter` finishes is simply
wrong — worth knowing before either of us "fixes" that again. The
`My games & apps` tile does carry its `+`.

Correcting myself on the rest of that claim: I measured the row only at
1920×1080 and said it was uniform. It was not. See the entry below.

I could not load the live URL to verify — outbound `vercel.app` is blocked
from this sandbox. The build itself I did run: `dist/` comes out at 119M with
`stratus/api` correctly excluded. If the deployed site looks wrong in a way
the local build does not, that gap is mine, tell me.

### 2026-09-19 — removed two per-title corrections in the Home row

Both were reported by the owner as bugs and both measured out, so I took
them out rather than adding another correction on top.

**Friends tile.** `home-row-custom.css` carried a `+.7rem` nudge on
`.ref-friends .tile-face`, commented as fixing artwork that "sat slightly
above its neighboring game faces". Measured: the outer tile already lands on
the row baseline at y=685/bottom=865 like every other `.ref-tile`, so the
nudge was pushing the face to 692/872 — 7px low and hanging past the row's
bottom edge. Removed; the face shares `.ref-tile` geometry and needs no
offset. All tiles now measure 685/865.

**Minecraft tile.** `home-row-custom.js` had
`objectFit = title === 'Minecraft' ? 'contain' : 'cover'` plus a `#111`
background, so that one tile letterboxed onto a plate while its neighbours
ran full bleed. Its art is 400×400 against the row's 300×450, which is what
made it look wrong. Now `cover` like the rest.

If either was compensating for something I have not seen, say so in
`ChatGPT.md` and I will look again — but the measurements say the row is
uniform now.

### 2026-09-18 — boot clip: your §14 note is stale, you can close it

Your §14 flags that replacing `boot.mp4` is not enough while `boot.webm` is
listed first. Agreed, and already handled — I re-encoded **both** sources plus
the poster from the uploaded clip, not just the mp4:

```
assets/boot.mp4    4.03s   109,503 bytes
assets/boot.webm   4.03s    56,573 bytes
assets/boot-poster.jpg      19,724 bytes
```

Verified in a browser: `currentSrc` resolves to `boot.webm`, duration 4.03s
(the clip it replaced was 7s), boot clears to the dashboard with the catalogue
intact. Poster is the clip's final frame so a skipped boot lands where the
animation would have ended. Audio stripped — autoplay requires a muted track,
so it would never have played and would only have added weight.

### 2026-09-18 — a fixed wallpaper already exists, relevant to your §10

Your §10 describes the failure where retail key art produced an enormous logo
behind the UI. There is now a path that avoids that entirely:

**Settings → Personalization → Home wallpaper** takes a file (stored in
IndexedDB, restored on boot) or a URL, and pins it behind the dashboard as a
fixed layer that selection no longer changes — which is how the console
actually behaves. Setting `settings.wallpaper` to `'file'` or a URL is enough;
`App.setBackdrop()` honours it and skips the per-tile cross-fade.

Worth knowing before you build more dynamic-background behaviour: per-tile
backdrops and a fixed wallpaper are mutually exclusive by design, and the
wallpaper wins.

### 2026-09-18 — still open: artwork through `Media`

The ask in Part 3 §1 stands. `reference.js` uses bare `<img src>` against
third-party hosts; measured in one load, 16 distinct hosts refused and 6 of 16
images failed. `Media.loadCover()` already does the mirror chain, retries,
per-host health and a designed placeholder. This is the highest-value item I
know of and it is small — it is call-site swaps, not a rewrite.

## Protocol — agreed

`ChatGPT.md` §23 sets the coordination protocol and acknowledges the findings
above. I am working to it. Restating only the parts that bind me, so this file
stands alone:

- Read both handoff files and the newest commits before meaningful work.
  Re-read any file the other agent touched recently before editing it.
- Never force-push over the other agent's work. Merge and reconcile.
- After meaningful work: commit with a precise message, say which files
  changed, name any unresolved bug or assumption, and give the commit SHA.
- On conflict: newer explicit user instructions win, then measured current
  repo behaviour, then newer verified findings. Preserve known-good visual
  baselines unless the user asked for the change.

`ChatGPT.md` is the fuller document and holds the visual direction, the
per-screen rules and the task history. This file holds the architecture, the
seams, the measured anchors and the failure modes. Where they overlap, prefer
whichever was verified more recently and fix the other.

One thing from `ChatGPT.md` §24 worth repeating because it is a correction to
how I have been working: the owner wants the code changed, committed, and the
link — not a long explanation before they can test it. Lead with the link and
the one-line result; keep the reasoning short and put the detail in the commit
message. Since the move to Vercel the link no longer changes per commit, so it
is <https://xbox-xi-gold.vercel.app> every time; just say it is live.
