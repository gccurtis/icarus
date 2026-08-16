# Content

The one content primitive. A document body, a slide element, a spreadsheet cell,
a comment, a research message — all of them are a list of content blocks.

**No `schema.ts` and no `api/`, so no deployment door.** Blocks are embedded
values with stable ids, scoped to the resource that holds them; there is no
blocks table and there never will be. What stores them is the resource, and what
edits them is [revisions](../revisions/overview.md), through change sets.

## Variants

| Variant | Built in | Raw | Display |
| --- | --- | --- | --- |
| `text` | pass 2 | atoms, some of them formulas | the resolved string |
| `formula` | pass 2 | `=SUM(A1:A10)` | `42` |
| `image` | pass 3 | an upload or a URL | the normalized, servable asset |
| `table` | pass 3 | rows of cells, each a block list | — |
| `embed` | pass 3 | a URL | the fetched title, description, and thumbnail |
| `prompt` | pass 7 | atoms, and a derived output behind them | the resolved string |

`blockValidator` is discriminated on `type` and its members are found by that
literal, which is what let the last of them append without touching a variant
already here.

## The prompt variant is a text block with an output behind it

It carries the same `atoms`, `display`, and `marks` as a text block and they
behave identically — the text is the user's, editable in place, marked up
normally, and edited by the same ops. What it adds is a
[derived output](../derived-outputs/overview.md) that can refresh that text.

**Editing it changes what is displayed and nothing else.** The edit is not
written back to the output; on the next refresh it goes to the generator as the
shape to preserve. Two copies, deliberately: the output keeps the canonical
generated version and the block keeps the presented one.

**The prompt itself is not stored here**, because two prompts could then disagree
about what produced the text. `scope` is, because it is part of what the author
specified and has to survive being read back into the editor.

Its four states are the output's five without `idle`: a block is written into a
body by asking for content, so it always shows something.

## Capability Invariants

- **Every block, atom, and mark carries an id**, unique within its resource and
  nowhere else. That id is what a change set addresses, what a comment anchors
  to, and what lets two people editing one paragraph merge.
- **`display` is the atoms' text in order** — each literal's `text`, each
  formula's `resolved`, concatenated — and it is stored rather than derived on
  read, because search, previews, and lattice embedding all want the flat string
  and none should have to run a resolver for it.
- **Marks are UTF-16 offsets into `display`, never into `atoms`.** Someone
  bolding `$4.2M` bolded five characters of what they saw. Neither this nor the
  rule above is enforced here — applying ops is what maintains them.
- **A failure is a `state`, not a value.** `FormulaValue` has no error kind, so a
  consumer holding a value never re-checks whether it is really one.
- **No owner accepts every variant.** A spreadsheet cell takes text and formula;
  a comment takes text and image. The owner declares and enforces its own set,
  which is what keeps this union single rather than one per surface. It is also
  what bounds the recursion a table cell opens: no surface that accepts a table
  accepts one nested inside a cell.
- **An image carries `alt`, and it is required.** An image without it is a hole
  in every non-visual consumer — search, the lattice, screen readers, and any
  agent reading the document.
- **A hyperlink in a sentence is a `link` mark; an embed is a block.** Embeds are
  block-level, so the two are never two spellings of one thing.

## Related

[content block](../../../../../docs/data-models/content/content-block.md) — the
model this implements ·
[style set](../../../../../docs/data-models/general-resources/style-set.md) —
what a block's `style` key names
