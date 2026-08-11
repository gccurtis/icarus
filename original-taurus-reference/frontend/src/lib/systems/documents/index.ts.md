# src/lib/systems/documents/index.ts — breakdown

Companion to [index.ts](index.ts). The barrel for the documents system — the single
import surface behind the `$data/documents` / `$systems/documents` aliases.

## Re-exports

```ts
export * from './types';
export * from './block-kinds';
export * from './api';
export * from './layout';
export * from './collaboration';
export * from './ai-tasks';
export * from './styles';
export * from './io';
export * from './comments';
export * from './references';
```

Surfaces the document shape types, the HTTP client, page-layout helpers,
presence/collaboration, the document-scoped agent-task client
(`ai-tasks`, Goal 3.5), the semantic-typography helpers (`styles`, Goals 2.1/2.2),
the Markdown import/export client (`io`), the anchored-comments client
(`comments`, Goal B3), and the reference-graph client (`references`, Goal B5)
from one module.

Two modules left in workstream D: `context.ts` (breadcrumb comments, no exports —
deleted, D4) and `inspector.ts` (the shared option lists — moved to
`$lib/features/shared/inspector-options`, L5, after its geometry helpers died with
the Row lens in D6).
