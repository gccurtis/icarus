# Model Document Templates

Every directory in a model object carries a document named after itself, sitting
inside it. These are the templates for those documents. `pnpm new-model-object`
copies from here with placeholders substituted; when writing one by hand, copy
the file and rename it to match its directory.

| Template | Copy to | Named |
| -------- | ------- | ----- |
| [object.md](object.md) | object root | `<object>.md` |
| [methods.md](methods.md) | `methods/` | `methods.md` |
| [method.md](method.md) | `methods/<complex-method>/` | `<complex-method>.md` |
| [methods-shared.md](methods-shared.md) | `methods/shared/` | `shared.md` |

[model-directory.md](../model-directory.md) is not a template. It is the
standard these documents record compliance with.

## Rules

- `test/` and everything below it carries no document. Nested supporting-method
  directories carry none either — the complex method's own document holds the
  whole method tree.
- `docs/` inside an object holds supporting material belonging to no single
  directory: a state-machine derivation, a persistence-format note, a migration
  record. Anything describing what a directory contains belongs in that
  directory.
- Delete the sections an object does not need. An empty table with placeholders
  left in it is worse than an absent section.
- A document states what its directory is for and why it is shaped that way. It
  does not restate the code.
- An unsubstituted `{{placeholder}}` is a defect. Every one the generator could
  not fill becomes a `TODO`, so one grep finds every decision a generated
  document is still waiting on.

## What has no template, and why

`model.md` has none: there is exactly one, at `model/`, and it is written by
hand. A template for a document that exists once is a copy, not a template. The
same holds for the environment roots — a root composes a graph through
`build<Environment>Model()` rather than owning state, so it is not an object and
this set does not describe it.

`types.ts`, `test/`, and `docs/` have none either, matching the capability set.
Documents attach to directories, and `types.ts` is a file: the object's contract
is recorded in `<object>.md`, beside the methods and invariants that give it
meaning. `test/` is proof rather than explanation, and `docs/` holds material
whose subject is named by the file itself.
