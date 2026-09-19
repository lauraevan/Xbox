const { Readable } = require("node:stream");

/* Ported from synapseubg/src/routes/api/public/ember.ts. Keep the upstream
   and action map aligned with Synapse, but never copy its credential into
   this public repository. Vercel supplies that value at runtime. */
const SYNAPSE_STRATUS_BASE = "https://stratus-api-2.onrender.com";
const configuredBase = process.env.EMBER_CLOUD_API_URL || process.env.STRATUS_API_BASE || "";
const API_BASE = configuredBase.includes("stratus-api-2.onrender.com")
  ? configuredBase.replace(/\/$/, "")
  : SYNAPSE_STRATUS_BASE;
const API_KEY = process.env.STRATUS_API_KEY || process.env.EMBER_CLOUD_API_KEY || "";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store"
};

function applyHeaders(res) {
  for (const [name, value] of Object.entries(CORS)) res.setHeader(name, value);
}

function sendJson(res, status, body) {
  applyHeaders(res);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function relay(res, upstream, type) {
  applyHeaders(res);
  res.statusCode = upstream.status;
  res.setHeader("content-type", type || upstream.headers.get("content-type") || "application/json");
  if (!upstream.body) return res.end(await upstream.text());
  try {
    Readable.fromWeb(upstream.body).pipe(res);
  } catch {
    res.end(Buffer.from(await upstream.arrayBuffer()));
  }
}

module.exports = async function handler(req, res) {
  applyHeaders(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (!API_KEY) return sendJson(res, 503, { error: "Stratus server credential is not configured." });

  const action = String(req.query?.action || "");
  const headers = { "content-type": "application/json", "x-api-key": API_KEY };

  try {
    if (action === "queue") {
      const uuid = String(req.query?.uuid || "");
      if (!uuid) return sendJson(res, 400, { error: "Missing uuid." });
      const upstream = await fetch(`${API_BASE}/cloud/v1/getQueue?uuid=${encodeURIComponent(uuid)}`, {
        headers,
        cache: "no-store"
      });
      return relay(res, upstream, "application/json");
    }

    const routes = {
      create: "/cloud/v1/createSession",
      start: "/cloud/v1/startGame",
      ping: "/cloud/v1/pingSession",
      quit: "/cloud/v1/quitSession"
    };
    const path = routes[action];
    if (!path) return sendJson(res, 400, { error: "Unknown action." });
    if (req.method !== "POST") return sendJson(res, 405, { error: "POST required." });

    const upstream = await fetch(API_BASE + path, {
      method: "POST",
      headers,
      body: JSON.stringify(await bodyOf(req)),
      cache: "no-store"
    });

    return relay(res, upstream, action === "create" ? "application/x-ndjson" : "application/json");
  } catch (error) {
    return sendJson(res, 502, { error: error?.message || "Stratus proxy request failed." });
  }
};
