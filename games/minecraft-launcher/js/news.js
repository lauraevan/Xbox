/* ============================================================
   news.js — real Minecraft "mail": news + patch notes
   Pulls live from Mojang's official launcher content API.
   These endpoints are public and CORS-enabled, so they load
   directly in the visitor's browser (e.g. when hosted on githack).
   ============================================================ */
(function () {
  "use strict";

  var API = "https://launchercontent.mojang.com";
  var NEWS_URL = API + "/news.json";
  var PATCH_URL = API + "/v2/javaPatchNotes.json";
  var PLACEHOLDER = "assets/placeholders/news.svg";

  function abs(url) {
    if (!url) return PLACEHOLDER;
    return /^https?:\/\//.test(url) ? url : API + url;
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- Play-page news cards ---------- */
  var FALLBACK_NEWS = [
    { cat: "Minecraft: Java Edition", title: "Latest news couldn't load — showing placeholder", img: PLACEHOLDER, link: "https://www.minecraft.net/en-us/article" },
    { cat: "Minecraft", title: "Real Minecraft mail appears here when online", img: PLACEHOLDER, link: "https://www.minecraft.net/en-us/article" },
    { cat: "Minecraft", title: "Patch notes & news are fetched live from Mojang", img: PLACEHOLDER, link: "https://www.minecraft.net/en-us/article" }
  ];

  function renderNewsCards(items) {
    var row = document.getElementById("newsRow");
    if (!row) return;
    row.innerHTML = "";
    items.slice(0, 3).forEach(function (it) {
      var card = el("div", "news-card");
      var img = el("img", "nc-img");
      img.src = it.img;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { img.src = PLACEHOLDER; };
      var body = el("div", "nc-body",
        '<div class="nc-cat">' + esc(it.cat) + '</div>' +
        '<div class="nc-title">' + esc(it.title) + '</div>');
      card.appendChild(img);
      card.appendChild(body);
      card.addEventListener("click", function () {
        if (it.link) window.open(it.link, "_blank", "noopener");
      });
      row.appendChild(card);
    });
  }

  function loadNews() {
    fetch(NEWS_URL, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var entries = (data && data.entries) || [];
        var mapped = entries.map(function (e) {
          var pi = e.playPageImage || e.newsPageImage || {};
          return {
            cat: e.category || (e.newsType && e.newsType[0]) || "Minecraft",
            title: e.title || "",
            img: abs(pi.url),
            link: e.readMoreLink || "https://www.minecraft.net/en-us/article"
          };
        });
        renderNewsCards(mapped.length ? mapped : FALLBACK_NEWS);
      })
      .catch(function () { renderNewsCards(FALLBACK_NEWS); });
  }

  /* ---------- Patch notes tab ---------- */
  function renderPatch(entries) {
    var list = document.getElementById("patchList");
    if (!list) return;
    list.innerHTML = "";
    if (!entries || !entries.length) {
      list.appendChild(el("div", "patch-loading",
        "Couldn't reach Minecraft patch notes right now. They'll show here when online."));
      return;
    }
    entries.slice(0, 25).forEach(function (e) {
      var item = el("div", "patch-item");
      var img = el("img");
      img.src = abs(e.image && e.image.url);
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { img.src = PLACEHOLDER; };
      var isSnap = (e.type || "").toLowerCase() === "snapshot";
      var body = el("div", "pi-body",
        '<div class="pi-type' + (isSnap ? " snapshot" : "") + '">' + esc(e.type || "release") + '</div>' +
        '<div class="pi-title">' + esc(e.title || e.version) + '</div>' +
        '<div class="pi-ver">' + esc(e.version || "") + '</div>');
      item.appendChild(img);
      item.appendChild(body);
      item.addEventListener("click", function () {
        window.open("https://www.minecraft.net/en-us/article/minecraft-" +
          encodeURIComponent((e.version || "").replace(/\s+/g, "-")), "_blank", "noopener");
      });
      list.appendChild(item);
    });
  }

  var patchLoaded = false;
  function loadPatch() {
    if (patchLoaded) return;
    patchLoaded = true;
    fetch(PATCH_URL, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { renderPatch((data && data.entries) || []); })
      .catch(function () { patchLoaded = false; renderPatch(null); });
  }

  /* expose for launcher.js (patch notes loads lazily when tab opens) */
  window.McNews = { loadNews: loadNews, loadPatch: loadPatch };

  document.addEventListener("DOMContentLoaded", loadNews);
})();

/* The screenshot-matching pages are isolated in their own files so the core
   launcher and its loading screen stay untouched while Claude and ChatGPT
   iterate on the replica together. */
(function () {
  "use strict";
  function loadReferencePages() {
    if (!document.querySelector('link[data-reference-pages]')) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'css/reference-pages.css';
      css.setAttribute('data-reference-pages', '');
      document.head.appendChild(css);
    }
    if (!document.querySelector('script[data-reference-pages]')) {
      var js = document.createElement('script');
      js.src = 'js/reference-pages.js';
      js.defer = true;
      js.setAttribute('data-reference-pages', '');
      document.body.appendChild(js);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadReferencePages);
  else loadReferencePages();
})();
