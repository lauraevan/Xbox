# ChatGPT.md — Xbox Web Replica Project Handoff

This file is the working memory / handoff document for ChatGPT and any other coding agent collaborating on this repository. It captures the decisions, architecture, visual rules, debugging lessons, known-good commits, and user preferences established across the long **“Compare Xbox UI Replicas”** thread and follow-up work.

The project is not a generic game dashboard. It is intended to feel as close as practical to the **real modern Xbox Series X|S dashboard UI** in a browser, while preserving the existing repo architecture and functionality.

---

## 1. Project identity

- Repository: `lauraevan/Xbox`
- Main working branch used in the long replica thread: `claude/xbox-web-replica-v4s0jk`
- Project type: static browser application, no build step, no package manager required.
- Primary entrypoint: `index.html`
- Runtime is plain HTML/CSS/JavaScript.
- The user frequently tests through RawGitHack / RawCDN GitHack.
- The app is authored around a 1920×1080 console canvas using a root scaling system where roughly `1rem = 10px` at 1080p.

### Current baseline

The user explicitly asked to restore the project to the UI state represented by:

`a4d92866c5f99b13dd2de4f535a9edb89882e0fa`

That tree was restored in:

`9bf7cbec1e2997f33e87350ecf1299c6e91b778f`

At the time this file was created, all application files should be treated as matching the `a4d9286...` snapshot unless a later change was intentionally made. This `ChatGPT.md` file itself is additional documentation and is not part of that historical snapshot.

If the project starts drifting badly, compare against `a4d92866c5f99b13dd2de4f535a9edb89882e0fa` before making broad changes.

---

## 2. Non-negotiable visual direction

The user has repeatedly corrected the project when it becomes “a gaming dashboard inspired by Xbox” instead of an Xbox replica.

### Always preserve

- Real Xbox-like spacing, geometry, hierarchy, and proportions.
- Real game artwork where possible.
- Rounded game tiles, especially the Home row.
- Dark, restrained Xbox surfaces.
- Green only where Xbox-like focus/selection treatment calls for it.
- Calm, minimal visual treatment.
- Functional controller-like focus behavior.
- Mobile/iPad usability where possible without destroying desktop fidelity.

### Avoid

- Invented UI not present in the reference screenshots.
- Random outlines around every game.
- Neon/glow-heavy design.
- Excessive gradients.
- Generic “AI gaming dashboard” styling.
- Emoji placeholders.
- Decorative effects that were not asked for.
- Rebuilding the app from scratch when a targeted patch is enough.
- Replacing a working Xbox-specific design with generic Material or web-app components.

The user has specifically called out “AI slop” when the UI starts adding design flourishes that are not in the Xbox reference.

When unsure, prefer **less** UI, fewer effects, and closer adherence to the screenshots.

---

## 3. Repo structure and architecture

Top-level layout:

```
index.html
README.md
manifest.webmanifest
assets/
css/
games/
js/
```

### Important JavaScript files

- `js/app.js`
  - Main boot sequence
  - View switching
  - Global app behavior
  - Dynamic wallpaper/backdrop
  - Launching games
  - Player surface
  - Clock/battery setup
  - Catalogue boot synchronization

- `js/views.js`
  - Base renderers for main screens

- `js/reference.js`
  - Critical Xbox Home/Guide reference pass
  - Defines the photographed-reference Home row and lower cards
  - Pins Home-critical artwork to known sources
  - Forces initial focus to the first Home hero tile
  - Tunes Guide rows/tabs to match the Xbox reference

- `js/home-row-custom.js`
  - Post-render Home game-row corrections
  - Handles custom game swaps / direct launch behavior
  - Reorders played titles
  - Adds My games & apps mosaic tile
  - Integrates selected Home titles with Stratus/local launch logic

- `js/home-catalog-pass.js`
  - Adds the expanded lower Home catalogue below the main photographed viewport
  - Includes additional store/catalog rows and Xbox Waves section

- `js/nav.js`
  - Spatial focus engine
  - Keyboard/controller navigation
  - Focus ring geometry
  - This is important to the console feel

- `js/state.js`
  - Persistent state, profile, settings, recents, pins, achievements, etc.

- `js/catalog.js`
  - Loads the large games catalogue / manifest
  - Resolves cover and game URLs

- `js/artwork.js`
  - Artwork resolution / hero lookup support

- `js/store.js`
  - Base Store implementation

- `js/store-console-pass.js`
  - Xbox-console-specific Store refinements

- `js/console-pages.js`
  - Console-styled secondary pages

- `js/library-minimal-pass.js`
  - My games & apps selection behavior
  - Replaces immediate launch with a small Xbox-style game action menu

- `js/profile-sidebar.js`
  - Makes the top profile area open the Guide/profile panel on click/tap/controller activation

- `js/minecraft-local-pass.js`
  - Special local Minecraft launcher integration

- `js/stratus.js`
  - Stratus cloud catalogue/session integration

- `js/stratus-backend-pass.js`
  - Transport/backend proxy pass for Stratus

- `js/boot-preload-pass.js`
  - Holds boot long enough to warm the dashboard under it
  - Prevents a half-painted Home frame from being exposed

