# Capability Document Templates

Every directory in a capability carries a document named after itself, sitting
inside it. These are the templates for those documents. `pnpm new-capability` and
`pnpm new-api` copy from here with placeholders substituted; when writing one by
hand, copy the file and rename it to match its directory.

| Template | Copy to | Named |
| -------- | ------- | ----- |
| [overview.md](overview.md) | capability root | `overview.md` |
| [types.md](types.md) | `types/` | `types.md` |
| [api.md](api.md) | `api/` | `api.md` |
| [api-function.md](api-function.md) | `api/<function>/` | `<function>.md` |
| [api-shared.md](api-shared.md) | `api/shared/` | `shared.md` |
| [persistence.md](persistence.md) | `persistence/` | `persistence.md` |

[reviewing-a-capability.md](../reviewing-a-capability.md) is not a template. It is
the review checklist the structure exists to make possible.

## Rules

- `test/` and everything below it carries no document. Nested procedure
  directories carry none either — the function's own document holds the whole
  procedure tree.
- `docs/` inside a capability holds supporting material belonging to no single
  directory: an algorithm derivation, a revision model, a migration note.
  Anything describing what a directory contains belongs in that directory.
- Delete the sections a capability does not need. An empty table with
  placeholders left in it is worse than an absent section.
- A document states what its directory is for and what belongs in it. It does not
  restate the code.
- An unsubstituted `{{placeholder}}` is a defect. Every one the generator could
  not fill becomes a `TODO`, so one grep finds every decision a generated
  document is still waiting on.

## What has no template, and why

There is no template for a runtime object, an endpoint, or a wire format.
Capabilities are procedural — they have no runtime object — and there are no
endpoints: a function's `.remote.ts` is three lines described by the function's
own document, and the types cross the boundary on their own. Objects live in
[`$runtime`](../../../src/lib/runtime) and are not governed by this set.
