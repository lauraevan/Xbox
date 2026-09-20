const ORIGIN = "https://nowgg.fun";

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.end(body);
}

function cleanPath(value) {
  const raw = Array.isArray(value) ? value[0] : String(value || "");
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  while (decoded.startsWith("/")) decoded = decoded.slice(1);
  if (decoded.includes("\0")) throw new Error("Invalid path");
  return "/" + decoded;
}

function targetUrl(req) {
  const target = new URL(cleanPath(req.query?.path), ORIGIN);

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      for (const item of value) target.searchParams.append(key, String(item));
    } else if (value != null) {
      target.searchParams.set(key, String(value));
    }
  }

  if (target.origin !== ORIGIN) throw new Error("Blocked origin");
  return target;
}

function rewriteText(input, contentType) {
  let text = String(input || "");

  text = text
    .split("https://nowgg.fun").join("/nowgg")
    .split("http://nowgg.fun").join("/nowgg")
    .split('src="/').join('src="/nowgg/')
    .split("src='/").join("src='/nowgg/")
    .split('href="/').join('href="/nowgg/')
    .split("href='/").join("href='/nowgg/")
    .split('action="/').join('action="/nowgg/')
    .split("action='/").join("action='/nowgg/")
    .split('poster="/').join('poster="/nowgg/')
    .split("poster='/").join("poster='/nowgg/")
    .split("url(/").join("url(/nowgg/");

  if (contentType.includes("text/html")) {
    const bridge = [
      "<script>",
      "(()=>{",
      "const P='/nowgg';",
      "const fix=u=>{if(typeof u!=='string')return u;if(u.startsWith('https://nowgg.fun'))return P+u.slice('https://nowgg.fun'.length);if(u.startsWith('http://nowgg.fun'))return P+u.slice('http://nowgg.fun'.length);if(u.startsWith('/')&&!u.startsWith('/nowgg/'))return P+u;return u;};",
      "const nf=window.fetch.bind(window);",
      "window.fetch=(input,init)=>{if(typeof input==='string')return nf(fix(input),init);if(input instanceof Request){const next=fix(input.url);if(next!==input.url)input=new Request(next,input);}return nf(input,init);};",
      "const no=XMLHttpRequest.prototype.open;",
      "XMLHttpRequest.prototype.open=function(method,url,...rest){return no.call(this,method,fix(url),...rest);};",
      "})();",
      "</script>"
    ].join("");

    const lower = text.toLowerCase();
    const headEnd = lower.indexOf("<head>");
    if (headEnd >= 0) {
      text = text.slice(0, headEnd + 6) + bridge + text.slice(headEnd + 6);
    } else {
      text = bridge + text;
    }
  }

  return text;
}

export default async function handler(req, res) {
  let target;
  try {
    target = targetUrl(req);
  } catch {
    return send(res, 400, "Invalid nowgg.fun path");
  }

  const method = String(req.method || "GET").toUpperCase();
  const headers = {
    "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
    "accept": req.headers.accept || "*/*",
    "accept-language": req.headers["accept-language"] || "en-US,en;q=0.9",
    "referer": ORIGIN + "/"
  };

  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (req.headers.range) headers.range = req.headers.range;

  let body;
  if (method !== "GET" && method !== "HEAD" && req.body != null) {
    body = Buffer.isBuffer(req.body) || typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store"
    });
  } catch (error) {
    return send(res, 502, "nowgg.fun proxy error: " + (error?.message || "request failed"));
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (!location) {
      res.statusCode = upstream.status;
      return res.end();
    }

    let next;
    try { next = new URL(location, target); }
    catch { return send(res, 502, "Invalid nowgg.fun redirect"); }

    if (next.origin !== ORIGIN) {
      return send(res, 502, "Blocked redirect outside https://nowgg.fun");
    }

    res.statusCode = upstream.status;
    res.setHeader("location", "/nowgg" + next.pathname + next.search + next.hash);
    return res.end();
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  res.statusCode = upstream.status;
  res.setHeader("content-type", contentType);
  res.setHeader("x-nowgg-proxy", "nowgg.fun");
  res.setHeader(
    "cache-control",
    contentType.includes("text/html") || contentType.includes("application/json")
      ? "no-store"
      : "public, s-maxage=3600, stale-while-revalidate=86400"
  );

  const contentRange = upstream.headers.get("content-range");
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (contentRange) res.setHeader("content-range", contentRange);
  if (acceptRanges) res.setHeader("accept-ranges", acceptRanges);

  if (method === "HEAD") return res.end();

  if (
    contentType.includes("text/html") ||
    contentType.includes("text/css") ||
    contentType.includes("javascript") ||
    contentType.includes("application/json")
  ) {
    return res.end(rewriteText(await upstream.text(), contentType));
  }

  return res.end(Buffer.from(await upstream.arrayBuffer()));
}
