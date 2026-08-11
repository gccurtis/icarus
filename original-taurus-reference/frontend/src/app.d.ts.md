# src/app.d.ts — breakdown

Companion to [app.d.ts](app.d.ts). Ambient (global) TypeScript declarations for
the app: it registers the Iconify virtual-module types and declares SvelteKit's
`App` namespace interfaces.

## Iconify types

### Type support for `~icons/*` imports

```ts
/// <reference types="unplugin-icons/types/svelte" />
```

A triple-slash directive that loads `unplugin-icons`' Svelte type definitions.
Without it, TypeScript wouldn't recognize `import Icon from '~icons/tabler/...'`
imports as valid Svelte components. It must live in an ambient `.d.ts` so it
applies project-wide.

## App namespace

### SvelteKit's typed extension points

```ts

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}
```

SvelteKit reads the `App` namespace to type framework-level values: `Error`
(shape of errors), `Locals` (per-request server data), `PageData`, `PageState`,
and `Platform` (adapter-specific context). They're left commented as placeholders
to fill in as the app grows.

## Module marker

### Force module scope

```ts

export {};
```

An empty export makes the file a module rather than a global script, which is
required for the `declare global` block above to be interpreted correctly.
