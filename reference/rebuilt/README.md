# rebuilt

Three capabilities from the SvelteKit application, frozen. They are a later
generation than [`../capabilities/`](../capabilities/), which holds the
pre-rebuild backend, and are kept apart so neither record describes the other.

Nothing here is compiled, type-checked, imported, or executed. Every one of them
reaches its data through `projectDatabase(scope.projectId)`, so none of them
compiles against the current tree.

| | Files | Lines TS | Public functions |
| --- | --- | --- | --- |
| `settings` | 27 | 1,217 | 3 |
| `name-manager` | 42 | 2,522 | 4 |
| `rich-content` | 69 | 4,873 | 11 |

## What is worth copying out

**The pure logic, which is most of it, and which no database touches.**

- `name-manager/api/define/canonical-{type,value,date,variable}.ts` and
  `api/shared/canonical-name.ts` — the scalar/list/record type system, its value
  admission, and name canonicalization. 523 lines of pure functions.
- `rich-content/api/shared/{render-display,display-range,ranges,raw-lines,mark-pieces,style,link,list}.ts`
  plus `split-raw-content.ts`, `combine-raw-content.ts`, and
  `replace-atom-text.ts` — offsets, marks over ranges, and the display
  projection. ~1,200 lines, likewise pure.
- `settings/api/{set/canonical-value,shared/canonical-key}.ts` — 139 lines.

**One thing to carry rather than rewrite:** `rich-content/persistence/stored-types.ts`
holds `currentAtoms`, which rewrites a retired `hard-break` atom kind to
`line-break` on read. Any store holding content written before that rename needs
it.

## What is not worth copying

`persistence/` in all three — table types, DDL, and a schema-drift check that a
store validating its own schema does better.

`api/shared/revisions.ts` in `rich-content` — 233 lines of compare-and-swap and
two rollback transactions, which a store with serializable transactions makes
unnecessary. Only `nextRevision` and the stale-version check carry over.

Every `.remote.ts`, both doors, and `api/shared/stated.ts` — all of them serve
the SvelteKit boundary.
