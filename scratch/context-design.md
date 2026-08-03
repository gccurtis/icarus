# Context Capability — Design

**The implementation is documented in code**, at
[`3-capabilities/context/docs/`](../apps/backend/src/3-capabilities/context/docs/README.md)
— concepts, types, runtime, flows, and invariants. Those pages describe what is
actually built and are kept true as it changes. This page holds the design
decisions that are worth stating once and not repeating there.

Everything this file used to say about user-scoped tables, promotion, `~`-prefixed
anonymous contexts, soft deletion with `deleted_at`, and a 21-route endpoint tree
was superseded — first by [`context-migration.md`](context-migration.md), which
collapsed Context to project-only scope, and then by the revision/history model
and the live-scope work below.

---

## What a Context is

A **rule** for producing a set of resource references, not the set itself.

That distinction is the whole design. A reference is the pair `{ id, kind }`, and
Context treats those pairs as opaque — it does not know what a `general::file::markdown`
is and must not learn. What it does know is how to combine them:

- **nested contexts** — an entry with `kind: "context"` expands to that record's
  own resolved set;
- **the project** — an entry with `kind: "project"` expands to whatever the
  project currently holds;
- **exclusions** — a record's `excludes`, subtracted from its own expansion.

None of it is materialised at write time. That is what lets "everything in this
project except these five" stay correct as the project changes, and it is the
defect the earlier design had: `composeNamed("difference", …)` used to compute a
leaf set and store it, so the answer was stale the moment anything was added.

## Decisions worth keeping

### Context does not know what a project contains

Expanding `kind: "project"` needs an answer Context cannot have without depending
on every resource capability. So it does not: a narrow `ProjectMembershipPort` is
injected during composition by `1-init`, the only layer that sees both sides. The
resource registry satisfies it, which is tidy — the registry already resolves
Context's leaves in the other direction.

### The failure directions were chosen, not defaulted

Three places where being wrong in one direction is much worse than the other, so
the code deliberately fails the safe way:

| Situation | Fails toward | Because |
|---|---|---|
| Exclusion spelled with a different `kind` than the expansion | excluding it anyway (match on `id` alone) | An exclusion that misses leaks exactly what someone asked to withhold. Excluding too much only narrows a scope |
| A cycle or the depth cap truncates an exclusion list | withholding the whole record | We cannot work out what to keep out, and "we don't know" must not mean "let it through" |
| No membership port, or enumeration throws | the project expands to nothing | An empty result is visible. A silent whole-corpus grounding is not |

### An empty scope means nothing

`Knowledge.resolveScope` used to read a zero-length array as the whole project.
That made the broadest possible grounding the thing you got by *accident* — from
an omitted request field, a coerced body value, an unbound Context Variable, or a
column default. Now absent means unscoped, empty means empty, and the whole
project has to be named.

The corollary is that a Derived Output naming nothing is refused rather than
answered. Grounding without evidence is the failure the whole system exists to
prevent, and the old rule turned a configuration mistake into a confident answer.

## What Context still does not do

- **Own content.** Knowledge owns ingestion and retrieval; the resource
  capabilities own their content and revisions.
- **Validate leaves.** A stale ID is dropped at resolve time, not rejected at
  write time. Context cannot check an ID it does not understand.
- **Authorise.** A resolved set is a membership statement. The read boundary is
  enforced downstream, from the frozen scope manifest.
- **Sort.** Entries are emitted in first-seen order. There is no canonical
  ordering or digest inside this capability.
