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
| [`types/mention.ts`](types/mention.ts) | `Mention` — who a remark is addressed to |
| [`types/resource.ts`](types/resource.ts) | `ResourceKind`, `ResourceRef`, `kindMatches` |
| [`types/resource-set-expression.ts`](types/resource-set-expression.ts) | `ResourceSetExpression`, `Selector`, `normalize` |
| [`types/page-setup.ts`](types/page-setup.ts) | `PaperSize`, `PageSetup` — the physical sheet |
| [`types/style-set.ts`](types/style-set.ts) | `TextStyle`, `StyleSet` |

## Capability Invariants

- **A validator is the source of truth; the type is inferred from it.** Convex
  enforces the validator at the door, and a hand-written interface beside one is
  a second description that can disagree.
- **Every id is a plain `string`, never `Id<"table">`.** Tables land in stages,
  and typing an id against a table that does not exist yet means loosening it and
  re-tightening it across dozens of files — for a check that only ever held
  inside one deployment.
- **A stored `ResourceSetExpression` is canonical.** `normalize` runs on write,
  because a canonical form is the only thing that makes two sets comparable.
- **Kind matching is segment-wise, never a string prefix.** `connector::google`
  must not match `connector::googlesheets`.
