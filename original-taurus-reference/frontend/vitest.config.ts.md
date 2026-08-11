# vitest.config.ts — breakdown

Companion to [vitest.config.ts](vitest.config.ts). Unit-test configuration for vitest,
running alongside the existing Playwright E2E setup. Uses the SvelteKit Vite plugin for
alias resolution (`$data`, `$systems`, `$services`, `$lib`) and runs tests in Node
environment (no browser DOM needed for data-layer and system-layer tests).

## Vitest configuration

```ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
```

The `sveltekit()` plugin resolves SvelteKit path aliases so test files can use
`$data/...`, `$systems/...`, `$services/...`, and `$lib/...` imports. Tests run in
Node since the data and systems layers contain no browser-specific code.
