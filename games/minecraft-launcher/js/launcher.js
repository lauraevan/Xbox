/* ============================================================
   launcher.js — UI behaviour for the Minecraft Launcher replica
   ============================================================ */

/* ------------------------------------------------------------
   BOOT / LOADING SCREEN
   ------------------------------------------------------------
   Full-screen splash shown while the site loads. One of the four
   gameplay clips (assets/loading/load1..4.mp4) is picked at random
   on every visit, so the background rotates each time you open the
   launcher. Dismisses once the page has loaded and a short minimum
   has elapsed, then fades out to reveal the launcher.
   ------------------------------------------------------------ */
(function () {
  "use strict";
  var loader = document.getElementById("bootLoader");
  if (!loader) return;
  var video = document.getElementById("bootVideo");
  var counter = document.getElementById("bootCounter");

  var pick = 1 + Math.floor(Math.random() * 4);
  if (video) {
    video.src = "assets/loading/load" + pick + ".mp4";
    video.muted = true;            /* muted autoplay is always allowed */
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    var tryPlay = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };
    tryPlay();
    video.addEventListener("loadeddata", tryPlay, { once: true });
    video.addEventListener("canplay", tryPlay, { once: true });
  }

  /* faint tick counter in the corner, like the real loader */
  var n = Math.floor(1200 + Math.random() * 600);
  var tick = setInterval(function () {
    n += 7;
    if (counter) counter.textContent = ("00000000" + n).slice(-8);
  }, 45);

  var MIN_MS = 6500, started = Date.now(), dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearInterval(tick);
    loader.classList.add("done");
    setTimeout(function () {
      if (video) { try { video.pause(); } catch (e) {} }
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 650);
  }
  function schedule() { setTimeout(dismiss, Math.max(0, MIN_MS - (Date.now() - started))); }
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule);
  /* hard safety net in case 'load' never fires */
  setTimeout(dismiss, 12000);
})();

