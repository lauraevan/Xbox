/* Extra launcher pages reconstructed from the supplied reference screenshots.
   Kept separate from launcher.js so Claude can continue iterating on the core
   launcher without touching the loading/boot sequence. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function realmsIslandSvg() {
    return '' +
      '<svg class="rm-island" viewBox="0 0 320 300" aria-hidden="true" shape-rendering="crispEdges">' +
      '<g transform="translate(25 22)">' +
      '<path class="dirt" d="M48 70h176v20h26v75h-18v28h-20v22h-25v22h-39v18h-35v-18H91v-22H70v-25H51z"/>' +
      '<path class="dirt2" d="M70 102h163v65h-19v34h-24v23h-35v28h-22v-39h-35v-25H78z"/>' +
      '<path class="stone" d="M113 175h99v31h-22v26h-27v25h-36v-29h-30v-27h16z"/><path class="stone2" d="M145 190h54v29h-19v24h-35z"/>' +
      '<path class="grass" d="M43 63h190v27H43z"/><path class="grass2" d="M43 85h190v10H43z"/>' +
      '<path class="water" d="M56 92h33v87H75v70H61v-69H48V92z"/><path fill="#70c8f1" d="M59 94h9v83h-9z"/>' +
      '<g transform="translate(188 47)"><rect class="portal" x="0" y="0" width="43" height="64"/><rect fill="#25152f" x="7" y="7" width="29" height="50"/><rect class="portal2" x="11" y="11" width="21" height="42"/><rect fill="#6f24b6" x="15" y="15" width="13" height="34"/></g>' +
      '<g transform="translate(92 10)"><rect class="birch" x="25" y="44" width="16" height="62"/><rect class="birchmark" x="25" y="58" width="6" height="5"/><rect class="birchmark" x="35" y="75" width="6" height="5"/><rect class="birchmark" x="25" y="91" width="6" height="5"/>' +
      '<rect class="leaf" x="0" y="16" width="65" height="29"/><rect class="leaf" x="11" y="0" width="45" height="18"/><rect class="leaf2" x="5" y="40" width="54" height="16"/></g>' +
      '<g transform="translate(63 66)"><rect class="wood" x="0" y="0" width="17" height="17"/><rect class="tiny" x="5" y="-15" width="9" height="10"/><rect class="tiny2" x="5" y="10" width="8" height="15"/></g>' +
      '<g transform="translate(157 64)"><rect class="tiny" width="10" height="12"/><rect fill="#5c3724" x="1" y="-7" width="8" height="7"/><rect fill="#586da5" x="1" y="12" width="8" height="14"/></g>' +
      '<g transform="translate(113 79)"><rect class="flower" width="5" height="5"/><rect class="flower2" x="1" y="1" width="3" height="3"/><rect fill="#398b22" x="2" y="5" width="2" height="9"/></g>' +
      '<g transform="translate(142 70)"><rect class="flower" width="5" height="5"/><rect fill="#db3852" x="1" y="1" width="3" height="3"/><rect fill="#398b22" x="2" y="5" width="2" height="9"/></g>' +
      '<rect class="grass" x="214" y="100" width="39" height="20"/><rect class="dirt" x="220" y="120" width="31" height="33"/>' +
      '</g></svg>';
  }

  function buildRealms() {
    var panel = $('.tab-panel[data-panel="realms"]');
    if (!panel) return;
    panel.innerHTML =
      '<div class="ref-realms">' +
        '<div class="rm-logo"><div class="rm-logo-minecraft">MINECRAFT</div><div class="rm-logo-realms">REALMS</div></div>' +
        '<div class="rm-tools">' +
          '<div class="rm-updated"><span class="rm-refresh">↻</span><div><b>Last Updated</b><span>Less than a minute ago</span></div></div>' +
          '<button class="rm-manage" type="button">Manage Realms&nbsp; ↗</button>' +
        '</div>' +
        '<div class="rm-hero">' +
          '<div class="rm-island-wrap">' + realmsIslandSvg() + '</div>' +
          '<div class="rm-copy"><h1>Your own server, always online</h1>' +
            '<p>Run your own Minecraft server! You set the rules: who can join and how to play. Members play for free, even when you’re offline. Easy to set up, manage, and access.</p>' +
            '<div class="rm-actions"><button class="ref-pixel-btn rm-learn" type="button">Learn more&nbsp; ↗</button><button class="ref-pixel-btn rm-trial" type="button">Free Trial</button></div>' +
          '</div>' +
        '</div>' +
        '<div class="rm-buyline">Visit&nbsp; <a class="rm-site" href="https://www.minecraft.net/realms" target="_blank" rel="noopener">Minecraft.net</a><span class="ext">↗</span>&nbsp; to purchase a Realms subscription.</div>' +
        '<div class="rm-teasers"><div class="rm-teaser"><span>PLAY TOGETHER</span></div><div class="rm-teaser"><span>ALWAYS ONLINE</span></div><div class="rm-teaser"><span>CREATOR CONTENT</span></div></div>' +
      '</div>';

    $$('.rm-learn,.rm-trial,.rm-manage', panel).forEach(function (button) {
      button.addEventListener('click', function () { window.open('https://www.minecraft.net/realms', '_blank', 'noopener'); });
    });
  }

  function doll(name, skin, hair, shirt, pants, shoe) {
    return '<div class="rs-item" title="' + name + '"><div class="rs-item-name">' + name + '</div>' +
      '<div class="skin-doll" style="--skin:' + skin + ';--hair:' + hair + ';--shirt:' + shirt + ';--pants:' + pants + ';--shoe:' + shoe + '">' +
      '<i class="sd-head"></i><i class="sd-body"></i><i class="sd-arm left"></i><i class="sd-arm right"></i><i class="sd-leg left"></i><i class="sd-leg right"></i></div></div>';
  }

  function buildSkins() {
    var panel = $('.tab-panel[data-panel="skins"]');
    if (!panel) return;
    panel.innerHTML =
      '<div class="ref-skins">' +
        '<section class="rs-current"><h2>Current</h2><div class="rs-current-stage">' +
          '<img class="rs-current-img" src="https://mc-heads.net/body/EvanEnderDragon1/220" alt="Current Minecraft skin" />' +
        '</div><button class="ref-pixel-btn green rs-add-library" type="button">Add to library</button></section>' +
        '<section class="rs-library"><h2>Library</h2><div class="rs-grid">' +
          '<div class="rs-item rs-new"><div class="rs-plus"></div><div class="rs-item-name">New skin</div></div>' +
          doll('Steve','#986a4a','#33251d','#2d9a99','#364b9b','#292b54') +
          doll('Alex','#d6a276','#b95f2c','#72935d','#5b625f','#3e3d39') +
          doll('Zuri','#7b4b35','#30211d','#9d3445','#9e8770','#5d5148') +
          doll('Sunny','#a77b55','#2e261d','#5b8d46','#4772a2','#313844') +
          doll('Noor','#74442e','#3a241b','#963423','#376f55','#273e35') +
          doll('Makena','#54382e','#211a17','#a77412','#78505b','#50383d') +
          doll('Kai','#d1a06e','#b77a3d','#513560','#392f45','#252229') +
          doll('Efe','#6e4939','#534132','#7c8f8b','#334b52','#273439') +
          doll('Ari','#d69c7c','#7b372d','#9a604a','#4a6648','#303d32') +
        '</div></section>' +
      '</div>';

    var currentImg = $('.rs-current-img', panel);
    if (currentImg) currentImg.addEventListener('error', function () {
      currentImg.style.display = 'none';
      var fallback = document.createElement('div');
      fallback.innerHTML = doll('','#a17659','#3d2d25','#7c8c6c','#446b5d','#2d3d36');
      fallback.firstChild.querySelector('.rs-item-name').style.display = 'none';
      $('.rs-current-stage', panel).appendChild(fallback.firstChild);
    }, { once:true });

    var add = $('.rs-add-library', panel);
    if (add) add.addEventListener('click', function () {
      add.textContent = 'Added to library';
      setTimeout(function () { add.textContent = 'Add to library'; }, 1200);
    });
  }

  function coinPile(hasChest, scale) {
    return '<div class="coin-pile" style="--pile-scale:' + scale + '">' +
      (hasChest ? '<span class="mc-chest"></span>' : '') +
      '<i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  }

  function packCard(amount, price, bonus, tag, blue, chest, scale) {
    return '<button class="mc-pack" type="button">' +
      (tag ? '<span class="mc-tag' + (blue ? ' deal' : '') + '">' + tag + '</span>' : '') +
      '<span class="mc-pack-art">' + coinPile(chest, scale || 1) + '</span>' +
      '<span class="mc-pack-amount">' + amount + '<span class="mc-coin">M</span></span>' +
      '<span class="mc-bonus' + (blue ? ' blue' : '') + (bonus ? '' : ' blank') + '">' + (bonus || '+ 0 Bonus!') + '</span>' +
      '<span class="mc-price"><span class="mc-price-gem"></span>$' + price + '</span></button>';
  }

  function buildMinecoins() {
    if ($('#minecoinsOverlay')) return;
    var overlay = document.createElement('div');
    overlay.className = 'minecoins-overlay';
    overlay.id = 'minecoinsOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="mc-store-top"><div class="mc-store-title">BUY MINECOINS</div><div class="mc-balance"><span class="mc-coin">M</span><span>120</span></div><button class="mc-close" type="button" aria-label="Close">×</button></div>' +
      '<main class="mc-store-body"><div class="mc-store-inner">' +
        '<h1 class="mc-store-heading">DO MORE WITH MINECOINS</h1>' +
        '<p class="mc-store-sub">Minecoins are virtual Minecraft currency used to transform your worlds, dive into epic story-driven adventures, customize your character, and much more!</p>' +
        '<div class="mc-select-line"><div class="mc-select-title">SELECT A PACK</div><button class="mc-redeem" type="button">REDEEM</button></div>' +
        '<section class="mc-pack-panel"><div class="mc-pack-grid">' +
          packCard('320','1.99','', '', false, false, .78) +
          packCard('960','5.99','+ 60 Bonus!','Popular!',false,true,.92) +
          packCard('1600','9.99','+ 120 Bonus!','',false,true,1.05) +
          packCard('3200','19.99','+ 300 Bonus!','Deal!',true,true,1.18) +
        '</div><div class="mc-lower-row">' +
          packCard('8000','49.99','+ 800 Bonus!','',false,true,1.24) +
        '</div></section>' +
      '</div></main>';
    document.body.appendChild(overlay);

    function openStore() {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
    }
    function closeStore() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
    }

    $('.mc-close', overlay).addEventListener('click', closeStore);
    $('.mc-redeem', overlay).addEventListener('click', function () {
      var redeem = $('.mc-redeem', overlay); redeem.textContent = 'REDEEM CODE';
      setTimeout(function () { redeem.textContent = 'REDEEM'; }, 1100);
    });
    $$('.mc-pack', overlay).forEach(function (card) {
      card.addEventListener('click', function () {
        $$('.mc-pack', overlay).forEach(function (p) { p.classList.remove('selected'); });
        card.classList.add('selected');
      });
    });

    $$('.ht-coins,.ht-plus').forEach(function (trigger) {
      trigger.style.cursor = 'pointer';
      trigger.addEventListener('click', function (e) { e.stopPropagation(); openStore(); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeStore();
    });
  }

  function wirePlayRealmButton() {
    var button = $('.realm-promo .btn-purple');
    if (button) button.addEventListener('click', function () {
      var realmsTab = $('.tab[data-tab="realms"]');
      if (realmsTab) realmsTab.click();
    });
  }

  function init() {
    buildRealms();
    buildSkins();
    buildMinecoins();
    wirePlayRealmButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
