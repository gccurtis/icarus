# Slide decks

A deck's name, the shape it is drawn at, and who touched it last. Not its
slides — those are a body, and bodies live in
[revisions](../revisions/overview.md).

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | one project's decks |
| `create` | mutation | starts one, returning its id |
| `rename` | mutation | gives one a different name |
| `remove` | mutation | deletes one |

Registered in
[`src/convex/capabilities/slideDecks.ts`](../../../convex/capabilities/slideDecks.ts) —
camelCase, because Convex rejects a hyphen in a module path.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `slideDecks` | one row per deck: title, aspect ratio, template origin, attribution, and when it last changed |

## The deck is what proves the machinery is generic

Decks were built after documents and against the same
[change-set](../../../../../docs/data-models/revisions/change-set.md) machinery,
and the point of building them was to find out whether that machinery had to
learn anything about slides. It did not: applying an op, inverting one, and the
conflict ladder all work on paths and values, and a deck body is a tree like any
other. See
[`revisions/test/unit/resource-types.test.ts`](../revisions/test/unit/resource-types.test.ts).

## `aspectRatio` is on the row and the theme is not

Both are appearance, and they are stored in opposite places on purpose.

**`aspectRatio` is on the row** because a thumbnail needs it before anything
opens the body, and because no edit changes it: frames are fractions of the
slide, so they only mean the same thing across slides if the slides are the same
shape. Changing it would reinterpret every frame in the deck at once, which is a
conversion rather than an edit.

**The theme, the layouts, and the style set are in the body**, so recolouring a
deck and restyling its text are ordinary change sets — and therefore undoable.
On the row they would be a patch, and a patch is not a revision.

## Capability Invariants

- **A refusal is "not found", never "forbidden".** A deck in another project
  answers exactly as one that never existed.
- **Attribution is built from the scope**, never accepted as an argument.
- **Every mutation records its activity in the same transaction**, and `remove`
  reads the title first so the entry can still say what was deleted.
- **A title is trimmed and never empty.** What to call an unnamed deck is the
  client's decision.
- **The row and the body are created and destroyed together.** A row with no
  anchor is a deck nothing can open; a body with no row is a deck that is gone
  and still editable by anyone holding its id.
- **No slide id is minted here.** A new deck has no slides: an id invented by the
  server is an identity the deck's id space would have to honour, decided by the
  one party that is not editing.

## Related

[slides](../../../../../docs/data-models/general-resources/slides.md) — the model
this implements ·
[general resources in Convex](../../../../../docs/storage/general-resources.md) —
why the row holds no body
