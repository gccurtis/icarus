# Rich Content Types

`types/` holds the canonical model and the runtime contract. It has no Kysely
row shapes — those are in
[`persistence/stored-types.ts`](../persistence/stored-types.ts) — and no HTTP
shapes, because Rich Content registers no endpoint.

Both the public contract and the private model live here. `index.ts` decides
which of them leave.

## Files

| File | Holds |
| ---- | ----- |
| `ids.ts` | The five identifier aliases Rich Content allocates: `RichContentId`, `AtomId`, `ListId`, `DisplayLineId`, `DisplaySegmentId` |
| `formatting.ts` | The formatting vocabulary shared by marks, the projection, and the inputs: `StyleProperties`, `ResolvedStyle`, `LinkTarget`, `ListPresentation` |
| `raw-content.ts` | The private canonical model: atoms, marks, positions, ranges, lines, and `RawContent` itself |
| `display-content.ts` | The public read-only projection and the handles a caller selects with |
| `runtime-inputs.ts` | What the runtime's methods accept |
| `runtime-results.ts` | What they return |

`formatting.ts` exists so `raw-content.ts` and `display-content.ts` can both
depend on the same style, link, and list vocabulary without either depending on
the other. Raw Content is canonical and Display Content is derived from it; an
import in that direction would be misleading.

## Public Types

Everything re-exported through `index.ts`. Two shapes carry the contract:

**`DisplayContent`** is what a consumer reads. Lines correspond one-to-one with
logical lines; each line carries an optional `list` (the marker and separator to
render, never editable text) and a list of text segments. A segment is one run
of text with a single resolved style and a single set of active links — atoms
are split at every mark boundary to make that true.

**The versioned inputs** all carry `contentId` and `expectedVersion`. Style,
link, and list mutations additionally carry a `DisplayRange` built from
`DisplayPosition`s, whose `segmentId` values embed the content version. A
segment handle from revision 3 cannot be used against revision 4: it will not be
found, and the mutation fails `invalid-display-range` rather than acting on the
wrong text.

`replaceText` is the exception. It names an `AtomId` and an `AtomTextRange`
rather than a display range, because a text edit targets canonical content
directly. The atom keeps its ID across the edit, which is why the handle stays
usable.

## Private Types

Everything in `raw-content.ts`: `RawContent`, `RawAtom` (`TextAtom` |
`LineBreakAtom`), `RawMark` (`StyleMark` | `LinkMark` | `ListItemMark`),
`RawPosition`, `RawRange`, and `RawLine`.

These stay private for two reasons. A consumer holding a `RawMark` would depend
on a representation the capability reserves the right to change — the retired
`"hard-break"` atom discriminator is proof it does change. And a consumer able
to build a `RawPosition` could address content the runtime never validated,
bypassing the display-range translation that every mutation relies on.

`RawLine` is derived rather than stored: a line break is an atom, and a line is
everything between two of them. `ResolvedStyle` is also unexported today,
although a consumer reaches it through `TextDisplaySegment.style`.
