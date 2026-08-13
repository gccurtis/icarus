# Rich Content Implementation Flow

This document follows the active Rich Content implementation from construction
to reads and mutations. Every file linked below participates in behavior that
runs today.

## Implementation Layers

- [Backend initialization](../../../../../src/main.ts)
  - [Rich Content runtime constructor](../../../../../src/capabilities/resources/support/rich-content/runtime-constructors/rich-content.ts)
    - [PGlite store](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts)
    - [ID factory](../../../../../src/capabilities/resources/support/rich-content/runtime-constructors/id-factory.ts)
    - [Runtime](../../../../../src/capabilities/resources/support/rich-content/runtime.ts)
      - [Display-range translation](../../../../../src/capabilities/resources/support/rich-content/domain/display-range.ts)
      - [Domain mutations](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/replace-text.ts)
      - [Display projection](../../../../../src/capabilities/resources/support/rich-content/domain/render-display.ts)
      - [PGlite store](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts)

The layers have distinct responsibilities:

| Layer | Responsibility |
| ----- | -------------- |
| Runtime constructor | Creates the capability singleton and initializes its table. |
| Runtime | Implements the public API and coordinates each procedure. |
| Domain | Translates selections, validates intent, and creates candidate raw state. |
| Persistence | Reads canonical state and commits it with revision gates. |
| Projection | Converts private Raw Content into public Display Content. |

## Initialization Procedure

- [`buildRuntime()`](../../../../../src/main.ts)
  1. Create Platform Persistence.
  2. Call [`createRichContentRuntime(database)`](../../../../../src/capabilities/resources/support/rich-content/runtime-constructors/rich-content.ts).
     1. Construct [`PGliteRichContentStore`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts).
     2. Initialize the capability-owned `rich_content` table.
     3. Create the UUID-backed [ID factory](../../../../../src/capabilities/resources/support/rich-content/runtime-constructors/id-factory.ts).
     4. Construct one [`PersistedRichContentRuntime`](../../../../../src/capabilities/resources/support/rich-content/runtime.ts).
  3. Store that singleton on the backend runtime object.

The runtime receives the shared database but owns its store and schema. It does
not receive the web server or registry because no transport is implemented for
this capability yet.

## Stored Model

The private model lives in
[`domain/model.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/model.ts).

```text
rich_content row
├── id                 RichContentId
├── revision           optimistic-concurrency version
├── raw_content        JSONB
│   ├── atoms[]
│   │   ├── text       canonical string payload
│   │   └── line-break logical line boundary
│   └── marks[]
│       ├── style      style properties over a raw range
│       ├── link       link targets over a raw range
│       └── list-item  list identity and presentation for one line
└── updated_at
```

Atom order determines canonical content order. Mark ranges refer to atom IDs and
UTF-16 offsets. Display lines and segments are derived and are never stored.

## Create Procedure

- [`runtime.create(initialText)`](../../../../../src/capabilities/resources/support/rich-content/runtime.ts)
  1. Generate a content ID.
  2. Call [`createRawContent`](../../../../../src/capabilities/resources/support/rich-content/domain/model.ts).
     1. Split `initialText` at newline characters.
     2. Create one `TextAtom` for each logical line.
     3. Create one `LineBreakAtom` between adjacent lines.
     4. Produce version-1 Raw Content with no marks.
  3. Call [`store.create`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts).
  4. Return `contentId` and `version`.

## Display Procedure

- [`runtime.display(contentId)`](../../../../../src/capabilities/resources/support/rich-content/runtime.ts)
  1. Load Raw Content through [`store.find`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts).
     - If no row exists, throw `content-not-found`.
  2. Call [`renderDisplayContent`](../../../../../src/capabilities/resources/support/rich-content/domain/render-display.ts).
     1. Partition atoms at `LineBreakAtom` boundaries.
     2. Find every style and link boundary inside each `TextAtom`.
     3. Split each `TextAtom` into display-only text segments at those boundaries.
     4. Resolve the style and links active across each segment.
     5. Resolve optional list presentation for each line.
     6. Generate version-bound line and segment IDs.
  3. Return Display Content without raw marks or raw atom objects.

The text is not duplicated into a second stored model. Display Content is
recomputed from the current Raw Content whenever it is requested.

## Ordinary Mutation Procedure

Text, style, link, and list mutations share one orchestration pattern:

- [Runtime mutation](../../../../../src/capabilities/resources/support/rich-content/runtime.ts)
  1. Load the current Raw Content.
  2. Compare the current version with `expectedVersion`.
     - If the versions differ, throw `stale-version` without changing state.
  3. Validate and translate the mutation input.
  4. Call the corresponding domain mutation to create candidate atoms or marks.
  5. Build a Raw Content candidate with `version + 1`.
  6. Call [`store.compareAndSwap`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts).
     1. `UPDATE WHERE id = contentId AND revision = expectedVersion`.
     2. If another writer changed the revision, update zero rows and throw `stale-version`.
  7. Return `contentId` and the committed version.

The domain layer does not write to the database. It produces a candidate, and
the store is the only persistence boundary.

### Text Replacement

- [`replaceText`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/replace-text.ts)
  1. Locate the `TextAtom` by its opaque atom ID.
  2. Validate its atom-relative range.
  3. Reject newline insertion; line structure is changed through split today.
  4. Replace the selected text.
  5. Move or contract affected mark boundaries.

### Style Mutation

- [`applyStyle` / `removeStyle`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/style.ts)
  1. Use [display-range translation](../../../../../src/capabilities/resources/support/rich-content/domain/display-range.ts)
     to resolve versioned segment positions to a private `RawRange`.
  2. Validate a non-empty selection and style properties.
  3. Add a `StyleMark`, or split existing marks and remove selected properties.

### Link Mutation

- [`setLink` / `removeLink`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/link.ts)
  1. Resolve the `DisplayRange` to a private `RawRange`.
  2. Validate link targets.
  3. Preserve portions of existing link marks outside the selection.
  4. Add the replacement `LinkMark` when setting a link.

Style and link removal share
[`mark-pieces.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/mark-pieces.ts)
to retain mark ranges before and after the removed selection.