- `js/time-drawer.js`
  - Clock/weather drawer

- `js/idle-hud.js`
  - Xbox-like idle time/status HUD

- `js/flagship-launch-pass.js`
  - Launch/detail refinements

### Important CSS files

- `css/base.css` — global tokens, scaling, boot, generic cover behavior
- `css/chrome.css` — top bar, Guide, modal, focus chrome
- `css/home.css` — base Home layout
- `css/reference.css` — photographed-reference Home geometry
- `css/rounding-pass.css` — larger/rounder Xbox tiles
- `css/home-row-custom.css` — custom Home row refinements
- `css/reference-2026-theme.css` — darker 2026 reference treatment
- `css/library-minimal-pass.css` — minimal My games & apps behavior/appearance
- `css/store.css` — Store
- `css/store-console-pass.css` — console Store refinements
- `css/console-pages.css` — secondary pages
- `css/darker-theme.css` — darker system chrome
- `css/alignment-pass.css` — alignment corrections
- `css/home-catalog-pass.css` — extended lower Home content + Waves
- `css/time-drawer.css` — time/weather panel
- `css/idle-hud.css` — idle status UI
- `css/flagship-pages-pass.css` — final secondary page / launch polish

### Local game content

`games/minecraft-launcher/`

contains the vendored Minecraft launcher integration.

---

## 4. Script/load-order warning

This project has accumulated many “pass” files over time. Later files often intentionally override earlier files.

Before changing a visual bug, inspect **load order in `index.html`**.

A common failure mode is:
1. base renderer creates DOM,
2. one patch modifies it,
3. a later script or renderer rebuilds/overrides it,
4. the earlier fix appears to “do nothing.”

Do not assume a CSS or image URL fix is wrong until you confirm that the target DOM survives after all scripts run.

When debugging Home specifically:
- inspect `reference.js` first,
- then `home-row-custom.js`,
- then any later Home-related passes,
- then CSS order.

---

## 5. Home screen

The Home screen is the most visually sensitive part of the project.

### Reference renderer

`js/reference.js` owns the main photographed-reference Home layout by replacing `Views.renderHome`.

The renderer creates:

- a top game rail (`.ref-strip`)
- the first game as a larger hero tile
- smaller following game tiles
- Friends & community tile
- lower cards including Browse the store and promotional cards
- reference-specific Guide tuning
- initial Home backdrop
- initial focus anchoring

### Historical reference-row content

The original reference row used titles such as:

- Forza Horizon 5
- Subnautica 2
- Hollow Knight: Silksong
- Microsoft Edge
- Mortal Kombat 1
- Roblox
- Fortnite

Later customization swapped several entries for titles such as GTA V, Elden Ring, Red Dead Redemption 2, and Minecraft. The restored `a4d9286` baseline determines the exact active combination.

Do not casually rewrite the row list. The user wants it to track the desired Xbox reference state.

### Home artwork lesson

One of the most important old-chat fixes was commit:

`8b61ed8ad5cc12d0935e15bc7b06a9e89fe5f534`

Commit message:

> Pin real Xbox artwork and restore Forza Home composition

The key lesson from that fix:

**Home-critical artwork should not depend on a runtime artwork search API.**

That commit changed the Home reference renderer so known artwork URLs were used immediately, while SteamGridDB became fallback-only.

This fixed a black/blank placeholder failure when the artwork API/host was blocked or unavailable.

When Home game covers disappear:
- verify the current renderer’s `ART` map / pinned sources,
- verify the image actually receives `src`,
- verify the renderer itself is active,
- verify GitHack is serving the latest commit,
- verify a later script is not rebuilding the row.

Do not immediately add multiple redundant background-image hacks before checking the renderer and network/load order.

### Home focus

The intended startup focus is the first hero tile, historically Forza Horizon 5.

The reference code intentionally re-anchors focus after boot so stale focus state does not open Home on a lower card.

---

## 6. Game tile sizing / rounding

The user specifically asked for:
- bigger game tiles,
- more rounded corners,
- proportions closer to the Xbox screenshots.

A known commit associated with this correction is:

`4067015...`

The user reacted positively after this change and said it was much closer.

Do not shrink the tiles back toward generic web-card proportions.

---

## 7. Top five-button system capsule

The five small system buttons at the top should read as a **single connected dark/black capsule**.

The buttons themselves are circular controls within the capsule, with breathing room.

Important:
- do not make them look like five detached cards,
- do not fill every focused control with a giant green block,
- use a restrained Xbox-like focus treatment.

Known commit associated with this work:

`c91307e...`

---

## 8. Profile area

The profile area should be visually dark/black.

Requested gamertag:

`xboxtest`

The profile row should include the gamer picture and text but remain very dark and clean.

Known commit associated with this change:

`00db154...`

The profile area should open the Profile/Guide panel on controller, mouse, and touch. `profile-sidebar.js` exists specifically to ensure this works on iPad/touch as well as the navigation layer.

---

## 9. Focus / selection treatment

There are two related but different treatments.

### Game selection

Selected game tiles can use the recognizable Xbox green selection/focus ring.

### Other controls

Top-system controls, profile, menu rows, etc. should use a smaller, shape-following green outline/focus treatment.

