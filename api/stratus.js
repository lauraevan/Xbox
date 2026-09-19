const { Readable } = require("node:stream");

/* Xbox Stratus v1 gateway.
   browser -> /api/stratus -> configured vendored Stratus deployment -> Render fallback

   The full Stratus source is vendored under /stratus. Because that backend is
   persistent (Express + WebSockets + in-memory sessions), deploy /stratus/api
   to a persistent Node/Bun host and put its URL in STRATUS_PRIMARY_API_BASE.
   If no primary is configured, the existing Render backend remains active. */
const RENDER_FALLBACK = "https://stratus-api-2.onrender.com";

const PRIMARY_BASE = String(
  process.env.STRATUS_PRIMARY_API_BASE ||
  process.env.STRATUS_API_BASE ||
  ""
).replace(/\/$/, "");

const PRIMARY_KEY =
  process.env.STRATUS_PRIMARY_API_KEY ||
  process.env.STRATUS_API_KEY ||
  process.env.EMBER_CLOUD_API_KEY ||
  "";

const RENDER_KEY =
  process.env.STRATUS_RENDER_API_KEY ||
  process.env.STRATUS_FALLBACK_API_KEY ||
  process.env.STRATUS_API_KEY ||
  process.env.EMBER_CLOUD_API_KEY ||
  "";

const UPSTREAMS = [
  PRIMARY_BASE ? { id:"primary", base:PRIMARY_BASE, key:PRIMARY_KEY } : null,
  { id:"render", base:RENDER_FALLBACK, key:RENDER_KEY }
].filter(Boolean).filter((row,index,rows) =>
  rows.findIndex(other => other.base === row.base) === index
);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-expose-headers": "x-stratus-upstream, x-stratus-embed-base, x-stratus-fallback",
  "cache-control": "no-store"
};

function applyHeaders(res){
  for (const [name,value] of Object.entries(CORS)) res.setHeader(name,value);
}

function sendJson(res,status,body){
  applyHeaders(res);
  res.statusCode=status;
  res.setHeader("content-type","application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function bodyOf(req){
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);
  let raw="";
  for await (const chunk of req) raw+=chunk;
  return raw ? JSON.parse(raw) : {};
}

async function relay(res,response,type,upstream,fallback=false){
  applyHeaders(res);
  res.statusCode=response.status;
  res.setHeader("x-stratus-upstream",upstream.id);
  res.setHeader("x-stratus-embed-base",upstream.base);
  res.setHeader("x-stratus-fallback",fallback ? "1" : "0");
  res.setHeader(
    "content-type",
    type || response.headers.get("content-type") || "application/json"
  );

  if (!response.body) return res.end(await response.text());
  try{
    Readable.fromWeb(response.body).pipe(res);
  }catch{
    res.end(Buffer.from(await response.arrayBuffer()));
  }
}

function selected(req){
  const id=String(req.query?.upstream || "").trim().toLowerCase();
  return id ? UPSTREAMS.find(row => row.id === id) || null : null;
}

function candidates(req,action){
  const pinned=selected(req);
  if (pinned) return [pinned];
  return action === "create" ? UPSTREAMS : UPSTREAMS.slice(0,1);
}

function retryable(status){
  return [401,403,404,405,408,429,500,502,503,504].includes(status);
}

async function callUpstream(req,action,path,options={}){
  const rows=candidates(req,action);
  if (!rows.length) throw new Error("No Stratus upstream is configured.");

  let lastError=null;
  for (let i=0;i<rows.length;i++){
    const upstream=rows[i];

    if (!upstream.key){
      lastError=new Error(`Missing API key for ${upstream.id} Stratus upstream.`);
      continue;
    }

    try{
      const response=await fetch(upstream.base+path,{
        ...options,
        headers:{
          ...(options.headers || {}),
          "x-api-key":upstream.key
        },
        cache:"no-store"
      });

      const hasNext=i < rows.length-1;
      if (action === "create" && hasNext && retryable(response.status)){
        lastError=new Error(
          `${upstream.id} Stratus upstream returned ${response.status}`
        );
        continue;
      }

      return {response,upstream,fallback:i > 0};
    }catch(error){
      lastError=error;
      if (action !== "create" || i === rows.length-1) throw error;
    }
  }

  throw lastError || new Error("All Stratus upstreams failed.");
}

module.exports=async function handler(req,res){
  applyHeaders(res);

  if (req.method === "OPTIONS"){
    res.statusCode=204;
    return res.end();
  }

  const action=String(req.query?.action || "");

  try{
    if (action === "queue"){
      const uuid=String(req.query?.uuid || "");
      if (!uuid) return sendJson(res,400,{error:"Missing uuid."});

      const {response,upstream,fallback}=await callUpstream(
        req,
        action,
        `/cloud/v1/getQueue?uuid=${encodeURIComponent(uuid)}`,
        {headers:{"content-type":"application/json"}}
      );
      return relay(res,response,"application/json",upstream,fallback);
    }

    const routes={
      create:"/cloud/v1/createSession",
      start:"/cloud/v1/startGame",
      ping:"/cloud/v1/pingSession",
      quit:"/cloud/v1/quitSession"
    };

    const path=routes[action];
    if (!path) return sendJson(res,400,{error:"Unknown action."});
    if (req.method !== "POST")
      return sendJson(res,405,{error:"POST required."});

    const {response,upstream,fallback}=await callUpstream(req,action,path,{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(await bodyOf(req))
    });

    return relay(
      res,
      response,
      action === "create" ? "application/x-ndjson" : "application/json",
      upstream,
      fallback
    );
  }catch(error){
    return sendJson(res,502,{
      error:error?.message || "Stratus proxy request failed."
    });
  }
};
