# Capability Document Templates

Every directory in a capability carries a document named after itself, sitting
inside it. These are the templates for those documents. `pnpm new-capability`,
`pnpm new-runtime-api`, and `pnpm new-endpoint` copy from here with placeholders
substituted; when writing one by hand, copy the file and rename it to match its
directory.

| Template | Copy to | Named |
| -------- | ------- | ----- |
| [overview.md](overview.md) | capability root | `overview.md` |
| [types.md](types.md) | `types/` | `types.md` |
| [runtime-objects.md](runtime-objects.md) | `runtime-objects/` | `runtime-objects.md` |
| [runtime-object.md](runtime-object.md) | `runtime-objects/<object>/` | `<object>.md` |
| [runtime-api.md](runtime-api.md) | `runtime-api/` | `runtime-api.md` |
| [runtime-api-method.md](runtime-api-method.md) | `runtime-api/<method>/` | `<method>.md` |
| [runtime-api-shared.md](runtime-api-shared.md) | `runtime-api/shared/` | `shared.md` |
| [persistence.md](persistence.md) | `persistence/` | `persistence.md` |
| [endpoints.md](endpoints.md) | `endpoints/` | `endpoints.md` |
| [endpoint.md](endpoint.md) | `endpoints/<endpoint>/` | `<endpoint>.md` |
| [endpoint-procedures.md](endpoint-procedures.md) | `endpoints/<endpoint>/procedures/` | `procedures.md` |

[reviewing-a-capability.md](reviewing-a-capability.md) is not a template. It is
the review checklist the structure exists to make possible.

## Rules

- `test/` and everything below it carries no document. `wire/` carries none
  either — the endpoint's own document describes it.
- `docs/` inside a capability holds supporting material that belongs to no single
  directory: a revision model, an algorithm derivation, a migration note.
  Anything describing what a directory contains belongs in that directory.
- Delete the sections a capability does not need. An empty table with
  placeholders left in it is worse than an absent section.
- A document states what its directory is for and what belongs in it. It does
  not restate the code.
