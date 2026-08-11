# Context capability design

A **context** is a project-scoped, named set of resource references that can be
combined, nested, and resolved down to the concrete resources it represents. It
promotes the set algebra that today lives privately in `document`'s
`resolveBlockScope` into a first-class, reusable, stored capability — and lets a
member be either a leaf resource (a document, a connector, …) or *another
context*.

## Purpose

- Give the project one place to define reusable bundles of context ("all the
  design docs", "the spec plus its two connectors") and combine them.
- Let a document prompt block bind a context variable to a context and retrieve
  over everything that context resolves to.
- Own the include/exclude set algebra once, so both stored contexts and
  ad-hoc/anonymous selections resolve through the same code.

## Core idea: a context is a definition value

A context is a **definition value**:

```
Definition { Includes []Ref, Excludes []Ref }
Ref        { Kind string, ID string, Name string }   // Name optional, display-only
```

- A **stored/named context** persists `{name, includes, excludes}` — it is
  defined by *both* lists; excludes are a first-class part of the stored
  definition, not only an ad-hoc operation.
- An **anonymous context** is the same `Definition` value, never written to the
  store. A prompt block builds one at refresh time and passes it straight to
  `Resolve`. No per-block rows, no store pollution.

`Resolve(projectID, Definition) → []Ref` is the single entry point for both.
Stored → load the row's definition and resolve it. Anonymous → resolve the value
directly.

The store is deliberately dumb: it only ever holds the refs the user typed
(`kind`, `id`, optional `name`). It never copies resource content, never
snapshots what a member resolves to, and is unaffected by edits/renames of the
underlying resources.

## Resolution semantics

`Resolve` computes leaf origins fresh on every call:

1. Expand `Includes` → leaf set **I**. A member with `Kind == "context"`
   recurses into that context's definition; any other kind is a leaf. The
   reserved id `whole-project` expands via the `Catalog` port to every leaf
   resource in the project (contexts themselves are organizational, not content,
   so they are not enumerated by `whole-project`).
2. Expand `Excludes` → leaf set **E** the same way (excluding a context or
   connector subtracts *everything it represents*).
3. Result = **I − E**, deduped, include-order preserved, **exclude wins** —
   identical algebra to today's `resolveBlockScope`, just at the leaf level after
   full expansion. This is what makes "include a context, exclude one thing
   inside it" work.

Cycles are killed by a visited-set over context ids. Resolution is **always
live** — because a member can be a connector or nested context representing a
changing set, nothing is snapshotted.

`whole-project` is both a resolvable reserved id *and* an includable member, so
"everything except X" = include `whole-project`, exclude `X`.

## Ports (no capability imports another)

Two thin adapters live in wiring, mirroring the existing
`PersonaResolver`/`Retriever` pattern:

- **`Catalog`** (context depends on): `AllResources(projectID) ([]Ref, error)` —
  every leaf resource in the project, for `whole-project`. Adapter delegates to
  the resource catalog.
- **`document.ScopeResolver`** (document depends on):
  `ExpandScope(ctx, projectID, include, exclude []ScopeOrigin) ([]ScopeOrigin, error)`.
  `ResolveBlock` calls it after mapping the block's include/exclude variables to
  origins and before `RetrieveScoped`. The adapter converts origins ⇄
  `context.Ref`, builds a `Definition`, calls `Resolve`, converts back. With a
  nil resolver, the document falls back to today's origin-level subtraction so
  nothing breaks.

## Storage

One `contexts` table in the SQLite adapter:

```
contexts(id, project_id, name, creator_id, created_at, updated_at,
         includes_json, excludes_json)
```

`includes`/`excludes` are stored as JSON columns (small sets; mirrors how
`document` stores its template JSON — no join table for "just a store").

## Endpoints (`core/handlers/context`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/contexts` | create `{name, includes?, excludes?}` |
| GET | `/contexts` | list (id, name, member counts) |
| GET | `/contexts/:id` | raw membership |
| GET | `/contexts/:id/resolved` | flattened leaf origins |
| PATCH | `/contexts/:id` | rename and/or replace includes/excludes (set-style) |
| DELETE | `/contexts/:id` | delete |

Replace-style PATCH (not per-item add/remove) is leanest and matches set
semantics; granular add/remove stays an easy follow-up.

## Document binding

A prompt-block context variable binds to a context via the **existing**
`BoundResource{Kind:"context", ID}` — no new op, no template/changeset changes.
`resolveBlockScope` yields the include/exclude origin lists; `ExpandScope`
flattens context-kind origins to leaves. The reference graph
(`DependentPrompts`) continues to match on the block's directly-referenced
origins (which now include context origins).

## Testing

- **Unit (deterministic plumbing):** the set flattening — nesting, cycles,
  exclude-wins, dedup, `whole-project` via a fake `Catalog`. Pure algebra; no
  intelligence involved, so a fake catalog is correct here.
- **Live dev-test (real model, reports cost):** a prompt block whose variable
  binds to a context retrieves over the flattened union end-to-end, proving the
  document wiring. Per the no-stub rule, the end-to-end retrieval path is
  validated with real intelligence and the run reports its token cost.

## Out of scope (documented future work)

1. **Deep cascade** — a change to a resource *inside* a referenced context
   refreshing the dependent prompts (today's graph matches directly-referenced
   origins, not transitively through a context).
2. **Connectors as context-like** — the files a connector represents becoming
   first-class resources, so a connector expands into its leaves exactly like a
   context. Connectors and contexts are the same shape; unify later.
3. **Resource-family registration** for `KindContext` (so contexts appear in the
   unified resource catalog and picker). The capability owns its own endpoints
   for now; family registration is additive.
