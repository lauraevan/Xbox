/* Minimal flagship treatment for the existing launch surface.
   Uses only the real title/art/status already supplied by the game session. */
(() => {
'use strict';

const launch = document.getElementById('launch');
const center = launch?.querySelector('.launch-center');
const title = document.getElementById('launchTitle');
const sub = launch?.querySelector('.launch-sub');
if (!launch || !center || !title || !sub) return;

/* Late layout pass. Home keeps its existing composition, but every actual
   Xbox page collapses the old 34rem Home-only header reservation so the page
   starts directly under the system bar. This is especially important on the
   4:3 iPad canvas, where that old reservation looked like a huge blank strip. */
if (!document.getElementById('xbox-page-shell-fix')){
  const style = document.createElement('style');
  style.id = 'xbox-page-shell-fix';
  style.textContent = `
    body[data-view="library"] .stage,
    body[data-view="store"] .stage,
    body[data-view="pass"] .stage,
    body[data-view="search"] .stage,
    body[data-view="settings"] .stage{
      grid-template-rows:10.4rem minmax(0,1fr)!important;
    }

    body[data-view="library"] .sysbar,
    body[data-view="store"] .sysbar,
    body[data-view="pass"] .sysbar,
    body[data-view="search"] .sysbar,
    body[data-view="settings"] .sysbar{
      height:10.4rem!important;
      z-index:40!important;
      overflow:visible!important;
    }

    body[data-view="library"] .sysnav,
    body[data-view="library"] .profile,
    body[data-view="library"] .sysstatus,
    body[data-view="store"] .sysnav,
    body[data-view="store"] .profile,
    body[data-view="store"] .sysstatus,
    body[data-view="pass"] .sysnav,
    body[data-view="pass"] .profile,
    body[data-view="pass"] .sysstatus,
    body[data-view="search"] .sysnav,
    body[data-view="search"] .profile,
    body[data-view="search"] .sysstatus,
    body[data-view="settings"] .sysnav,
    body[data-view="settings"] .profile,
    body[data-view="settings"] .sysstatus{
      top:2.2rem!important;
    }

    body[data-view="library"] .topbar-scrim,
    body[data-view="store"] .topbar-scrim,
    body[data-view="pass"] .topbar-scrim,
    body[data-view="search"] .topbar-scrim,
    body[data-view="settings"] .topbar-scrim{
      height:10.4rem!important;
      background:linear-gradient(180deg,rgba(0,0,0,.78),rgba(0,0,0,.2) 72%,transparent)!important;
    }

    body[data-view="library"] .views,
    body[data-view="store"] .views,
    body[data-view="pass"] .views,
    body[data-view="search"] .views,
    body[data-view="settings"] .views{
      min-height:0!important;
      overflow:hidden!important;
    }

    /* Settings should use the available TV canvas instead of stopping at a
       desktop-style max width and leaving a giant dead area on the right. */
    #view-settings .console-settings-panel{
      width:100%!important;
      max-width:none!important;
    }

    /* A running cloud game owns the display. Dashboard chrome stays behind it. */
    body:has(#player.cloud-player:not([hidden])) .sysbar,
    body:has(#player.cloud-player:not([hidden])) .topbar-scrim{
      visibility:hidden!important;
    }

    @media (max-aspect-ratio:16/10){
      body[data-view="library"] .stage,
      body[data-view="store"] .stage,
      body[data-view="pass"] .stage,
      body[data-view="search"] .stage,
      body[data-view="settings"] .stage{
        grid-template-rows:9.2rem minmax(0,1fr)!important;
      }

      body[data-view="library"] .sysbar,
      body[data-view="store"] .sysbar,
      body[data-view="pass"] .sysbar,
      body[data-view="search"] .sysbar,
      body[data-view="settings"] .sysbar{
        height:9.2rem!important;
      }

      body[data-view="library"] .sysnav,
      body[data-view="library"] .profile,
      body[data-view="library"] .sysstatus,
      body[data-view="store"] .sysnav,
      body[data-view="store"] .profile,
      body[data-view="store"] .sysstatus,
      body[data-view="pass"] .sysnav,
      body[data-view="pass"] .profile,
      body[data-view="pass"] .sysstatus,
      body[data-view="search"] .sysnav,
      body[data-view="search"] .profile,
      body[data-view="search"] .sysstatus,
      body[data-view="settings"] .sysnav,
      body[data-view="settings"] .profile,
      body[data-view="settings"] .sysstatus{
        top:1.75rem!important;
      }

      body[data-view="library"] .topbar-scrim,
      body[data-view="store"] .topbar-scrim,
      body[data-view="pass"] .topbar-scrim,
      body[data-view="search"] .topbar-scrim,
      body[data-view="settings"] .topbar-scrim{
        height:9.2rem!important;
      }

      #view-settings .console-shell,
      #view-pass .console-shell{
        grid-template-columns:20.5rem minmax(0,1fr)!important;
      }

      #view-settings .console-side,
      #view-pass .console-side{
        padding:2rem .85rem 1.6rem!important;
      }

      #view-settings .console-side-brand,
      #view-pass .console-side-brand{
        min-height:4.8rem!important;
        padding:0 .8rem 1rem!important;
        font-size:1.8rem!important;
      }

      #view-settings .console-side-item,
      #view-pass .console-side-item{
        min-height:4.45rem!important;
        padding:0 .85rem!important;
        font-size:1.28rem!important;
      }

      #view-settings .console-main,
      #view-pass .console-main{
        padding:2.15rem 2.65rem 4rem!important;
      }

      #view-settings .console-page-head,
      #view-search .console-page-head,
      #view-pass .console-page-head{
        min-height:5.7rem!important;
        margin-bottom:1rem!important;
      }

      #view-settings .console-page-head h1,
      #view-search .console-page-head h1,
      #view-pass .console-page-head h1{
        font-size:2.9rem!important;
      }

      #view-settings .console-page-head p,
      #view-search .console-page-head p,
      #view-pass .console-page-head p{
        margin-top:.4rem!important;
        font-size:1.12rem!important;
      }

      #view-settings .console-settings-panel{
        width:100%!important;
        max-width:none!important;
        gap:.48rem!important;
        padding:.2rem 0 3.2rem!important;
      }

      #view-settings .console-settings-row{
        min-height:6.55rem!important;
        padding:1.05rem 1.25rem!important;
      }

      #view-settings .console-settings-copy strong{
        font-size:1.46rem!important;
      }

      #view-settings .console-settings-copy small,
      #view-settings .console-settings-row[data-focused] .console-settings-copy small{
        font-size:1.02rem!important;
      }

      #view-search .console-search-page{
        padding:2.15rem 2.65rem 3.8rem!important;
      }

      #view-search .console-search-body{
        grid-template-columns:minmax(31rem,40rem) minmax(0,1fr)!important;
        gap:2.35rem!important;
      }

      #view-search .console-key{
        min-height:4.15rem!important;
      }

      #view-pass .console-pass-hero{
        height:31.5rem!important;
        margin-bottom:2rem!important;
      }

      #view-pass .console-pass-hero-copy{
        left:2.5rem!important;
        top:2.3rem!important;
        bottom:2.3rem!important;
        width:min(39rem,58%)!important;
      }

      #view-pass .console-pass-hero h1{
        font-size:3.65rem!important;
      }

      #view-pass .console-horizontal-row{
        grid-auto-columns:13.8rem!important;
      }

      #view-library .console-main{
        padding:2.45rem 3.6rem 3.6rem!important;
      }

      #view-store .xstore-shell{
        grid-template-columns:15.8rem minmax(0,1fr)!important;
      }

      #view-store .xstore-rail{
        padding-top:2rem!important;
      }

      #view-store .xstore-content{
        padding:2.15rem 2.65rem 4rem!important;
      }

      #view-store .xstore-hero{
        height:30.5rem!important;
      }
    }
  `;
  document.head.append(style);
}

if (!center.querySelector('.launch-brand')){
  const brand = document.createElement('div');
  brand.className = 'launch-brand';
  brand.setAttribute('aria-hidden','true');
  brand.innerHTML = `
    <svg viewBox="0 0 48 48"><path d="M24 3.5a20.5 20.5 0 1 0 0 41 20.5 20.5 0 0 0 0-41Zm-7.8 5.4c2.3-1.2 5-1.9 7.8-1.9s5.5.7 7.8 1.9c-2.4 1.4-5 3.5-7.8 6.3-2.8-2.8-5.4-4.9-7.8-6.3Zm-6.8 5.7c1-1.3 2.1-2.4 3.4-3.4 2.7 1.1 5.6 3.3 8.7 6.4-4.8 5.2-8.6 10.4-11.4 15.7A16.7 16.7 0 0 1 7 24c0-3.5 1-6.7 2.4-9.4Zm14.6 26a16.8 16.8 0 0 1-11-4c2.8-5.4 6.5-10.7 11-15.7 4.5 5 8.2 10.3 11 15.7a16.8 16.8 0 0 1-11 4Zm13.9-7.3c-2.8-5.3-6.6-10.5-11.4-15.7 3.1-3.1 6-5.3 8.7-6.4A17 17 0 0 1 41 24c0 3.3-.9 6.5-3.1 9.3Z"/></svg>
    <span>XBOX</span>`;
  center.prepend(brand);
}

if (!center.querySelector('.launch-status-rail')){
  const rail = document.createElement('div');
  rail.className = 'launch-status-rail';
  rail.setAttribute('aria-hidden','true');
  center.append(rail);
}

if (!center.querySelector('.launch-footnote')){
  const note = document.createElement('div');
  note.className = 'launch-footnote';
  note.textContent = 'Xbox Cloud Gaming';
  center.append(note);
}

function refreshState(){
  if (launch.hidden) return;
  launch.classList.remove('flagship-enter');
  void launch.offsetWidth;
  launch.classList.add('flagship-enter');
}

new MutationObserver(records => {
  for (const record of records){
    if (record.type === 'attributes' && record.attributeName === 'hidden') refreshState();
  }
}).observe(launch,{ attributes:true, attributeFilter:['hidden'] });

new MutationObserver(() => {
  const text = sub.textContent?.trim() || '';
  launch.dataset.status = text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}).observe(sub,{ childList:true, subtree:true, characterData:true });

window.addEventListener('stratus:library-change', () => {});
})();
