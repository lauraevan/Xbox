/* Make the Home profile behave like the Xbox profile/Guide entry point on
   controller, mouse and touch. */
(() => {
'use strict';

function openProfileGuide(){
  window.Guide?.open?.('profile');
}

function wire(){
  const profile = document.querySelector('.profile[data-act="profile"]');
  if (!profile || profile.dataset.profileGuideWired === '1') return;
  profile.dataset.profileGuideWired = '1';

  /* Nav activation uses this directly; the pointer handler below covers iPad
     and mouse taps that don't pass through the controller navigation layer. */
  profile._navActivate = openProfileGuide;
  profile.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openProfileGuide();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once:true });
else wire();
})();
