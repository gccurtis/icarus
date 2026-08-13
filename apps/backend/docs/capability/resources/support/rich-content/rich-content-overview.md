# Rich Content Overview

This is the detailed capability contract. For a shorter introduction, start at
the [Rich Content capability guide](README.md). For linked execution procedures,
read the [implementation flow](implementation.md).

## Description

Rich Content manages canonical editable content for resource capabilities.

Each content object has a runtime-generated ID and a private raw representation
made of ordered atoms and marks. Consumers receive opaque atom handles in a
versioned Display Content projection. They never receive raw atom objects or
marks.

The implemented runtime supports content creation, text-atom replacement,
styles, links, ordered and unordered lists, splitting one content object into
two, combining several content objects into one list, and display rendering.
Raw Content is persisted in PGlite; every mutation uses compare-and-swap (CAS)
against the expected revision.

## File Tree

- `rich-content/`
  - [`index.ts`](../../../../../src/capabilities/resources/support/rich-content/index.ts) — public exports
  - [`types.ts`](../../../../../src/capabilities/resources/support/rich-content/types.ts) — public IDs, mutation inputs, and display types
  - [`errors.ts`](../../../../../src/capabilities/resources/support/rich-content/errors.ts) — stable runtime error codes
  - [`runtime.ts`](../../../../../src/capabilities/resources/support/rich-content/runtime.ts) — public API and load → procedure → CAS orchestration
  - `domain/`
    - [`model.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/model.ts) — private atoms, marks, lines, and stored state
    - [`ranges.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/ranges.ts) — private raw-position comparison and overlap
    - [`display-range.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/display-range.ts) — display selection to raw range/lines
    - [`render-display.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/render-display.ts) — raw-to-display projection
    - `mutations/`
      - [`replace-text.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/replace-text.ts) — text replacement and mark-boundary movement
      - [`style.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/style.ts) — style validation, apply, and remove
      - [`link.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/link.ts) — link validation, set, and remove
      - [`list.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/list.ts) — list validation, set, and remove
      - [`split-content.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/split-content.ts) — split one raw object into two new objects
      - [`combine-as-list.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/combine-as-list.ts) — combine independent raw objects as list items
      - [`mark-pieces.ts`](../../../../../src/capabilities/resources/support/rich-content/domain/mutations/mark-pieces.ts) — preserves mark pieces outside a removed range
  - `persistence/`
    - [`schema.ts`](../../../../../src/capabilities/resources/support/rich-content/persistence/schema.ts) — capability-owned Kysely table type
    - [`store.ts`](../../../../../src/capabilities/resources/support/rich-content/persistence/store.ts) — schema initialization, reads, inserts, and CAS updates
  - `runtime-constructors/`
    - [`rich-content.ts`](../../../../../src/capabilities/resources/support/rich-content/runtime-constructors/rich-content.ts) — singleton constructor
    - [`id-factory.ts`](../../../../../src/capabilities/resources/support/rich-content/runtime-constructors/id-factory.ts) — content, atom, mark, and list ID generation
- [`main.ts`](../../../../../src/main.ts) — creates one Rich Content runtime during backend initialization
- [`rich-content.test.ts`](../../../../../test/rich-content.test.ts) — current runtime behavior

## Dependency Ports

| Dependency | Usage |
| ---------- | ----- |
| Platform Persistence | Supplies the shared Kysely/PGlite database used by the capability-owned store. |

The runtime does not receive the web server, route registry, configuration, or
observability runtime.

## Runtime Object

`RichContentRuntime` is a stateful, runtime-scoped singleton. One is created for
each `buildRuntime()` call and stored on the backend runtime object.

The implementation coordinates a capability-owned PGlite store and an ID
factory. It is the only public object allowed to request raw-state mutations;
the store is the only object that reads and writes persisted Raw Content.

### Runtime Fields

| Field | Visibility | Description |
| ----- | ---------- | ----------- |
| `store` | private | Reads, creates, and CAS-updates persisted Raw Content. |
| `ids` | private | Generates every content, atom, mark, and list ID. |

### Construction Procedure

```text
buildRuntime()
  1. Construct configuration, observability, and the database.
  2. createRichContentRuntime(database) constructs PGliteRichContentStore.
  3. Initialize the capability-owned rich_content table if it does not exist.
  4. Create a UUID-backed ID factory.
  5. Construct one PersistedRichContentRuntime with the store and factory.
  6. Store it on the backend runtime for capability consumers.
```

