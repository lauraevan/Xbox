# Xbox Stratus v1

This directory vendors the Stratus source into the Xbox project.

## Runtime

- The Xbox browser continues to call only `/api/stratus`.
- `/api/stratus` can prefer a separately deployed copy of this vendored backend through `STRATUS_PRIMARY_API_BASE`.
- If session creation on that primary backend fails, the gateway falls back to `https://stratus-api-2.onrender.com`.
- The client pins queue/start/ping/quit to the upstream that created the session.
- API credentials remain server-side.

## Hosting

The full backend in `stratus/api/api.js` is a persistent Express/WebSocket service with in-memory session state and background work. It should run on a persistent Node/Bun host rather than inside a short-lived Vercel function.

## v1 copy notes

Source, configuration, catalogue, docs, and web UI files are vendored here. Binary archive/image files are not duplicated because they are not source code. The upstream mail-provider helper is also not duplicated in this v1; the existing Render backend remains the working fallback for that path.
