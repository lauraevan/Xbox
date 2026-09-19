# Xbox — web dashboard

A console dashboard rebuilt for the browser: the system bar, the tile rail,
the guide overlay, spatial focus, controller input, achievements, and a
743-title catalogue streamed straight from the CDN.

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
- **Launching** — a boot splash, then the game runs in a sandboxed iframe.
  The guide still works on top of it; B quits back to the dashboard.

Profile, pins, recents, playtime, achievements and settings persist to
`localStorage`, so the console remembers you between visits.

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

## Layout

The UI is authored against a 1920×1080 canvas:

```css
:root { font-size: min(100vw / 192, 100vh / 108); }
```

`1rem` = 10px at 1080p, so every size in the stylesheets reads as "pixels at
1080p" and the whole dashboard scales to any panel. Below 760px it reflows for
a phone.

```
index.html
assets/          boot clip (mp4 + webm), poster, favicon, icon licence
css/   base      tokens, TV scaling, boot sequence
       chrome    system bar, guide, toasts, modals
       home      hero, tile rail, spotlight cards
       pages     library, Game Pass, search, settings, detail, player
js/    icons     Fluent icon path data
       catalog   manifest loading, mirrors, queries
       state     profile, pins, recents, achievements, settings
       audio     UI sounds, synthesised with WebAudio
       nav       spatial focus engine, gamepad and keyboard input
       views     the five main screens
       guide     the guide overlay
       app       boot, routing, backdrop, detail page, launching
```

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