(function () {
  "use strict";

  /* ------------------------------------------------------------
     GAME INTEGRATION POINT
     --------------------------------------------------------------
     The real game ("novix core 26.1.2") loads into an <iframe> when
     PLAY is pressed. GAME_URL is a LOCAL, bundled file: drop your
     82 MB build in at game/index.html (replacing the placeholder) and
     it loads same-origin — no external host, no CORS, no frame limits.
     See README ("The game") for how to add the large file + host on
     GitHub Pages (githack is unreliable for files this large).
     ------------------------------------------------------------ */
  var GAME_URL = "game/index.html";

  var LABELS = {
    home: "HOME",
    java: "MINECRAFT: JAVA EDITION",
    bedrock: "MINECRAFT: BEDROCK EDITION",
    dungeons2: "MINECRAFT DUNGEONS II",
    dungeons: "MINECRAFT DUNGEONS",
    legends: "MINECRAFT LEGENDS",
    whatsnew: "WHAT'S NEW",
    settings: "SETTINGS"
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- Per-view tabs + pages ---------------- */
  var PAGES = {
    java:      { label: "MINECRAFT: JAVA EDITION", tabs: [["play","Play"],["installations","Installations"],["realms","Realms"],["skins","Skins"],["patch","Patch Notes"]] },
    legends:   { label: "MINECRAFT LEGENDS",       tabs: [["legends-play","Play"],["_faq","FAQ"],["_install","Installation"],["_patch","Patch Notes"]] },
    dungeons:  { label: "MINECRAFT DUNGEONS",      tabs: [["dungeons-play","Play"],["_dlc","DLC"],["_faq","FAQ"],["_install","Installation"],["_patch","Patch Notes"]] },
    dungeons2: { label: "MINECRAFT DUNGEONS II",   tabs: [["dungeons2-play","Play"]] },
    settings:  { label: "SETTINGS", accent: "green", tabs: [["settings","General"],["_accounts","Accounts"],["_about","About"]] }
  };

  var tabsEl = $("#tabs");
  var scrollArea = $(".scroll-area");
  var genericView = null;

  function ensureGeneric() {
    if (!genericView) {
      genericView = document.createElement("section");
      genericView.className = "generic-panel";
      genericView.id = "genericView";
      genericView.style.display = "none";
      scrollArea.appendChild(genericView);
    }
    return genericView;
  }

  function showTab(id, label) {
    $$(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === id); });
    var real = $('.tab-panel[data-panel="' + id + '"]');
    $$(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
    if (real) {
      if (genericView) genericView.style.display = "none";
      real.classList.add("active");
    } else {
      var g = ensureGeneric();
      g.style.display = "block";
      g.innerHTML = '<h1>' + (label || "") + '</h1><p>This section is a placeholder in the replica.</p>';
    }
    if (id === "patch" && window.McNews) window.McNews.loadPatch();
    if (scrollArea) scrollArea.scrollTop = 0;
  }

  function renderTabs(view) {
    var conf = PAGES[view];
    tabsEl.classList.toggle("tabs-green", conf.accent === "green");
    tabsEl.innerHTML = "";
    conf.tabs.forEach(function (t, idx) {
      var btn = document.createElement("button");
      btn.className = "tab" + (idx === 0 ? " active" : "");
      btn.type = "button"; btn.dataset.tab = t[0]; btn.textContent = t[1];
      btn.addEventListener("click", function () { showTab(t[0], t[1]); });
      tabsEl.appendChild(btn);
    });
  }

  var contentHead = $(".content-head");

  function selectView(view) {
    $$("#primaryNav .nav-item, .nav-bottom .nav-item").forEach(function (n) {
      n.classList.toggle("active", n.dataset.view === view);
    });

    /* HOME: swap the header for the quick-launch toolbar, show the home panel */
    if (view === "home") {
      contentHead.classList.add("head-home");
      tabsEl.style.visibility = "hidden";
      $$(".tab-panel").forEach(function (p) { p.classList.remove("active"); p.style.display = "none"; });
      if (genericView) genericView.style.display = "none";
      var home = $('.tab-panel[data-panel="home"]');
      if (home) { home.style.display = "block"; home.classList.add("active"); }
      scrollArea.scrollTop = 0;
      return;
    }
    contentHead.classList.remove("head-home");
    $("#contentLabel").textContent = (PAGES[view] && PAGES[view].label) || LABELS[view] || "MINECRAFT";

    if (PAGES[view]) {
      tabsEl.style.visibility = "visible";
      $$(".tab-panel").forEach(function (p) { p.style.display = ""; });
      if (genericView) genericView.style.display = "none";
      renderTabs(view);
      showTab(PAGES[view].tabs[0][0], PAGES[view].tabs[0][1]);
    } else {
      tabsEl.style.visibility = "hidden";
      $$(".tab-panel").forEach(function (p) { p.classList.remove("active"); p.style.display = "none"; });
      var g = ensureGeneric();
      g.style.display = "block";
      g.innerHTML =
        '<h1>' + (LABELS[view] || "Minecraft") + '</h1>' +
        '<p>This section is a placeholder in the replica.<br>' +
        'The built-out pages are <b>Java Edition</b>, <b>Dungeons II</b>, <b>Dungeons</b>, <b>Legends</b> and <b>Settings</b>.</p>';
      scrollArea.scrollTop = 0;
    }
  }

  renderTabs("java"); /* wire up the initial (Java) tabs */

  $$("#primaryNav .nav-item, .nav-bottom .nav-item").forEach(function (n) {
    n.addEventListener("click", function () { selectView(n.dataset.view); });
  });

  /* ---------------- Mobile drawer ---------------- */
  var sidebar = $(".sidebar"), scrim = $("#sidebarScrim"), menuBtn = $("#menuBtn");
  function setDrawer(open) {
    if (sidebar) sidebar.classList.toggle("open", open);
    if (scrim) scrim.classList.toggle("open", open);
  }
  if (menuBtn) menuBtn.addEventListener("click", function () {
    setDrawer(!(sidebar && sidebar.classList.contains("open")));
  });
  if (scrim) scrim.addEventListener("click", function () { setDrawer(false); });
  /* close the drawer after picking a game/section on mobile */
  $$("#primaryNav .nav-item, .nav-bottom .nav-item").forEach(function (n) {
    n.addEventListener("click", function () { setDrawer(false); });
  });

  /* ---------------- PLAY -> game overlay ---------------- */
  var overlay = $("#gameOverlay");
  var frame = $("#gameFrame");
  var playBtn = $("#playBtn");
  var gameLoading = $("#gameLoading");

  function launchGame() {
    if (gameLoading) gameLoading.style.display = "flex";
    frame.src = GAME_URL;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeGame() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    frame.src = "about:blank"; /* stop the game / free resources */
    if (gameLoading) gameLoading.style.display = "flex"; /* reset for next launch */
    document.body.style.overflow = "";
  }
  if (frame) frame.addEventListener("load", function () {
    if (frame.src && frame.src.indexOf("about:blank") === -1 && gameLoading) gameLoading.style.display = "none";
  });

  /* PLAY -> preparing / downloading / launching -> game */
  var playBar = $(".play-bar");
  var playStatus = $("#playStatus");
  var playBusy = false;
  function runPlaySequence() {
    if (playBusy) return;
    if (!playBar || !playStatus) { launchGame(); return; }
    playBusy = true;
    var label = playStatus.querySelector(".ps-label");
    var pct = playStatus.querySelector(".ps-pct");
    var fill = playStatus.querySelector(".ps-bar");
    playBar.classList.add("busy");
    label.textContent = "PREPARING…"; pct.textContent = ""; fill.style.width = "0";
    setTimeout(function () {
      label.textContent = "DOWNLOADING";
      var p = 0;
      var iv = setInterval(function () {
        p += Math.random() * 17 + 9; if (p > 100) p = 100;
        fill.style.width = p + "%"; pct.textContent = Math.floor(p) + "%";
        if (p >= 100) {
          clearInterval(iv);
          setTimeout(function () {
            label.textContent = "LAUNCHING…"; pct.textContent = "";
            setTimeout(function () {
              playBar.classList.remove("busy"); playBusy = false; launchGame();
            }, 650);
          }, 240);
        }
      }, 175);
    }, 520);
  }
  if (playBtn) playBtn.addEventListener("click", runPlaySequence);
  var homePlayBtn = $("#homePlayBtn");
  if (homePlayBtn) homePlayBtn.addEventListener("click", launchGame);
  $("#gameBack").addEventListener("click", closeGame);
  var newtab = $("#gameNewtab");
  if (newtab) newtab.addEventListener("click", function () { window.open(GAME_URL, "_blank", "noopener"); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeGame();
  });
  $$(".play-inline").forEach(function (b) { b.addEventListener("click", launchGame); });

  /* ---------------- Small niceties ---------------- */
  var copyBtn = $(".copy-btn");
  if (copyBtn) copyBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var name = "EvanEnderDragon1";
    if (navigator.clipboard) navigator.clipboard.writeText(name).catch(function () {});
    copyBtn.classList.add("copied");
    copyBtn.title = "Copied!";
    setTimeout(function () { copyBtn.classList.remove("copied"); copyBtn.title = "Copy username"; }, 1100);
  });

  var giftClose = $(".gift-close");
  if (giftClose) giftClose.addEventListener("click", function () {
    var a = $("#giftAd"); if (a) a.style.display = "none";
  });

  /* ---------------- Popup menus (account / version / quick play / kebab) ---------------- */
  var openAnchor = null;
  function closeMenus() { $$(".mc-menu").forEach(function (m) { m.parentNode && m.parentNode.removeChild(m); }); openAnchor = null; }
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".mc-menu") && !e.target.closest("[data-menu]")) closeMenus();
  });
  function openMenu(anchor, items, opts) {
    if (openAnchor === anchor) { closeMenus(); return; } /* toggle off */
    closeMenus();
    opts = opts || {};
    var m = document.createElement("div");
    m.className = "mc-menu";
    items.forEach(function (it) {
      if (it.sep) { var s = document.createElement("div"); s.className = "mc-sep"; m.appendChild(s); return; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "mc-mi" + (it.active ? " active" : "");
      b.textContent = it.label;
      b.addEventListener("click", function () { closeMenus(); if (it.onClick) it.onClick(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    var mw = m.offsetWidth, mh = m.offsetHeight;
    var left = opts.right ? r.right - mw : r.left;
    var top = opts.above ? r.top - mh - 4 : r.bottom + 4;
    left = Math.max(6, Math.min(left, window.innerWidth - mw - 6));
    top = Math.max(6, Math.min(top, window.innerHeight - mh - 6));
    m.style.left = left + "px"; m.style.top = top + "px";
    openAnchor = anchor;
  }

  var accountBtn = $(".account");
  if (accountBtn) {
    accountBtn.setAttribute("data-menu", "account");
    accountBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu(accountBtn, [
        { label: "EvanEnderDragon1", onClick: function () {} },
        { sep: true },
        { label: "Manage account", onClick: function () { window.open("https://account.microsoft.com", "_blank", "noopener"); } },
        { label: "Switch account", onClick: function () {} },
        { label: "Sign out", onClick: function () {} }
      ]);
    });
  }
  var versionSelect = $(".version-select");
  if (versionSelect) {
    versionSelect.setAttribute("data-menu", "version");
    versionSelect.addEventListener("click", function (e) {
      e.stopPropagation();
      var name = versionSelect.querySelector(".vs-name");
      var sub = versionSelect.querySelector(".vs-sub");
      function pick(n, s) { return function () { if (name) name.textContent = n; if (sub) sub.textContent = s; }; }
      openMenu(versionSelect, [
        { label: "fabric-loader-1.21.4", active: true, onClick: pick("fabric-loader-1.21.4", "fabric-loader-0.19.2-1.21.4") },
        { label: "Latest release (1.21.4)", onClick: pick("Latest release", "1.21.4") },
        { label: "Latest snapshot (25w02a)", onClick: pick("Latest snapshot", "25w02a") },
        { sep: true },
        { label: "Installations…", onClick: function () { selectView("java"); showTab("installations", "Installations"); } }
      ], { above: true });
    });
  }
  var quickPlay = $("#quickPlay");
  if (quickPlay) {
    quickPlay.setAttribute("data-menu", "quick");
    quickPlay.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu(quickPlay, [
        { label: "Quick Play latest world", onClick: runPlaySequence },
        { label: "Quick Play latest server", onClick: runPlaySequence }
      ], { above: true });
    });
  }
  var playKebab = $("#playKebab");
  if (playKebab) {
    playKebab.setAttribute("data-menu", "kebab");
    playKebab.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu(playKebab, [
        { label: "Open game directory", onClick: function () {} },
        { label: "Manage installation", onClick: function () { selectView("java"); showTab("installations", "Installations"); } },
        { label: "Duplicate", onClick: function () {} }
      ], { above: true, right: true });
    });
  }
  var heroTrailer = $(".hero-trailer");
  if (heroTrailer) heroTrailer.addEventListener("click", launchGame);

})();
