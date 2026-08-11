# src/lib/systems/documents/references.ts — breakdown

Companion to [references.ts](references.ts). The document reference-graph client
(Omega `opts.References`) — a document's outgoing references + its backlinks, derived
from inline links. Replaces the mock reference lists (Goal B5).

## Doc comment + edge types

```ts
import { api } from '$data/api';

/**
 * Document reference graph (Omega `opts.References`). Edges are derived from the
 * inline links each document carries: `references` are this document's outgoing
 * edges (what it links to); `backlinks` are the edges that point at it. Replaces
 * the mock reference lists.
 */

/** One endpoint of a reference edge — a resource by kind + id (+ display name). */
export interface ReferenceRef {
  kind: string;
  id: string;
  name?: string;
}

/** A reference edge between two resources, with the link's kind + optional anchor. */
export interface ReferenceEdge {
  fromResource: ReferenceRef;
  toResource: ReferenceRef;
  kind: string;
  anchor?: string;
}

```

`ReferenceRef`/`ReferenceEdge` mirror Omega's `Ref`/`Edge`. An edge goes
`fromResource → toResource`.

## Load references + backlinks

```ts
/** This document's outgoing reference edges (what it links to). */
export async function loadReferences(documentId: string): Promise<ReferenceEdge[]> {
  if (!documentId) return [];
  const res = await api<{ references: ReferenceEdge[] }>(
    `/documents/${encodeURIComponent(documentId)}/references`
  );
  return res.references ?? [];
}

/** The edges that point at this document (backlinks). */
export async function loadBacklinks(documentId: string): Promise<ReferenceEdge[]> {
  if (!documentId) return [];
  const res = await api<{ backlinks: ReferenceEdge[] }>(
    `/documents/${encodeURIComponent(documentId)}/backlinks`
  );
  return res.backlinks ?? [];
}
```

`loadReferences` hits `/documents/:id/references` (outgoing); `loadBacklinks` hits
`/documents/:id/backlinks` (incoming). The panel reads each edge's `toResource` /
`fromResource` for the two lists.
