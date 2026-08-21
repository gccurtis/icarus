# Shared

The cross-cutting vocabulary: the types that belong to no single table. Six of
them, and every one is imported by capabilities that have nothing else in common.

## It has no public surface, and no table

There is no `api/`, no `schema.ts`, and no file under
[`src/convex/capabilities/`](../../../convex/). This capability is types and two
pure functions. A capability with no `api/` needs no deployment door, and
capability lint returns early rather than demanding one.

Nothing here is reachable by a caller. It is reachable by *capabilities*, which
import it by its bare alias.

## The boundary

**This capability owns what belongs to no single table.**

A type used by exactly one capability lives with that capability. It is promoted
here when a **second** one needs it — and promotion means the type genuinely
answers the same question for both, not that two call sites wanted the same
fields.

`Actor` is the case that sets the rule. It could have lived in `access`, since
users are what it mostly points at — but then every table in the application
would import the authorization capability for a reason unrelated to
authorization.

The reverse holds too. `Attachment` is not here: messages are its only consumer,
and it turned out not to be a type at all.

## Files

| File | Holds |
| --- | --- |
| [`types/actor.ts`](types/actor.ts) | `Actor` — who did something |
| [`types/resource.ts`](types/resource.ts) | `ResourceKind`, `ResourceRef`, `kindMatches` |
| [`types/resource-selection.ts`](types/resource-selection.ts) | `SetTerm`, `ResourceSelection`, `PortableSelection` |
| [`types/resource-set-expression.ts`](types/resource-set-expression.ts) | the selection shape `$model`'s copilot still compiles against |
| [`types/page-setup.ts`](types/page-setup.ts) | `PaperSize`, `PageSetup` — the physical sheet |
| [`types/style-set.ts`](types/style-set.ts) | `TextStyle`, `StyleSet` |

## Capability Invariants

- **A validator is the source of truth; the type is inferred from it.** Convex
  enforces the validator at the door, and a hand-written interface beside one is
  a second description that can disagree.
- **An id pointing at another table is `v.id`.** Every table is declared in one
  `defineSchema`, so there is no stage at which a named table does not exist —
  which is what makes the check free. A reference stays `v.string()` only where
  it is genuinely polymorphic and the kind beside it names the table.
- **Kind matching is segment-wise, never a string prefix.** `connector::google`
  must not match `connector::googlesheets`.
- **A selection is two flat lists, never a tree.** A Convex validator is a value
  and cannot name itself, so a tree would have to be unrolled to a fixed depth.
  What two lists cannot say directly, a named set says instead.
