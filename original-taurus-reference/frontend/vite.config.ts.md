# vite.config.ts — breakdown

Companion to [vite.config.ts](vite.config.ts). Wires the Vite plugins (Tailwind,
HTTPS dev cert, SvelteKit, Iconify) and the dev-server proxy that lets the browser
talk to the Taurus Omega backend same-origin so its session cookie works.

## Imports

### Plugin and helper imports

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';
```

Adds `basicSsl` (a dev HTTPS certificate) alongside the Tailwind, SvelteKit,
Iconify, and `defineConfig` imports.

## Plugins

### Order, HTTPS, and Iconify

```ts

export default defineConfig({
  plugins: [
    tailwindcss(),
    // Serve dev over HTTPS so the backend's `Secure` session cookie
    // (`to_session`) is accepted and stored by the browser.
    basicSsl(),
    sveltekit(),
    // Iconify backup set: `import Foo from '~icons/<set>/<name>'`.
    // Icon data is served offline from the @iconify/json dev dependency.
    Icons({ compiler: 'svelte' })
  ],
```

`basicSsl()` makes the dev server serve HTTPS — required because Omega's session
cookie is `Secure`, so the browser will only store it over an HTTPS origin. The
rest is unchanged (Tailwind first, then SvelteKit, then Iconify).

## Dev proxy

### Same-origin bridge to the backend

```ts
  server: {
    // Same-origin proxy to the Taurus Omega backend. The browser only ever talks
    // to this origin, so the SameSite=Lax session cookie flows; `secure: false`
    // accepts the backend's self-signed dev certificate. `/api/auth/login` ->
    // `https://127.0.0.1:8443/auth/login`.
    proxy: {
      '/api': {
        target: 'https://127.0.0.1:8443',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
```

Any request to `/api/*` is forwarded to the backend on `:8443`, stripping the
`/api` prefix. Because the browser only ever sees this one origin, the backend's
`SameSite=Lax` cookie is sent on subsequent requests; `changeOrigin` fixes the
`Host` header and `secure: false` accepts the self-signed dev certificate. The
target port matches the `:8443` override set in Omega's `config.local.yaml`.
