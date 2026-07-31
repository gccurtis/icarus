# Knowledge TODO — Context-scoped retrieval

## Goal

Extend Knowledge retrieval so a caller may supply a list of `{ id, kind }`
context entries. Knowledge resolves that list into an admissible lattice scope
and excludes out-of-scope artifacts during descent.

Document does not resolve the entries and does not depend on a Context service.
A Prompt Block always stores `DocumentContext[]` and passes it to Knowledge
unchanged.

## Context contract

Document initially owns the minimal shape:

```ts
interface DocumentContext {
  id: string;
  kind: string;
}
```

The first supported entries are direct Resources, for example:

```ts
{ id: documentId, kind: "document" }
```

For the initial direct-Resource path, this pair maps to Knowledge's existing
source metadata as `id === SourceRecord.sourceId` and
`kind === SourceRecord.label`. No separate translation service is required.

There is no `subkind`; a distinction that matters for retrieval is represented
by `kind`. A future `kind: "context"` may reference a named Context, and other
resource/variable kinds may be added without changing the pair-shaped
contract.

When a shared Context library is implemented, move this type there and have
Document and Knowledge import it. Do not create a second Knowledge-specific
shape.

An omitted context option or an empty list means no additional restriction:
search the whole already project-scoped lattice. Document always supplies its
stored list, including when that list is empty.

## Retrieval surface

The eventual Knowledge surface should accept the same scope for one or many
queries:

```ts
interface KnowledgeRetrievalOptions {
  topK?: number;
  contexts?: DocumentContext[];
}

retrieve(query: string, options?: KnowledgeRetrievalOptions): Promise<RetrieveResult>;
retrieveMany(queries: string[], options?: KnowledgeRetrievalOptions): Promise<RetrieveResult>;
```

The result should record the exact resolved scope used:

```ts
interface KnowledgeScopeManifest {
  contextDigest: string;
  scopeDigest: string;
  resolvedContexts: DocumentContext[];
  resolvedResources: DocumentContext[];
  resolvedAt: string;
}

interface RetrieveResult {
  regions: Region[];
  scope: KnowledgeScopeManifest;
  usage: Usage;
}
```

This manifest lets Prompt refresh persist exact provenance and determine whether
a later Context/resource publication makes its accepted result stale.

## Descent behavior

Context filtering belongs inside descent, not after region assembly:

1. Translate the `{ id, kind }` entries to admissible Resource identities.
   Direct Resources match the existing `(sourceId, label)` pair.
2. Before scoring or beam admission, discard any frontier artifact that cannot
   reach an admissible source.
3. Apply the same predicate whenever a node expands into children.
4. Reject out-of-scope windows before candidate ranking and region assembly.
5. Run every query in `retrieveMany` against the same frozen resolved scope.

Filtering only the final regions is incorrect: out-of-scope candidates could
consume the beam and retrieval budget, preventing relevant in-scope candidates
from surfacing.

Corpus nodes can contain descendants from several Resources. To make the
intersection check bounded, their stored/rebuildable metadata must summarize
the `(sourceId, label)` identities reachable beneath them, or the store must
provide an equivalent indexed membership check. A mixed node remains eligible
when its descendant Resource set intersects the resolved scope.

## Work to do later

- move `DocumentContext` into a shared Context library when that library is
  implemented;
- implement direct Resource translation first, beginning with
  `{ id: documentId, kind: "document" }`;
- later implement named Context and other resource/variable kinds;
- add scope membership metadata or an equivalent index for corpus nodes;
- thread the resolved-scope predicate through initial frontier selection,
  expansion, window ranking, and `retrieveMany`;
- include the exact `KnowledgeScopeManifest` in results and logs;
- update Knowledge call sites after the API changes.

## Invariants

- An omitted or empty context list searches the whole scoped Knowledge store.
- No returned Region may belong to a source outside the resolved scope.
- Out-of-scope artifacts never consume beam width or result budget.
- Equivalent context lists resolve to the same `scopeDigest`.
- Context scoping changes retrieval only; it does not create another copy of
  lattice content.