## Ownership Boundary

Rich Content owns:

- content IDs and Raw Content objects;
- atom, mark, and list IDs;
- raw atom and mark representation;
- version checks and mutation validation;
- text, style, link, list, split, and combine mutations;
- the `rich_content` table and its revision invariant;
- translation from Raw Content into Display Content.

Consumers own:

- the resource field that refers to a `RichContentId`;
- the intent to create, edit, style, link, list, or display content;
- resource authorization, revision, and conflict rules outside Rich Content;
- rendering the returned Display Content.

The runtime does not expose `getRawContent`, raw atom arrays, mark arrays, or a
raw-content replacement API. An `AtomId` crosses the boundary only as an opaque
mutation handle.

## Raw Content

Raw Content is private runtime state.

```ts
interface RawContent {
  readonly id: RichContentId;
  readonly version: number;
  readonly atoms: readonly RawAtom[];
  readonly marks: readonly RawMark[];
}

type RawAtom = TextAtom | LineBreakAtom;

interface TextAtom {
  readonly id: AtomId;
  readonly kind: "text";
  readonly text: string;
}

interface LineBreakAtom {
  readonly id: AtomId;
  readonly kind: "line-break";
}

type RawMark = StyleMark | LinkMark | ListItemMark;
```

List item text is stored in ordinary text atoms. Line-break atoms divide the
content into logical lines. Each line contains at least one text atom,
including an empty line.

### Style and Link Marks

```ts
interface StyleMark {
  readonly id: string;
  readonly kind: "style";
  readonly range: RawRange;
  readonly properties: StyleProperties;
}

interface LinkMark {
  readonly id: string;
  readonly kind: "link";
  readonly range: RawRange;
  readonly targets: readonly LinkTarget[];
}
```

Style marks carry any combination of visual properties. Bold, italic, and
underline are properties, not separate mark kinds. Link marks carry URL or
resource targets. Both may span atoms and lines, and both remain private.

### List Item Mark

```ts
interface ListItemMark {
  readonly id: string;
  readonly kind: "list-item";
  readonly range: RawRange;
  readonly listId: ListId;
  readonly presentation: ListPresentation;
}

type ListPresentation =
  | {
      readonly kind: "unordered";
      readonly marker: string;
      readonly separator: string;
    }
  | {
      readonly kind: "ordered";
      readonly start: number;
      readonly separator: string;
    };
```

One `ListItemMark` covers one complete logical line. Adjacent marks with the
same `listId` form one list. The presentation belongs to that list:

- an unordered marker can be any non-empty string without a line break;
- an ordered list derives numeric markers beginning at any safe integer;
- either list kind accepts any separator string without a line break, including
  an empty separator.

Markers and separators are not text atoms. They are derived display chrome and
cannot be selected or edited as canonical text.

## Display Content

Display Content is the public, read-only projection.

```ts
interface DisplayContent {
  readonly contentId: RichContentId;
  readonly version: number;
  readonly lines: readonly DisplayLine[];
}

interface DisplayLine {
  readonly id: DisplayLineId;
  readonly list?: DisplayListItem;
  readonly segments: readonly TextDisplaySegment[];
}

interface DisplayListItem {
  readonly listId: ListId;
  readonly kind: "ordered" | "unordered";
  readonly marker: string;
  readonly separator: string;
}

interface TextDisplaySegment {
  readonly id: DisplaySegmentId;
  readonly kind: "text";
  readonly atomId: AtomId;
  readonly atomRange: AtomTextRange;
  readonly text: string;
  readonly style: ResolvedStyle;
  readonly links: readonly LinkTarget[];
}
```

Every display line corresponds to one raw logical line. Its optional `list`
field contains the marker and separator the consumer renders before the line's
segments. Neither contributes to editable offsets.

Each text segment exposes its owning `atomId` and range within that atom. This
lets an editor translate a selection into `replaceText` without receiving the
raw atom object.

Style and link boundaries split atoms into display segments. Each segment gets
one resolved style and the active, deduplicated link targets. Segment and line
IDs include the content version, so a `DisplayRange` is valid only with the
revision that produced it.

## Public API

