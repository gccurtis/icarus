# src/lib/systems/personas/index.ts — breakdown

Companion to [index.ts](index.ts). The barrel for the personas system.

## Re-exports

```ts
export * from './types';
export * from './store';
```

Surfaces the persona types and the `personas` store + `loadPersonas` action under
the `$systems/personas` alias so callers import from one place.
