# src/app.html — breakdown

Companion to [app.html](app.html). The HTML shell SvelteKit injects every page
into. The `%sveltekit.*%` placeholders are replaced at render time.

## Document head

### Doctype, root element, and metadata

```html
<!doctype html>
<html lang="en" data-theme="celestial">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Taurus Alpha</title>
    <!-- Pre-paint theme, as an external same-origin file so the CSP needs no
         inline-script allowance (see static/theme-init.js). Synchronous on
         purpose: it must run before the first paint. -->
    <script src="%sveltekit.assets%/theme-init.js"></script>
    %sveltekit.head%
  </head>
```

`lang="en"` sets the document language; `data-theme="celestial"` selects the
Celestial Light palette as the boot default (see [app.css](app.css) — the theme
value layers key off this attribute, and switching it to `eclipse` flips the app
to dark). [theme-init.js](../static/theme-init.js) then overrides that attribute
**before first paint** from the saved choice (`localStorage['taurus:theme']`) or the OS
preference, so a dark-theme user never sees a flash of light. It is an external file rather
than an inline script because the Content-Security-Policy (see [svelte.config.js](../svelte.config.js))
allows no bare inline script — that companion explains why a nonce or hash was the worse option; [theme.ts](lib/theme.ts) keeps it in sync
afterwards. The rest of `<head>` sets charset, favicon (via the `%sveltekit.assets%`
base path), responsive viewport, and title. `%sveltekit.head%` is where SvelteKit
injects per-page `<svelte:head>` content, preload links, and styles.

## Document body

### Mount point for the app

```html
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

`data-sveltekit-preload-data="hover"` tells SvelteKit to start loading a route's
code/data when the user hovers a link, making navigation feel instant.
`%sveltekit.body%` is where the rendered app is inserted; wrapping it in a
`display: contents` div keeps the DOM structure clean without adding a layout box.