```ts
interface RichContentRuntime {
  create(initialText?: string): Promise<ContentMutationResult>;
  replaceText(input: ReplaceTextInput): Promise<ContentMutationResult>;
  applyStyle(input: ApplyStyleInput): Promise<ContentMutationResult>;
  removeStyle(input: RemoveStyleInput): Promise<ContentMutationResult>;
  setLink(input: SetLinkInput): Promise<ContentMutationResult>;
  removeLink(input: RemoveLinkInput): Promise<ContentMutationResult>;
  setList(input: SetListInput): Promise<ContentMutationResult>;
  removeList(input: RemoveListInput): Promise<ContentMutationResult>;
  split(input: SplitContentInput): Promise<SplitContentResult>;
  combineAsList(input: CombineAsListInput): Promise<ContentMutationResult>;
  display(id: RichContentId): Promise<DisplayContent>;
}
```

There is no Rich Content HTTP API. Resource capabilities will decide which
runtime mutations to expose through their own transports.

## API: `create`

`create(initialText?)` creates one content object. Newlines in the initial text
are translated into line-break atoms and addressable text atoms for every line.

```text
create(initialText?)
  1. Generate a RichContentId.
  2. Split initialText into logical lines at newline characters.
  3. Generate one TextAtom for every line.
  4. Generate one LineBreakAtom between adjacent lines.
  5. Insert version-1 Raw Content into rich_content as JSONB.
  6. Return only the content ID and version.
```

## API: `replaceText`

`replaceText` changes the canonical value of one text atom. Its half-open range
uses UTF-16 offsets within that atom, matching JavaScript string offsets.

Replacement text cannot contain a newline in this increment. Consumers can
create multiline content, but inserting or removing line boundaries after
creation is not implemented yet.

```text
replaceText(input)
  1. Find Raw Content by contentId.
  2. Verify expectedVersion matches its current version.
  3. Find the private text atom by the opaque atomId.
  4. Validate the range, including surrogate-pair boundaries.
  5. Replace the selected canonical text.
  6. Transform affected style, link, and list mark boundaries.
  7. Build the next Raw Content revision.
  8. CAS update WHERE id = contentId AND revision = expectedVersion.
  || zero rows updated
     8.a.1. Reject with stale-version; another writer committed first.
  9. Return only the content ID and new version.
```

## APIs: `applyStyle` and `removeStyle`

Style mutations accept a versioned `DisplayRange`. The runtime maps display
segment offsets back to private atom positions.

```text
applyStyle(input)
  1. Validate that at least one known style property has a valid value.
  2. Load Raw Content and verify expectedVersion.
  3. Recreate Display Content and resolve the non-empty Display Range.
  4. Add one private StyleMark for that raw range.
  5. CAS commit the next revision.
```

`removeStyle` removes only the requested properties. It splits overlapping
style marks before and after the selection and preserves every unrequested
property inside the selection.

## APIs: `setLink` and `removeLink`

`setLink` validates and copies one or more URL/resource targets. It removes or
splits existing link marks inside the selected range, then installs one link
mark containing the new targets. `removeLink` performs the same range splitting
without adding a replacement. Both commit through CAS.

## APIs: `setList` and `removeList`

List mutations accept a versioned `DisplayRange`. A selection touching any
part of a line affects that complete logical line. When a selection ends at
offset zero on a later line, that final line is excluded.

```text
setList(input)
  1. Validate the custom presentation.
  2. Find Raw Content and verify expectedVersion.
  3. Recreate Display Content for that version.
  4. Resolve the Display Range to complete logical lines.
  5. Reuse a compatible neighboring listId, or generate a new one.
  6. Replace list marks on selected lines with one mark per line.
  7. Build the next revision and commit it through CAS.
  8. Return only the content ID and new version.
```

`removeList` follows the same selection procedure and removes the selected
lines' list marks without changing their text atoms.

## API: `split`

`split` consumes one existing content object and creates two independent
content objects. The split point is a position from that content's versioned
Display Content. This is the operation an editor can use when Enter should turn
one content object into two ungrouped objects.

```text
split(input)
  1. Find the source Raw Content and verify expectedVersion.
  2. Resolve the Display Position to a private atom position.
  3. Generate two new content IDs.
  4. Copy the atoms before the position into the left object.
  5. Split the selected text atom between the two objects.
  6. Copy the atoms after the position into the right object.
  7. If the position is an existing line boundary, consume its line break so
     neither result gains an artificial empty line.
  8. Copy or divide overlapping style and link marks onto the new atoms.
  9. Omit list-item marks so both results are independent and ungrouped.
  10. In one transaction, conditionally delete the source revision and insert
     both new version-1 objects.
  || the source revision no longer matches
     10.a.1. Roll back the complete transaction and reject with stale-version.
  11. Return the two new content IDs and versions.
```