Do **not** turn every focused element into a large green rectangle.

The user explicitly disliked that.

The shared floating focus ring is intentionally limited to contexts where it visually makes sense.

---

## 10. Dynamic Home background

The user requested that selecting/focusing a game changes the dashboard background to appropriate artwork for that title.

Known commit associated with this behavior:

`7bd0587...`

The background should feel like the Xbox dashboard:
- broad artwork,
- dim enough for UI readability,
- not oversaturated,
- not logo-heavy unless the reference actually shows it.

A previous issue used Forza retail key art as the wallpaper and produced an enormous FORZA logo behind the UI. The reference renderer separates tile cover art from a cleaner Forza wallpaper/hero image to avoid that.

---

## 11. My games & apps

The user gave very specific requirements for the My games & apps page.

### Visual rules

- Background: solid `#070707`
- No gradients
- No decorative lines
- No game-name text under every tile
- Exactly one horizontal row in the intended minimal view
- Subtle hover lift / brightness increase
- Clean, Xbox-like spacing

### Selecting a game

Selecting a game cover should open a small Xbox-style action flyout rather than immediately launching.

The intended actions are:

- Play game
- Pin to Quick Guide
- Manage game and add-ons
- Add to Home

This behavior lives in `js/library-minimal-pass.js`.

The action menu should stay compact and Xbox-like.

---

## 12. Store

The Store should feel like a full Xbox Store, not an eight-game demo.

Historical requests included:
- substantially more games,
- multiple rows,
- real artwork,
- Xbox-like category/promo treatment,
- acquisitions becoming Owned,
- Owned games showing in My games & apps.

Store/library work was spread across commits including:

- `1470815...`
- `9672b9a...`
- `005c8fe...`
- `568cab6...`

There is also a later My games & apps/library implementation around:

`8a2ac5f...`

These short hashes are historical waypoints, not necessarily the current tree.

---

## 13. Xbox Waves / lower Home catalogue

The project grew a lower Home section below the main photographed viewport.

`home-catalog-pass.js/css` adds this extended content without intentionally changing the above-the-fold reference composition.

A later high-quality Xbox Waves background implementation was associated with:

`9030e849db659e1589ddc499803b8933740d75dc`

That implementation used higher-quality background media / fallback logic so the lower section looked more like Xbox rather than a generated CSS approximation.

If editing the lower Home section, preserve the photographed Home viewport above it.

---

## 14. Boot sequence

### Current historical boot architecture

The baseline uses:

- `assets/boot.webm`
- `assets/boot.mp4`
- `assets/boot-poster.jpg`
- `js/app.js` boot logic
- `js/boot-preload-pass.js` warm-up layer

In the restored snapshot, `index.html` places WebM before MP4, so browsers that support WebM will usually choose the WebM first.

### app.js boot behavior

The boot video is treated as optional decoration and has safeguards:

- ~2.5 second ready/playable budget
- ~1.2 second stall grace
- ~10 second hard cap
- reduced-motion / Save-Data paths can skip video
- catalogue loads in parallel
- boot fades out before the stage is revealed

### boot-preload-pass.js

This file intentionally intercepts removal of the boot element long enough to:
- warm the catalogue,
- render Home underneath,
- wait for fonts,
- wait briefly for images,
- warm hero artwork,
- give layout/decode a couple of frames,
- then release the boot screen.

This exists because showing Home too early exposed a half-painted dashboard.

### Current user-requested boot replacement

The user uploaded a new startup clip immediately before this documentation request.

The uploaded clip is approximately:
- 4.05 seconds
- H.264 MP4
- AAC audio

The user wants this **exact new startup screen** used.

Important implementation note:
simply replacing `boot.mp4` is not enough while `boot.webm` is still listed first.

When implementing the new clip:
1. ensure the browser actually selects the new MP4,
2. remove or reorder the old WebM source,
3. preserve the rest of the dashboard,
4. keep full clip timing rather than cutting the ending,
5. account for autoplay audio restrictions on iPad/Safari.

The earlier attempt to stage a boot video was explicitly reverted. Do not resurrect partial staging files.

---

## 15. RawGitHack / RawCDN workflow

The user frequently asks for a new GitHack link immediately after commits.

### Preferred testing patterns

Pinned development link:

`https://raw.githack.com/lauraevan/Xbox/<COMMIT>/index.html`

Cached production-style link:

`https://rawcdn.githack.com/lauraevan/Xbox/<COMMIT>/index.html`

### Important behavior

RawGitHack can rate-limit or serve stale/cached behavior in ways that make debugging confusing.

The README notes that RawCDN is generally more reliable for the multi-file app.

If the user says “same issue” after a fix:
- confirm the exact commit in the URL,
- compare raw.githack vs rawcdn.githack,
- consider cache behavior,
- do not assume the patch failed purely from one cached preview.

When giving the user a preview after a code change, pin it to the exact new commit SHA.

---

## 16. Catalogue and data model

The base project uses a large games manifest and remote assets.

README-documented sources include:

- manifest from the `bestsabplayerox/assets` GitHub/CDN source
- covers from the `bestsabplayerox/covers` source
- playable HTML from the `bestsabplayerox/html` source

The catalogue system expands URL placeholders and has mirror/fallback behavior.

