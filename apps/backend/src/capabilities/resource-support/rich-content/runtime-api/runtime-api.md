# Rich Content Runtime API

One directory per public method on `RichContentRuntime`, named after the method
in kebab-case, containing an entry file of the same name that owns that method's
complete orchestration. Supporting procedures used by only one method sit beside
it in its directory.

Each entry is a plain function taking the dependencies it needs — the store, and
the ID factory when it allocates identity — followed by the method's input. The
runtime object supplies them; nothing here reaches for a singleton.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `create` | [`create/`](create/create.md) | mutator | Builds one version-1 object from plain text and inserts it. |
| `replaceText` | [`replace-text/`](replace-text/replace-text.md) | mutator | Rewrites a range inside one text atom and moves displaced mark boundaries. |
| `applyStyle` | [`apply-style/`](apply-style/apply-style.md) | mutator | Adds one style mark over the selected range. |
| `removeStyle` | [`remove-style/`](remove-style/remove-style.md) | mutator | Strips named properties from overlapping style marks, splitting them at the selection. |
| `setLink` | [`set-link/`](set-link/set-link.md) | mutator | Clears links in the selection, then installs one link mark. |
| `removeLink` | [`remove-link/`](remove-link/remove-link.md) | mutator | Clears links in the selection, keeping the parts outside it. |
| `setList` | [`set-list/`](set-list/set-list.md) | mutator | Replaces the selected lines' list marks with one list. |
| `removeList` | [`remove-list/`](remove-list/remove-list.md) | mutator | Drops the selected lines' list marks. |
| `split` | [`split/`](split/split.md) | mutator | Consumes one object and creates two. |
| `combineAsList` | [`combine-as-list/`](combine-as-list/combine-as-list.md) | mutator | Consumes several objects and creates one list. |
| `display` | [`display/`](display/display.md) | accessor | Projects the current revision as `DisplayContent`. |

Every method on the exported interface appears here, and every directory appears
as a method. `pnpm lint` enforces both directions.

## Shared Procedures

[`shared/`](shared/shared.md) holds nine files. They fall into three groups:
the revision discipline (`revisions.ts`), the display boundary (`render-display.ts`,
`display-range.ts`, `raw-lines.ts`, `ranges.ts`), and the mark algebra
(`mark-pieces.ts`, `style.ts`, `link.ts`, `list.ts`). Each is used by two or
more methods, and each preserves an invariant that spans them — see that
document for which.

Four procedures are *not* shared, because exactly one method calls each:
`createRawContent`, `replaceAtomText`, `splitRawContent`, and
`combineRawContentAsList` live in their own method's directory.

## Common Shape

Eight of the eleven methods follow one pattern. Validation that needs no stored
state runs first, so an invalid request never touches the database:

```text
1. Validate the input that can be validated without loading (style properties,
   link targets, list presentation).
2. currentContent(store, contentId, expectedVersion)
   — loads, and fails stale-version if the stored revision differs.
3. Translate the display selection into a private raw range or line set.
4. Build the candidate atoms or marks.
5. commit(store, current, nextRevision(current, changes))
   — compare-and-swaps the revision, and fails stale-version if it lost.
6. Return { contentId, version }.
```

The three exceptions are structural. `create` has nothing to load. `display`
loads and projects without committing. `split` and `combineAsList` do not
compare-and-swap a row: they destroy rows and insert others, so they commit
through a transaction in the store and raise the same `stale-version` failure
when a conditional delete matches nothing.
