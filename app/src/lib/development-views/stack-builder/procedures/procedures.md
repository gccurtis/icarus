# Stack Builder Procedures

Lives at `src/lib/development-views/stack-builder/procedures/procedures.md`.

## What is here

Six named steps, none of them holding state.

| Procedure | In | Out |
| --- | --- | --- |
| [`manifest.ts`](manifest.ts) | a node list and an operation | a new node list |
| [`catalogue.ts`](catalogue.ts) | the two globs | the hundred entries, sorted |
| [`models.ts`](models.ts) | — | the model ids the chooser offers |
| [`admission.server.ts`](admission.server.ts) | a client string | whether it may become a path |
| [`prompt.server.ts`](prompt.server.ts) | a stack, the token layer, component source | the two messages |
| [`log.server.ts`](log.server.ts) | a file name, a record | the log, the mock, the token text |

## Why two of them are the server's

`admission` and `prompt` are pure, but only the route handlers call them, and a
handler may not reach client code. A `.server.ts` is the server's by filename
wherever it sits, which is what lets them live beside the procedures they belong
with instead of somewhere a route could reach relatively.

The cost is that their tests are the one thing in the surface that names a server
module, which `surface-imports` reports. That is the trade taken deliberately:
the alternative is untested admission, and admission is what stands between a
typed file name and a write outside `logs/`.

## Why the catalogue identifies components by identity

A vocabulary index exports more than components — chart helpers, aliases, types.
Neither `typeof value === "function"` nor an arity test separates them, because
every export is a function and some helpers have a component's arity. An export
is a component when it is the default of a file the component glob found, and
that is the only test that holds.

The entries are sorted explicitly. An eager glob's key order is source order
under the dev server and sorted in a browser build, so an unsorted catalogue
would quietly reorder between the two.

## Why nothing here reads a stylesheet through the alias

`log.server.ts` names the eight token files by path segment. The alias spelling
is matched in raw text by the check that keeps one stylesheet entry, and a file
that only reads them is not an entry.