The project supports hundreds of titles, historically around 742–743 depending on the state of the manifest/reference.

Do not hardcode the whole catalogue into Home just to make the Store look fuller.

---

## 17. Navigation model

This is a console-style app.

Navigation is spatial/geometry-based, not simple DOM-order tabbing.

Expected inputs:
- keyboard arrows / WASD
- Enter / Space
- Esc / Backspace
- gamepad D-pad / stick
- A/B/X/Y
- guide/menu/view buttons
- mouse
- touch/iPad

Any UI added to the project should be compatible with the existing `data-nav` / `_navActivate` conventions where appropriate.

Do not fix touch support by bypassing controller navigation in a way that breaks controller behavior.

---

## 18. Persistence

The app stores substantial state in `localStorage`.

Examples include:
- profile
- settings
- pins
- recents
- playtime
- achievements
- Stratus ownership
- Home played order
- Quick Guide pins

When debugging behavior that “won’t reset,” remember old localStorage may be influencing the result.

The Home row can also reorder based on recent launches.

---

## 19. Minecraft special integration

Minecraft is not treated exactly like every other catalogue title.

`js/minecraft-local-pass.js` points Minecraft to the local vendored launcher under:

`games/minecraft-launcher/`

It also patches:
- Minecraft cover/hero artwork
- Home tile launch behavior
- launch splash
- My games & apps mosaic behavior

If Minecraft artwork or launch behavior differs from other titles, inspect this file before changing shared code.

---

## 20. Stratus Cloud history and warning

This section is important because several Stratus approaches were tried.

The desired base concept has been:

browser → trusted backend proxy → Stratus API

rather than putting secrets directly into the static frontend.

The current restored code contains:
- `js/stratus.js`
- `js/stratus-backend-pass.js`

and references:

`https://stratus-api-2.onrender.com`

along with backend proxy routes.

### Historical flow explored

The integration work has involved concepts such as:

`createSession → queue → startGame → embed`

plus:
- heartbeat/ping
- quit
- ownership
- session status
- Stratus catalogue
- iframe/WebRTC playback

### Critical warning

A later direct Stratus integration was made in:

`22945473b9ab754d779ed83fe2bf45911574559d`

The user explicitly rejected that implementation and asked for it removed.

It was reverted in:

`fd91d7af483d632a0cbf21fbe3caf7a19fb6250b`

Therefore:

**Do not blindly restore commit `2294547...` or reproduce that exact approach.**

If the user asks to fix/rebuild Stratus, first inspect the current known architecture and ask/derive what specifically should behave differently. Preserve the user’s rejection of that old direct implementation.

---

## 21. Known-good / notable commits from the long thread

These are useful forensic checkpoints.

- `8b61ed8ad5cc12d0935e15bc7b06a9e89fe5f534`
  - pinned real Xbox artwork
  - avoided runtime-art API dependency for Home
  - restored Forza Home composition
  - default focus correction

- `9ee86a5ba0a923955b962987d8a6f397290073e2`
  - cleaner scenic wallpaper
  - aligned status/nav
  - wider game rail
  - resized tiles/Friends/Store
  - improved BlizzCon art

- `4067015...`
  - larger, rounder game tiles

- `c91307e...`
  - connected black top-five-button capsule

- `00db154...`
  - black profile treatment / xboxtest era

- `7bd0587...`
  - dynamic game background behavior / Store-related work

- `1470815...`, `9672b9a...`, `005c8fe...`, `568cab6...`
  - Store/library expansion work

- `8a2ac5f...`
  - later My games & apps implementation

- `9030e849db659e1589ddc499803b8933740d75dc`
  - high-quality Xbox Waves background / fallback state

- `22945473b9ab754d779ed83fe2bf45911574559d`
  - rejected Stratus direct integration

- `fd91d7af483d632a0cbf21fbe3caf7a19fb6250b`
  - revert of rejected Stratus direct integration

- `a4d92866c5f99b13dd2de4f535a9edb89882e0fa`
  - user-selected restore target / current visual baseline

- `9bf7cbec1e2997f33e87350ecf1299c6e91b778f`
  - commit that restored the tree to `a4d9286...`

Some older waypoints are only available as short hashes because that is how they were referenced during the thread.

---

## 22. Failed debugging path to remember

A recurring recent issue was the main Home game row appearing blank/invisible while the green focus box was still visible.

Several attempted fixes tried:
- forcing `img` visibility,
- recreating missing image nodes,
- adding background images directly to tile surfaces,
- duplicating local cover assignments.

Those changes did not solve the user-visible result before the user chose to restore to `a4d9286...`.

The better lesson from the old successful artwork fix is:

1. verify which renderer actually creates the row,
2. verify pinned artwork at creation time,
3. verify the script runs and survives later render passes,
4. verify GitHack is loading the intended commit,
5. only then modify lower-level CSS/image layering.

Do not pile multiple “force visible” patches onto the restored baseline without isolating the real cause first.

---

## 23. Collaboration workflow

The user intends ChatGPT and Claude to work on this project together through the repository.

### Claude ↔ ChatGPT protocol

This is not a direct private-message channel. The shared coordination surface is the GitHub branch, especially `CLAUDE.md`, `ChatGPT.md`, and the commit history.

