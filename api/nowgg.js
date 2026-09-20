const ROOT_ORIGIN = "https://nowgg.fun";

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

function relayPrefix(req) {
  const raw = Array.isArray(req.query?.ip) ? req.query.ip[0] : String(req.query?.ip || "").trim();
  if (!raw) return "";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 255 || String(value) !== raw) {
    throw new Error("Invalid relay prefix");
  }
  return raw;
}

function upstreamOrigin(prefix) {
  return prefix ? `https://${prefix}.ip.nowgg.fun` : ROOT_ORIGIN;
}

function targetUrl(req, prefix) {
  const origin = upstreamOrigin(prefix);
  const target = new URL(cleanPath(req.query?.path), origin);

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "path" || key === "ip") continue;
    if (Array.isArray(value)) {
      for (const item of value) target.searchParams.append(key, String(item));
    } else if (value != null) {
      target.searchParams.set(key, String(value));
    }
  }

  if (target.origin !== origin) throw new Error("Blocked origin");
  return target;
}

function rewriteLauncherRedirect(text) {
  const oldTarget = 'https://${sessionStorage.getItem("prefix")}.ip.${window.location.host}${window.location.pathname}';
  const newTarget = '/nowgg-ip/${sessionStorage.getItem("prefix")}${window.location.pathname.startsWith("/nowgg/") ? window.location.pathname.slice(6) : window.location.pathname}';
  return text.split(oldTarget).join(newTarget);
}

function forwardCookies(upstream, res) {
  let cookies = [];
  const getter = upstream.headers.getSetCookie;

  if (typeof getter === "function") {
    try { cookies = getter.call(upstream.headers) || []; } catch {}
  }

  if (!cookies.length) {
    const single = upstream.headers.get("set-cookie");
    if (single) cookies = [single];
  }

  if (!cookies.length) return;

  const safe = cookies.map(cookie => String(cookie)
    .replace(/;\s*Domain=[^;]+/ig, "")
    .replace(/;\s*Path=\/[^;]*/ig, "; Path=/")
  );

  res.setHeader("set-cookie", safe);
}

function rewriteText(input, contentType, prefix) {
  let text = String(input || "");
  const origin = upstreamOrigin(prefix);
  const basePath = prefix ? `/nowgg-ip/${prefix}` : "/nowgg";

  text = text
    .split(origin).join(basePath)
    .split(ROOT_ORIGIN).join("/nowgg")
    .split('src="/').join(`src="${basePath}/`)
    .split("src='/").join(`src='${basePath}/`)
    .split('href="/').join(`href="${basePath}/`)
    .split("href='/").join(`href='${basePath}/`)
    .split('action="/').join(`action="${basePath}/`)
    .split("action='/").join(`action='${basePath}/`)
    .split('poster="/').join(`poster="${basePath}/`)
    .split("poster='/").join(`poster='${basePath}/`)
    .split("url(/").join(`url(${basePath}/`);

  if (!prefix) text = rewriteLauncherRedirect(text);

  if (contentType.includes("text/html")) {
    const bridge = [
      "<script>",
      "(()=>{",
      `const P=${JSON.stringify(basePath)};`,
      `const O=${JSON.stringify(origin)};`,
      "const fix=u=>{if(typeof u!=='string')return u;if(u.startsWith(O))return P+u.slice(O.length);if(u.startsWith('https://nowgg.fun'))return '/nowgg'+u.slice('https://nowgg.fun'.length);if(u.startsWith('/')&&!u.startsWith('/nowgg/')&&!u.startsWith('/nowgg-ip/'))return P+u;return u;};",
      "const nf=window.fetch.bind(window);",
      "window.fetch=(input,init)=>{if(typeof input==='string')return nf(fix(input),init);if(input instanceof Request){const next=fix(input.url);if(next!==input.url)input=new Request(next,input);}return nf(input,init);};",
      "const no=XMLHttpRequest.prototype.open;",
      "XMLHttpRequest.prototype.open=function(method,url,...rest){return no.call(this,method,fix(url),...rest);};",
      "})();",
      "</script>"
    ].join("");

    const lower = text.toLowerCase();
    const headTag = lower.indexOf("<head>");
    if (headTag >= 0) {
      text = text.slice(0, headTag + 6) + bridge + text.slice(headTag + 6);
    } else {
      text = bridge + text;
    }
  }

  return text;
}

export default async function handler(req, res) {
  let prefix;
  let target;
  try {
    prefix = relayPrefix(req);
    target = targetUrl(req, prefix);
  } catch {
    return send(res, 400, "Invalid nowgg.fun path");
  }

  const method = String(req.method || "GET").toUpperCase();
  const origin = upstreamOrigin(prefix);
  const headers = {
    "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
    "accept": req.headers.accept || "*/*",
    "accept-language": req.headers["accept-language"] || "en-US,en;q=0.9",
    "referer": origin + "/",
    "origin": origin
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

    const allowedHosts = new Set(["nowgg.fun"]);
    if (prefix) allowedHosts.add(`${prefix}.ip.nowgg.fun`);
    if (!allowedHosts.has(next.hostname)) {
      return send(res, 502, "Blocked redirect outside nowgg.fun");
    }

    const nextPrefix = next.hostname === "nowgg.fun" ? "" : prefix;
    const localBase = nextPrefix ? `/nowgg-ip/${nextPrefix}` : "/nowgg";
    res.statusCode = upstream.status;
    res.setHeader("location", localBase + next.pathname + next.search + next.hash);
    return res.end();
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  res.statusCode = upstream.status;
  res.setHeader("content-type", contentType);
  res.setHeader("x-nowgg-proxy", prefix ? `${prefix}.ip.nowgg.fun` : "nowgg.fun");
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
  forwardCookies(upstream, res);

  if (method === "HEAD") return res.end();

  if (
    contentType.includes("text/html") ||
    contentType.includes("text/css") ||
    contentType.includes("javascript") ||
    contentType.includes("application/json")
  ) {
    return res.end(rewriteText(await upstream.text(), contentType, prefix));
  }

  return res.end(Buffer.from(await upstream.arrayBuffer()));
}
