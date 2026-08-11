# theme-init.js

The pre-paint theme bootstrap: read the saved (or OS-preferred) theme and stamp it on
`<html data-theme>` before anything renders, so there is no flash of the wrong theme.

## Why it is a file and not an inline script

```js
(function () {
  try {
    var t = localStorage.getItem('taurus:theme');
    if (t !== 'celestial' && t !== 'eclipse') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'eclipse' : 'celestial';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
```

This lived inline in `app.html` until the CSP landed (catalog **S3**). `script-src 'self'` blocks
bare inline scripts, and the two ways to keep it inline both cost something:

- a **nonce** — SvelteKit does not nonce hand-written template scripts, and adding
  `%sveltekit.nonce%` makes prerendering impossible outright (*"Cannot use prerendering if page
  template contains %sveltekit.nonce%"*);
- a **hash** — has to be recomputed by hand every time this code changes, which is exactly the
  kind of thing that silently rots.

A same-origin file is covered by `'self'` with neither problem. The `<script src>` tag in
`app.html` is synchronous, so it still runs before the first paint.

## Details that matter

`localStorage` access is wrapped in `try/catch`: it throws in some privacy modes, and a theme
preference is never worth breaking page load over. The value is validated against the two known
themes rather than trusted, so a stale or hand-edited entry falls back to the OS preference.

Plain ES5 in an IIFE — no bundling, no modules. It is served verbatim from `static/`, so it
cannot rely on anything the build would normally provide.

The written value is the same `taurus:theme` key the app's theme store reads and writes; this
file only mirrors it early.
