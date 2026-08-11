import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
    // Content-Security-Policy (catalog S3). SvelteKit nonces the scripts it
    // renders itself; the app has no other inline script (the pre-paint theme
    // bootstrap is an external same-origin file), so `script-src 'self'` needs no
    // inline allowance. Verified against the built output and a running preview
    // server, not assumed.
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        // Same-origin only: /api/* is proxied to Omega under this origin.
        'connect-src': ['self'],
        'img-src': ['self', 'data:'],
        'font-src': ['self'],
        // NOTE the honest exception: the document editor renders per-block and
        // per-mark styling as inline `style` attributes (ProseMirror decorations,
        // Svelte `style:` directives), which `style-src` governs. A strict policy
        // here would break the editor's core rendering, so CSS injection is
        // defended by VALIDATING those values instead — see
        // $systems/documents/sanitize (catalog S2). This directive is not the
        // control for that; script-src/object-src are what this policy buys.
        'style-src': ['self', 'unsafe-inline'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'frame-ancestors': ['self'],
        'form-action': ['self']
      }
    }
  }
};

export default config;