Before any meaningful task:
1. Read the latest `CLAUDE.md`.
2. Read the latest `ChatGPT.md`.
3. Read the newest commits on the working branch.
4. If the other agent touched the same file recently, re-read that file before editing.
5. Never force-push over the other agent's work.

After meaningful work:
- commit the code with a precise message,
- update the relevant handoff note if there is something the other agent needs to know,
- state which files changed,
- state any unresolved bug or assumption,
- include the exact commit SHA.

Use the handoff files for **facts, architecture, current task state, pitfalls, and unresolved questions**, not long conversational transcripts.

### Conflict rule

If `CLAUDE.md` and `ChatGPT.md` disagree:
- explicit newer user instructions win,
- measured/current repo behavior wins over stale documentation,
- newer verified findings win over older assumptions,
- preserve known-good visual baselines unless the user explicitly requests a change.

Do not silently overwrite the other agent's recent work. Reconcile it.

### Current Claude findings ChatGPT has acknowledged

Claude documented several important measured/current facts that should be treated as shared project knowledge:

- The authored canvas is 1920×1080 and `1rem = 10px` at 1080p.
- The Home reference has measured anchors, including x=100 safe margin, nav around y=120, profile around y=240, selected carousel tile around y=640, and card row around y=890.
- Pass files should generally wrap existing APIs/renderers rather than rewriting them.
- The supported integration seams include `nav:focus`, `nav:button`, `nav:activate`, `nav:move`, and `nav:padconnected`.
- `MutationObserver` + `requestAnimationFrame` is the preferred way to attach behavior to renderer-owned DOM.
- A failing pass should fail soft and leave the app functional.
- Hotlinked artwork is currently unreliable in practice. Claude measured many third-party hosts refusing requests. Prefer the project's `Media` pipeline for catalogue imagery when feasible.
- The inline 13-second boot failsafe in `index.html` is intentional and should not be removed.
- Multiple agents have previously diverged badly on this branch, so re-reading latest commits before edits is mandatory.

### Working style

When changing code:
- keep commits small and clearly named,
- avoid massive rewrites unless explicitly requested,
- inspect what Claude changed before overwriting shared areas,
- prefer additive, reversible patches,
- preserve the user-selected baseline when uncertain.

Do not treat either handoff file as more authoritative than an explicit newer user instruction.

---

## Mailbox — messages to Claude

Newest first. Short notes only; detail belongs in the commit.

### 2026-09-18 — launcher Share control visual refinement

Commit: `de164b5d0d6379c52eb1985120a1467343375bde`

The launcher preview Share control is now icon-only. Replaced the previous filled share glyph with Microsoft Fluent Share iOS 24 regular (outline/up-arrow-from-box style), removed visible "Share" text, and restyled the control as a compact circular dark-glass button in the top-right. Native Web Share + clipboard fallback behavior remains unchanged; aria-label/title remain for accessibility.


### 2026-09-18 — real Xbox Series notification + game-select sounds

Commit: `c276722ad8c9c51ac75a21d918259c3edd9d6ac6`

User supplied two Xbox Series UI sounds. Added local assets at `assets/audio/xbox-series-select.mp3` and `assets/audio/xbox-series-notification.mp3`. `js/audio.js` now routes normal toast notifications and achievement notifications through the supplied notification clip, respecting the existing Sounds toggle and UI volume. Added `Sound.gameSelect()` using the supplied select clip. `js/home-row-custom.js` plays it immediately when a Home game is selected and the launcher/preview begins opening, before async catalogue/artwork work.


### 2026-09-18 — functional Share button in launcher preview

Commit: `02ea690b1c1594db2e21e60577fbe9c50d7605fa`

Added a top-right Share button to the Home game preview/launcher card. It uses the official Fluent share_24_filled icon added to `js/icons.js`, invokes `navigator.share({ title, text, url })` on supported devices, and falls back to copying the current launcher URL to the clipboard. Styling is scoped to `.home-game-preview-share`; top-bar/dashboard geometry is untouched.


### 2026-09-18 — launcher preview description fix

Commit: `b5dd459afede4bca7a1ff33659e79608c36c48d8`

The Home game preview/launcher card now renders the actual Stratus game description between the title and metadata chips. It falls back to a short local library sentence only if no description field exists. CSS clamps the copy to three lines so the existing hero + cover + facts + Start/Exit geometry stays intact.


### 2026-09-18 — boot greeting position/color correction

Commit: `c3c9d0a81b3d5ba3ee8d94e0ae88bfef016462fc`

User corrected the greeting reference: it belongs much lower on screen and the whole greeting surface is Xbox green. Updated `.boot-greeting` to a solid `#107c10` card near the bottom center, removed the dark-glass treatment and green edge stripe, and kept touch safe-area spacing. Size remains intentionally tiny.


### 2026-09-18 — post-boot greeting timing cleanup

Commit: `9707adad21b040206facdd84f02cd950b0415f3b`

The compact Xbox-green signed-in greeting now appears 720ms after Home is revealed, which is after the 600ms boot fade and 620ms boot-node removal. The older “Ready to play / N titles” startup toast was removed so the greeting is the only post-boot message.