The source ID no longer exists after a successful split. The operation does not
modify the source in place because ownership of both resulting objects must be
explicit.

## API: `combineAsList`

`combineAsList` consumes independent content objects in caller-provided order
and creates one replacement content object. Each source becomes exactly one
list item. A source must therefore contain one logical line; a multiline source
must be separated with `split` first.

```text
combineAsList(input)
  1. Validate that the source list is non-empty and contains unique content IDs.
  2. Validate the ordered or unordered list presentation.
  3. Find every source and verify every expectedVersion.
  4. Require one logical line in each source object.
  5. Generate one replacement content ID and one shared list ID.
  6. Copy each source's atoms in order, generating new atom IDs.
  7. Copy style and link marks onto their corresponding new atoms.
  8. Insert line breaks between items and add one list-item mark per source.
  9. In one transaction, conditionally delete every source revision and insert
     the version-1 replacement object.
  || any source revision no longer matches
     9.a.1. Roll back every deletion and reject with stale-version.
  10. Return the replacement content ID and version.
```

The copying procedure is atom-based rather than text-based. It preserves the
semantic atom sequence and inline marks instead of flattening each source to
display text. The current model contains text and line-break atoms; future
non-text atom kinds can participate by defining how that atom is copied.

## API: `display`

```text
display(contentId)
  1. Read the latest Raw Content revision from PGlite.
  2. Partition atoms into logical lines at line breaks.
  3. Split text atoms at every style and link boundary.
  4. Resolve ordered style marks and active link targets for each segment.
  5. Attach each segment's opaque atom handle and atom-relative range.
  6. Resolve each line's list mark, if present.
  || unordered
     6.a.1. Return its custom marker and separator.
  || ordered
     6.b.1. Derive its marker from start and preceding adjacent list items.
     6.b.2. Return the derived marker and custom separator.
  7. Return versioned Display Content without raw atoms or marks.
```

## Persistence and CAS

Rich Content owns one table:

| Column | Type | Purpose |
| ------ | ---- | ------- |
| `id` | `text` primary key | Stable Rich Content identity. |
| `revision` | `integer` | Current optimistic-concurrency revision. |
| `raw_content` | `jsonb` | Private atoms and marks. |
| `updated_at` | `timestamptz` | Time of the latest successful write. |

Ordinary in-place mutations first verify the caller's `expectedVersion`, then
commit with:

```sql
UPDATE rich_content
SET revision = expected_version + 1, raw_content = candidate
WHERE id = content_id AND revision = expected_version;
```

The revision predicate is the concurrency gate. Even when two runtimes read the
same revision, PGlite allows only the first conditional update to affect a row.
The second receives `stale-version` and cannot overwrite the winner.

`split` and `combineAsList` use the same revision predicate inside database
transactions. They conditionally delete the consumed row or rows and insert the
new row or rows as one atomic unit. If any predicate fails, PGlite rolls back
all deletions and insertions, so the operation cannot leave a partial result.

The store translates the retired `"hard-break"` JSONB discriminator to the
current `"line-break"` atom when reading older rows. A later successful mutation
persists that content using the current name.

## Capability Invariants

- Every content, atom, mark, and list ID is generated by Rich Content.
- Raw atom objects and marks never cross the public runtime boundary.
- A surviving atom keeps its ID when its text changes.
- Canonical text mutations target an atom ID and atom-relative range.
- Style and link mutations target a versioned Display Range.
- List mutations target a versioned Display Range and affect complete lines.
- Split consumes one expected source revision and atomically creates two new
  version-1 objects; the source ID is destroyed.
- List combination consumes one expected revision per source and atomically
  creates one new version-1 object; every source ID is destroyed.
- Each source passed to list combination represents exactly one list item and
  must contain exactly one logical line.
- Split and list combination regenerate content, atom, and mark IDs because the
  new objects own their copied raw state.
- Each logical line has exactly one text atom and at most one list-item mark in
  this increment.
- Ordered numbering is derived; unordered markers and all separators are
  caller-configurable.
- List markers and separators do not contribute to editable offsets.
- PGlite is the canonical owner of Raw Content state; the runtime keeps no
  authoritative in-memory content map.
- Every successful mutation increments the revision exactly once through CAS.
- At most one writer can commit against a given content revision.
- A failed mutation leaves Raw Content unchanged.
- Display Content is derived and is never stored as canonical state.