### List Mutation

- [`setList` / `removeList`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/list.ts)
  1. Resolve a `DisplayRange` to complete logical lines.
  2. Validate the marker, starting number, and separator.
  3. Add or replace one `ListItemMark` per selected line, or remove those marks.
  4. Preserve text atoms; markers and separators remain derived display chrome.

## Split Procedure

Split is not an in-place update. It consumes one object and creates two:

- [`runtime.split(input)`](../../../../../src/capabilities/resources/support/rich-content/runtime.ts)
  1. Load the source and verify `expectedVersion`.
  2. Resolve the `DisplayPosition` to a private `RawPosition`.
  3. Call [`splitRawContent`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/split-content.ts).
     1. Generate fresh atom IDs for both new objects.
     2. Divide the selected `TextAtom` at the raw offset.
     3. Consume a `LineBreakAtom` when splitting at an existing line boundary.
     4. Copy or divide style and link marks across the results.
     5. Drop list-item marks so both results are ungrouped.
  4. Call [`store.replaceOneWithTwo`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts).
     1. Begin a database transaction.
     2. Delete the source only where its revision still matches.
     3. Insert both version-1 results.
     4. If the conditional delete fails, roll back and throw `stale-version`.
  5. Return the two new content IDs and versions.

After success, the original `RichContentId` no longer resolves.

## Combine-as-List Procedure

Combining is also a consume-and-create operation:

- [`runtime.combineAsList(input)`](../../../../../src/capabilities/resources/support/rich-content/runtime.ts)
  1. Validate a non-empty set of unique source IDs and list presentation.
  2. Load every source and verify every `expectedVersion`.
  3. Call [`combineAsList`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/combine-as-list.ts).
     1. Require exactly one logical line in each source.
     2. Generate one replacement content ID and one shared list ID.
     3. Copy atoms with fresh IDs in caller-provided order.
     4. Remap style and link marks to the copied atoms.
     5. Insert `LineBreakAtom`s between items.
     6. Add one `ListItemMark` for each item.
  4. Call [`store.replaceManyWithOne`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts).
     1. Begin a database transaction.
     2. Conditionally delete each source at its expected revision.
     3. Insert the version-1 replacement.
     4. If any conditional delete fails, roll back everything and throw `stale-version`.
  5. Return the replacement content ID and version.

This operates on raw atoms and marks, not concatenated display strings. That is
why style and link information survives grouping. A multiline source must be
split into independent objects before it can become one list item.

## Persistence and Compatibility

[`PGliteRichContentStore`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts)
owns all reads and writes to the `rich_content` table. Its table shape is added
to the shared database type by
[`persistence/schema.ts`](../../../../../src/capabilities/resources/support/rich-content/persistence/schema.ts).

The store implements three write shapes:

| Write | Use | Atomicity |
| ----- | --- | --------- |
| `compareAndSwap` | One existing object becomes its next revision. | One conditional update. |
| `replaceOneWithTwo` | Split consumes one object and creates two. | One transaction. |
| `replaceManyWithOne` | List grouping consumes multiple objects and creates one. | One transaction. |

On reads, the store translates the retired persisted discriminator
`"hard-break"` into the current `"line-break"` atom. Current writes always use
`"line-break"`.

## Error Flow

Stable capability errors are declared in
[`errors.ts`](../../../../../src/capabilities/resources/support/rich-content/errors.ts).

| Error | Meaning |
| ----- | ------- |
| `content-not-found` | No current object exists for the requested content ID. |
| `stale-version` | The caller's expected version is old or CAS lost a race. |
| `atom-not-found` | A text mutation references no current text atom. |
| `invalid-atom-range` | An atom-relative text range is invalid. |
| `invalid-display-range` | A display handle is invalid, stale, reversed, or empty where prohibited. |
| `invalid-style` | Style properties are empty or invalid. |
| `invalid-link` | Link targets are empty or invalid. |
| `invalid-list-presentation` | The marker, starting number, or separator is invalid. |
| `invalid-list-source` | List combination has no sources, duplicate sources, or a multiline source. |
| `unsupported-text` | Text replacement attempts to insert a newline. |

## Verification

The current behavior is exercised in
[`test/rich-content.test.ts`](../../../../../test/rich-content.test.ts), including
persistence, stale revisions, styles, links, custom lists, split ownership,
combine ownership, old line-break compatibility, and transactional rollback.
