// Apply the saved (or OS-preferred) theme before first paint — no flash.
//
// This lives in static/ rather than inline in app.html so the Content-Security-
// Policy needs no inline-script allowance: as a same-origin file it is covered by
// `script-src 'self'`. Inlining it would need either a nonce (which SvelteKit
// refuses to combine with prerendering — "Cannot use prerendering if page
// template contains %sveltekit.nonce%") or a hash that must be updated by hand
// whenever this code changes. A tiny cached same-origin script avoids both.
//
// Loaded synchronously in <head>, so it still runs before the first paint.
(function () {
  try {
    var t = localStorage.getItem('taurus:theme');
    if (t !== 'celestial' && t !== 'eclipse') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'eclipse' : 'celestial';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
