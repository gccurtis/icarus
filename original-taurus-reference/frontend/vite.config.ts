import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';

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
