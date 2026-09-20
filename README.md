# Xbox — web dashboard

A console dashboard rebuilt for the browser: the system bar, the tile rail,
the guide overlay, spatial focus, controller input, achievements, a 743-title
catalogue streamed straight from the CDN, and cloud titles streamed through
Stratus.

Runs from static files in development — open `index.html` and it works. Production
goes out through a build step (`npm run build`) that Vercel runs for you.

## Play it now

**[▶ Launch the dashboard](https://xbox-xi-gold.vercel.app)**

```
https://xbox-xi-gold.vercel.app
```

That address always serves the newest commit on
`claude/xbox-web-replica-v4s0jk`: Vercel's GitHub integration picks up every
push, runs `npm run build`, and publishes `dist/`. Nothing to re-copy after a
push — reload the same link.

### Why not githack any more

githack served the repository tree directly, which was fine while this was a
pile of static files. It cannot host the backend. `/api/stratus` is a
serverless function that keeps the Stratus API key server-side, and a static
file host has nowhere to run it. githack also rate-limits: this page pulls
more than twenty scripts, and once the host started throttling, one script
failed to arrive and the boot screen never cleared.

### Deployment shape

| Piece | Where it runs |
| --- | --- |
| Dashboard | Vercel static, built from `dist/` by `scripts/protect-build.mjs` |
| `/api/stratus` | Vercel serverless function (`api/stratus.js`) |
| Stratus backend | a persistent host — Vercel functions are too short-lived |
| Catalogue and covers | jsDelivr at runtime, nothing vendored |

`vercel.json` sets `buildCommand: npm run build` and `outputDirectory: dist`.
`api/` is picked up by Vercel independently of the static output, so the
function ships even though the build never copies it into `dist/`.

---

## Controls

| Action | Keyboard | Controller |
| --- | --- | --- |
| Move focus | Arrows / WASD | D-pad or left stick |
| Select | Enter / Space | A |
| Back | Esc / Backspace | B |
| Search | X | X |
| Pin / unpin | Y | Y |
| Switch view | Tab / Shift+Tab | RB / LB |
| Game details | M | Menu |
| Achievements | V | View |
| Guide | G / Home | Guide |

Focus moves by **geometry**, not DOM order, so a grid behaves like a console
grid: pressing right picks the nearest tile to the right, weighting cross-axis
drift so rows and columns stay coherent. Mouse and touch work too.

## What's in it

- **Home** — dynamic backdrop that crossfades to whatever is focused, a hero
  tile for your last-played game, pinned and recommended tiles, spotlight cards.
- **My games & apps** — the full catalogue, filterable by recently played,
  pinned, ports, Flash, emulators and apps. Long lists page in as you scroll.
- **Game Pass** — a featured spotlight plus shelves built from the manifest's
  own tags, including per-studio rows.
- **Search** — an on-screen console keyboard with live results, driveable
  entirely from a controller.
- **Settings** — accent colour, light/dark theme, dynamic background, sounds,
  reduced motion, CRT overlay, 24-hour clock, gamertag and profile reset.
- **Guide** — slides in over anything, including a running game: profile,
  recently played, parties, achievements, capture, notifications, power.
- **Achievements** — 14 of them, with the slide-in toast and a Gamerscore that
  persists.
- **Store** — a console-style storefront with an icon rail, gallery and
  product pages, mounted separately from the five core views.
- **Launching** — a boot splash, then the game runs in a sandboxed iframe.
  The guide still works on top of it; B quits back to the dashboard.

### Console behaviour

Multiple profiles with per-profile state, Quick Resume, a captures gallery,
screen-time limits, content blocks by category, night mode on a schedule, an
idle HUD, a time drawer, button remapping, and accessibility passes for
colour-vision filters, text scaling, high contrast and reduced transparency.

### The neutral canvas

With nothing selected, Home runs the Xbox Series X|S Waves wallpaper behind the
dashboard, and cross-fades a game's key art over it once a tile is focused. The
clip is vendored, not hotlinked, at 1080p and 720p — the smaller pair is served
to phones and tablets. It is never fetched at all under reduced motion,
Save-Data, a 2g connection, under 4 GB of device memory, or when a fixed
wallpaper is set, and every failure path lands on a still poster rather than an
empty frame.

Profile, pins, recents, playtime, achievements and settings persist to
`localStorage`; captures and a custom wallpaper live in IndexedDB. The console
remembers you between visits.

## Data

The catalogue is fetched at runtime from the CDN — nothing is vendored here:

- Manifest — `cdn.jsdelivr.net/gh/bestsabplayerox/assets@main/zones.json`
- Covers — `cdn.jsdelivr.net/gh/bestsabplayerox/covers@main/`
- Games — `cdn.jsdelivr.net/gh/bestsabplayerox/html@master/`

The manifest ships `{COVER_URL}` and `{HTML_URL}` placeholders, which
`catalog.js` expands. Every asset also carries a `raw.githubusercontent.com`
fallback, so covers, backdrops and the manifest itself recover on networks that
block jsDelivr. If both hosts fail, the dashboard says so instead of sitting
empty.

Flagship key art and the Waves wallpaper are **vendored** under `assets/`
rather than hotlinked, so they do not depend on a third-party host staying
reachable.

## Stratus

Cloud titles come from Stratus. The integration goes deeper than a catalogue
drop-in: purchased licences are surfaced first in the library, and sessions are
created, started, kept alive and quit from the dashboard itself.

The browser never sees the API key. Requests go

```
browser  ->  /api/stratus  (Vercel function)  ->  Stratus API
```

`api/stratus.js` reads the credential from the environment only, returns a
clean 503 when it is not configured, and fails over to a secondary upstream on
a retryable status. The backend is vendored under `stratus/` for reference and
is deliberately excluded from the published build — see below.

## Layout

The UI is authored against a 1920×1080 canvas:

```css
:root { font-size: min(100vw / 192, 100vh / 108); }
```

`1rem` = 10px at 1080p, so every size in the stylesheets reads as "pixels at
1080p" and the whole dashboard scales to any panel. Below 760px it reflows for
a phone.

```
index.html       load order is load-bearing; see below
api/             Vercel serverless functions (Stratus gateway)
assets/          boot clip, Waves wallpaper, vendored key art, icon licence
stratus/         vendored Stratus backend, not published to the web build
scripts/         protect-build.mjs, the production build
css/             22 stylesheets: tokens and TV scaling, then themes and passes
js/              31 scripts, loaded in order
```

### Base modules, then passes

Load order matters. The base modules own the data and the first render:

```
icons  media  features  artwork  catalog  state  audio  nav  views
console-pages  stratus  stratus-backend-pass  store  cloud-library
guide  reference  personalization  app
```

| Module | Owns |
| --- | --- |
| `catalog` | manifest loading, mirrors, queries |
| `media` | cover loading: mirror chain, bounded queue, retries, host health |
| `state` | profiles, pins, recents, achievements, settings |
| `nav` | spatial focus engine, gamepad and keyboard input |
| `stratus` | the cloud catalogue and session lifecycle |
| `app` | boot, routing, backdrop, detail page, launching |

Everything after `app` is a **pass** — a layer that augments what already
exists rather than replacing it. Passes wrap rather than rewrite, attach
through the `nav:*` event seam, and fail soft: a pass that cannot do its job
must leave the dashboard working.

A consequence worth knowing before adding a 32nd script: these load
sequentially and later ones patch earlier ones, so one failing to arrive leaves
a *half-patched* app rather than a clean failure. An inline failsafe in
`index.html` clears the boot screen after 13s and names the missing modules.

## Boot screen

The startup clip is treated as optional decoration, so a weak connection never
leaves you on a buffering screen:

| Guard | Behaviour |
| --- | --- |
| Ready budget | 2.5s to become playable, else fall back to the still |
| Stall grace | 1.2s to recover mid-play, else fall back |
| Hard cap | 10s ceiling on the boot screen, whatever happens |
| Save-Data | never fetches the clip at all |
| Reduced motion | never fetches the clip at all |

The poster is the clip's **final** frame, so a skipped boot lands exactly where
the animation would have ended rather than cutting from an unrelated image. The
manifest loads in parallel with the clip and is capped at 9s, so a dead network
surfaces a message instead of hanging.

Encoded weight: 118 KB (H.264) / 97 KB (VP9) / 18 KB poster. Audio is stripped —
autoplay requires a muted track anyway, so it was 65 KB of dead weight.

## Icons

[Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons),
MIT licensed, © Microsoft Corporation — the same system icon family Microsoft
ships across its own products. 27 of them are vendored into `js/icons.js` as
path data; the licence is at `assets/FLUENT-ICONS-LICENSE.txt`.

## Notes

The profile avatar is generated procedurally from a seed, and the UI sounds are
synthesised at runtime rather than sampled. Game cover art and the games
themselves belong to their respective developers and load from the CDN above at
runtime — the manifest credits each developer, and the detail page links to
them.

To run it locally, use a static server (`python3 -m http.server`) rather than
`file://`, so the catalogue fetch isn't blocked by CORS.


## License and production protection

The original Xbox project code is proprietary and covered by the root
`LICENSE`. Third-party material keeps its own license or permission.

Production deployments use `scripts/protect-build.mjs`. Vercel publishes a
separate `dist/` artifact instead of serving the repository tree directly.
Selected project-specific JavaScript is obfuscated with source maps disabled,
and server-side Stratus source under `stratus/api` is not copied into the
public static deployment.

Obfuscation is a deterrent, not a substitute for keeping secrets and sensitive
server logic off the client. API credentials remain server-side.