### 2026-09-18 — tiny post-boot Xbox profile greeting

Commit: `3e4a09b9cca95d0b951fcdbd7ff7f90355516b29`

After a successful boot, Home now shows a small floating Xbox-style greeting about 260 ms after the dashboard appears. It reads “Hello, Xboxtest” for the project’s default profile name; if the user has replaced the old default gamertag with a custom one, the custom name is used instead.

UI details:
- compact dark translucent pill,
- thin Xbox-green left edge,
- small green Xbox mark,
- centered near the top of Home,
- non-interactive and auto-dismisses after ~2.3 seconds,
- reduced-motion mode skips the slide transform,
- touch uses safe-area-aware top positioning.

The existing “Ready to play” catalogue toast was moved later (3.3 s) so it does not collide with the greeting.


### 2026-09-18 — Settings app functional rework

Commit: `950076a5ec3b90e12c26811a1a4c4b31d58a7f24`

Reworked the console Settings renderer instead of adding another pass.

Major changes:
- Removed fake/dead rows whose only behavior was firing informational toasts.
- Sidebar is now General, Account, Personalization, Display & sound, Network, Controller & devices, Cloud gaming, Accessibility, System.
- Read-only device/network/system information now renders as non-interactive rows/status cards instead of fake buttons.
- Functional controls are wired to existing persistent State settings: startup animation, 24-hour clock, navigation sounds, UI volume, mic state, theme, accent, dynamic backgrounds, wallpaper, saturation, Home details, tile badges, text scale, safe area, night mode/strength, scanlines, controller button mapping/deadzone/vibration, high contrast, motion, transparency and color filters.
- Account actions use the existing real profile/gamertag/avatar flows.
- Network test now updates inline status rather than spraying toasts.
- Controller page detects the live Gamepad and can attempt a real vibration test.
- Cloud page exposes actual library/session actions only; user-facing provider label is Xbox Cloud.
- System page shows viewport/display mode/browser storage and has real reload/reset actions.
- Settings CSS now distinguishes live controls, read-only information, section headings and status cards.

Source syntax was checked after commit.


### 2026-09-18 — outdated pinned-build warning

Commit: `8f39578f06a49c1a4c20fe38c73a49aac7d0d191`

Pinned RawGitHack builds now parse their own 40-character commit SHA and compare it against the current branch head through the GitHub commits API. If the pinned SHA is no longer latest, a full-screen Xbox-style dialog says “This version of XBOX is outdated” with a Continue button. The current/latest SHA does not show the dialog. Branch/live URLs without a pinned SHA are ignored. If GitHub is unreachable, the check fails open and never blocks the dashboard.

Important limitation: historical commit hashes created before this code are immutable and cannot be retroactively changed to contain the warning. Every pinned build containing this check will self-mark outdated once a newer commit lands.


### 2026-09-18 — Microsoft Store deals expansion

Commits:
- `1cf837212e3a97da7c843e9f2a82958544048930` adds Xbox-style Deals & specials UI.
- `bbca93f2d0369c6d8e99f26ce5f0b2f54a1886ce` fixes deal currency formatting.

Changes:
- Store Home gets a featured Deals & specials mosaic with one large promo and four smaller deal tiles.
- Deterministic replica sale metadata supplies SAVE 20–70% badges and crossed-out / discounted prices.
- Dedicated Deals & specials rail mode added; cards in that mode show deal pricing.
- Product pages reflect the same deal price and savings strip.
- Existing Stratus catalogue, acquisition, wishlist and cloud launch behavior are unchanged.
- This is replica Store presentation, not live Microsoft Store pricing.


### 2026-09-18 — My games & apps Home plus visibility fix

Commit: `d8eb83e057062bc4a6efbf4fdec8dd93a1e68b13`

The Home My games & apps tile still created the plus element, but the two nested bar spans were not reliably visible through later Home styling. Replaced them with a self-contained CSS `::after` plus glyph and raised the overlay stacking level above the mosaic/tint. Tile geometry is unchanged.


### 2026-09-18 — local Xbox PWA icon + stronger Xbox controller support

Commits:
- `e759777f9b249038f7d2540ee61d2f79ece10f95` switches manifest/head metadata to local Xbox icon paths and upgrades `nav.js` gamepad handling.
- `c6d96dcd1685d390b46e1683ed2bfdb8c550cd59` fixes the icon-vendor workflow to render PNG sizes from the source SVG.
- `46e2e66a0c5a6425da9aeaca354a657e89b125a8` is the successful asset commit with 180/192/512 PNGs plus the source SVG.

Controller changes:
- tracks connect/disconnect and active controller index,
- detects Xbox/XInput/Microsoft IDs as an Xbox fallback when `Gamepad.mapping` is empty,
- A activates, B backs out, D-pad/left stick navigate, X/Y/LB/RB/Menu/View/Guide preserve existing nav events,
- controller already connected before page load is picked up by polling once the browser exposes it,
- connection/disconnection toasts and body controller state are emitted,
- cloud-player iframe already retains its existing `allow="gamepad"`.

PWA metadata no longer hotlinks the icon. `index.html` and `manifest.webmanifest` now reference `assets/pwa/xbox-*.png` / `xbox-logo.svg`.


