# Xbox Stratus v1

The Stratus code vendored in this directory comes from:

`evanjeffrey1212-eng/stratus-api`

Xbox does **not** depend on `lauraevan/stratus-api`.

## Runtime

- The Xbox browser talks only to `/api/stratus`.
- `/api/stratus` can use a separately deployed copy of the vendored Stratus backend through `STRATUS_PRIMARY_API_BASE`.
- If the primary source fails, the gateway falls back to `https://stratus-api-2.onrender.com`.
- Existing `EMBER_CLOUD_API_KEY` deployments are accepted as a server-side alias for the Stratus API credential.
- This alias does not add an Ember repo dependency or send browser traffic to an Ember repository.
- The client pins queue/start/ping/quit and the embed to the upstream that created the session.
- API credentials remain server-side.

## Hosting

The backend in `stratus/api/api.js` is a persistent Express/WebSocket service with in-memory session state and background work. It should run on a persistent Node/Bun host rather than inside a short-lived Vercel function.

## v1 copy notes

The unused Stratus website/docs `src` directory has been removed from the Xbox copy. Binary archive/image files are not duplicated because they are not needed by the Xbox integration. The existing Render deployment remains the fallback transport.
