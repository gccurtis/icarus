# svelte.config.js — breakdown

Companion to [svelte.config.js](svelte.config.js). Configures SvelteKit: how
`.svelte` files are preprocessed, the `$`-prefixed import aliases, and which
adapter builds the app for deployment.

## Imports

### Adapter and preprocessor

```js
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

```

`adapter-auto` detects the deployment target at build time. `vitePreprocess`
lets Svelte components use anything Vite understands (TypeScript, PostCSS/Tailwind)
inside `<script>` and `<style>` blocks.

## Configuration object

### Preprocess, path aliases, and adapter setup

```js
/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    alias: {
      $data: 'src/lib/data',
      $systems: 'src/lib/systems',
      $services: 'src/lib/services'
    },
    // adapter-auto for now; swap to adapter-static / adapter-node once we know
    // how the cockpit deploys against Taurus Omega.
    adapter: adapter(),
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'frame-ancestors': ['self'],
        /* … connect-src, img-src, font-src, form-action */
      }
    }
  }
};

```

The JSDoc `@type` annotation gives editors full type-checking on the config
object. `preprocess` enables the Vite-based transforms. `kit.alias` registers the
`$data`, `$systems`, and `$services` import shortcuts that point at the matching
`src/lib` subtrees so modules import from stable names instead of relative paths.
`kit.csp` is the Content-Security-Policy (catalog **S3**). SvelteKit emits the header and nonces
the scripts it renders itself; the app keeps no other inline script, so `script-src 'self'` needs
no inline allowance — the pre-paint theme bootstrap lives in
[`static/theme-init.js`](static/theme-init.js) for exactly that reason.

**`style-src` allows `'unsafe-inline'`, deliberately.** The document editor renders per-block and
per-mark styling as inline `style` attributes (ProseMirror decorations, Svelte `style:`
directives), which `style-src` governs; a strict value would break the editor's core rendering.
CSS injection is defended by validating those values instead
(`$systems/documents/sanitize`, catalog **S2**) — this directive is not the control for it. What
the policy does buy is `script-src`, `object-src`, `base-uri` and `frame-ancestors`.

`kit.adapter` uses `adapter-auto` as a placeholder — the comment flags that we'll
switch to a concrete adapter (`adapter-static` or `adapter-node`) once the
deployment story against Taurus Omega is settled.

## Export

### Default export consumed by SvelteKit

```js
export default config;
```

SvelteKit reads this default export when building and running the app.
