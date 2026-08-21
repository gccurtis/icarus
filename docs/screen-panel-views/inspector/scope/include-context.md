# Another Context

| Selecting | What it is | Sections |
| --- | --- | --- |
| A reference to another saved Context, on either half | Whatever that Context contains at the moment this one is read | Rule · Right now · Chain · Actions |

A reference, not a copy. Editing the referenced Context changes this one.

## Layout

| 300px |
| --- |
| rule |
| right now |
| chain |
| actions |

## Rule

**Shows** — "Whatever **Regulatory corpus** contains at the moment this one is
read."

**Needs** — the referenced `ResourceSet`.

## Right now

What it currently contributes, and whether the reference is safe.

**Shows** — `Matches · 34`, `Circular · No`

**Needs** — a resolve of the referenced set, and a cycle check.

**Open** — a cycle has to be detected at save time as well as at read time, or a
Context can be saved into a state that fails only when something tries to use it.

## Chain

How deep the reference goes. Starts collapsed.

**Shows** — "Everything but drafts → Regulatory corpus → Filings"

**Needs** — the full reference chain from the resolver.

**Open** — chain depth needs a limit. Three is readable; six is not, and the panel
has no way to render it.

## Actions

**Open that Context** switches to it. **Remove** deletes the term.