### 2026-09-18 — mobile launcher actions + Home Store tile fidelity

Commit: `0620c3b135783930942c5a3e97ce1768d3c03d61`

User explicitly asked not to scale either surface.

Changes:
- Home game preview keeps the same desktop/controller geometry on coarse-pointer devices.
- Mobile no longer reflows/resizes the launcher; only the Start/Exit action row is pinned inside the panel so both controls remain tappable.
- Close label changed to Exit.
- Home Browse the store card keeps its existing grid slot and dimensions; only its system-tile visuals were refined to a flatter purple Microsoft Store treatment with centered Store icon/wordmark.
- No Home row/card scaling values were changed.


### 2026-09-18 — Home preview Note now uses Stratus GitHub descriptions

Commit: `01d00e21b302a7c00556cfac1fb64510f007c04b`

The preview's Note section now pulls only `cloud.description` from the Stratus catalogue. It no longer substitutes the local browser-game description. The full note is shown in a bounded scrollable panel so long Stratus control/loading notes fit without expanding the launcher.

Current Home matches found in Stratus: Forza Horizon 5, Grand Theft Auto V, Hollow Knight: Silksong, Elden Ring, Red Dead Redemption 2. Minecraft and Fortnite currently have no exact Stratus catalogue row, so the UI states that no Xbox Cloud note is available instead of inventing content.


### 2026-09-18 — touch top bar size correction

Commit: `a6c499edeac4f318925bf7d4964218f5b4cd8759`

The coarse-pointer pass had forced `.sysnav-btn` and `.status-btn` to a 44px minimum and enlarged their SVGs, which visibly grew the Home top bar on iPad. That override is removed. Touch activation/swipe improvements remain, and only the separate global Home-return control keeps the 44px minimum.


### 2026-09-18 — Home row now opens a game preview before launch

Commits:
- `66143b89ff82ad925493d447de3dc9049ac93e9d` adds the centered Xbox-style game preview panel.
- `3c7a940e8897aaa2843287b5b1c99a7633564b84` moves Minecraft preview art to existing local repo assets.

Behavior:
- first Home-row game tiles no longer instantly launch,
- selecting one opens a centered rounded panel inspired by the user's Xbox Store/game-info photo,
- panel shows local cover/hero art, title, Stratus/local provider info, tags, short description, and facts,
- Start calls the existing `activateTitle()` path, so cloud/local launch behavior remains single-source,
- Close, backdrop tap, and controller B dismiss the preview,
- panel is a Nav layer and has coarse-pointer/mobile layout rules.

Guide/sidebar game rows are unchanged by this request.


### 2026-09-18 — touch navigation/mobile support pass

Commit: `f1074061f4e04d46cc0fb33ebb3bafa6e042c48e`

Changed:
- `nav.js`: touch/pen pointermove no longer behaves like mouse hover during swipes; clean touch taps directly activate controller-style `[data-nav]` items instead of requiring a focus tap first. Existing direct click handlers are respected via `defaultPrevented`.
- `base.css`: coarse-pointer-only tap sizing, momentum horizontal scrolling, swipe-friendly Home/console rows, safe-area-aware Home return button, and a physically touch-sized Guide panel/tabs/rows/quick actions.
- Desktop mouse/controller geometry is intentionally unchanged because the CSS lives under `@media (hover:none), (pointer:coarse)`.

No new script/pass file was added.


### 2026-09-18 — Stratus artwork is now vendored locally

Commits:
- `e11b30897b7f16dbc20c56fecb1eb11030b598bf` adds the vendor pipeline and local-art lookup in `stratus.js`.
- `969670d618042e87c64cc47e3d9d735109f06a06` is the successful GitHub Actions asset commit.

Result:
- all 225 current Stratus catalogue entries have a local file under `assets/stratus-covers/`,
- 215 were resolved from SteamGridDB,
- 10 used the Stratus cover as a one-time vendored fallback because SteamGridDB had no usable match,
- 0 placeholders were needed,
- runtime Stratus cards now prefer the local manifest path, so client devices no longer hotlink cover art.

Workflow: `.github/workflows/vendor-stratus-art.yml`
Script: `scripts/vendor_stratus_art.py`
Manifest: `assets/stratus-covers/manifest.json`


### 2026-09-18 — non-Home Home return + Guide clock emphasis

Commit: `86d76de8935162de65231028fe23fa428650ce50`

User asked for every non-Home page to have a way back to Home, plus the real-Xbox behavior where the time gets slightly larger while the Guide/sidebar is open.

Implementation:
- `app-patch.js` adds one compact global Home control on non-Home views, mainly for touch/iPad; existing B/Escape behavior remains untouched,
- Store uses the same control and routes through the existing Store hide/show wrapper,
- `guide.js` toggles `body.guide-open` in the Guide lifecycle,
- `chrome.css` enlarges the clock only while `guide-open` is present.

Home reference layout remains untouched because the control is hidden on Home.


### 2026-09-18 — My games & apps is intentionally Stratus-only now

Commit: `e5e6c94a08bf6f625b01b05d7e64bda0a5550150`

User explicitly changed the requirement: My games & apps should contain only one row of Stratus games, with no normal catalogue games.

Implementation:
- `console-pages.js` library renderer now renders only `StratusCloud.ownedGames()`,
- Stratus posters are tagged `data-stratus-game="1"`,
- `library-minimal-pass.js` attaches the action popout only to those tagged cards,
- `cloud-library.js` skips its separate injection when the Stratus-only renderer is active,
- cards are taller portrait tiles with hover/focus title reveal,
- action flyout remains below the cover and now has a rounder outer/button radius.

Do not restore the old normal catalogue grid unless the user asks to reverse this.


### 2026-09-18 — My games & apps now uses the real library renderer

Commit: `0d4626dc33ce1ef44768e0c3e50a4264811845d6`

Root cause: `home-row-custom.js` was wiping `#view-library` and rebuilding a Stratus-only owned list whenever the Home My games & apps tile was opened. I removed that replacement path. The tile now opens the normal library renderer, which can still receive cloud ownership through `cloud-library.js`.

Also changed `library-minimal-pass.js` so the game action flyout never flips above the selected cover. It always opens downward; short viewports scroll the menu instead. CSS was tightened slightly to keep the menu compact.


### 2026-09-18 — first Guide sidebar game rows updated

User asked for the games in the first Guide/sidebar to be updated and made launchable.

Commit: `3ef6f02a8f2046a8c41a53b649a1497522b0cbd6`

Changed only `js/reference.js`:
- visible game rows are now Forza Horizon 5, Grand Theft Auto V, Hollow Knight: Silksong, and Elden Ring,
- covers use the repo-local `assets/game-art` files rather than third-party hotlinks,
- each row now rewires `_navActivate` to invoke the matching Home tile's existing launch handler,
- fallback path launches the matching catalogue game directly if the Home tile handler is unavailable.

This deliberately reuses the Home launch path so Stratus/local behavior remains single-source instead of duplicating cloud logic in the Guide.

---

## 24. User communication / testing style

The user generally wants:
- the code changed directly,
- a commit,
- then a fresh RawGitHack link.

They usually do not want a long explanation before testing.

Useful response pattern after successful changes:

```
Done ✅
<short description>
Commit: <sha>
https://raw.githack.com/lauraevan/Xbox/<sha>/index.html
```

When the user provides a screenshot and says something is wrong, visually compare the result to the reference before making assumptions.

---

## 25. Before making any major UI change

Checklist:

1. Read the relevant renderer and its later patches.
2. Check `index.html` load order.
3. Compare against `a4d9286...` if the current behavior seems unexpectedly broken.
4. Do not introduce UI absent from the Xbox reference.
5. Preserve the connected dark top capsule.
6. Preserve the black profile treatment.
7. Preserve larger rounded game tiles.
8. Keep Xbox green focused and restrained.
9. Keep My games & apps minimal and one-row where intended.
10. Test both desktop and iPad/touch implications.
11. Generate a new pinned GitHack link after committing.

---

## 26. Current next-task context at time of writing

Immediately before this file was requested, the user asked to add a **new uploaded Xbox boot/startup MP4** to the restored baseline.

That boot work had not yet been committed at the moment this documentation file was authored.

The key implementation requirement is to make the uploaded MP4 the actual startup source rather than leaving the old WebM first in the source list.

Do not accidentally alter unrelated Home/UI files while adding the boot clip.

---

## 27. Final guiding principle

When choosing between:
- “technically clever but visibly different,” and
- “simpler but matches Xbox,”

choose the second.

The project succeeds when someone can look at it and immediately feel that it is reproducing the Xbox dashboard, not merely borrowing its colors.


### 2026-09-20 — Xbox version snapshot boot notification

Current snapshot: `ms4c7q`

After every successful Xbox boot, show a compact green-and-black build notification in the **bottom-right corner** of the screen. It must have a clearly visible Xbox-green outline, rounded corners, dark black surface, and restrained Windows/Xbox styling. The notification uses the repo-local Xbox logo and reads `Xbox Version 1.5` and `Snapshot <random-code>`.

Important workflow rule:
- Every user-visible project update should receive a fresh random snapshot code.
- Report that snapshot code in chat after the update so the user can verify the newest build is loaded.
- Update the snapshot shown by the boot notification whenever the snapshot changes.
- Keep this notification in the bottom-right corner. Do not move it to the top or center it unless the user explicitly asks.


### 2026-09-20 — 2 second Microsoft credit interstitial

After the Xbox startup movie finishes, show a full-screen Microsoft credit screen for 2 seconds before revealing the dashboard. It should match the supplied reference: pure black background, centered classic four-square Microsoft mark, and white Microsoft wordmark. The dashboard remains hidden until this interstitial completes.

Keep this as a distinct boot phase:
1. Xbox startup movie
2. Microsoft credit interstitial, 2 seconds
3. Dashboard reveal
4. Existing post-boot greeting / version snapshot behavior


### 2026-09-20 — Microsoft credit logo color correction

The Microsoft credit interstitial uses the standard four-square Microsoft palette in reading order: red/orange `#F25022`, green `#7FBA00`, blue `#00A4EF`, yellow `#FFB900`. Keep the mark flat and crisp on pure black, with the white Microsoft wordmark beside it.
