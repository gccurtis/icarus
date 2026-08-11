# Document block & style model (internal architecture + decisions)

How Alpha models a document block, how that maps to Omega, and how the **user-facing**
editor controls sit on top. The runtime that carries all of this is described in
[document-editor.md](document-editor.md); the source of truth is
`src/lib/systems/documents/types.ts` (the shapes), `block-kinds.ts` (the per-kind
metadata table) and `styles.ts` (the semantic-token resolution). `types.ts` and
`styles.ts` carry signpost comments pointing at each other, because the two typography
systems described below are easy to mistake for one superseding the other.

## The axes (data model)

A block carries a small set of **orthogonal** properties, and keeping them separate is
the core of the model — Alpha historically conflated them. All of them are real in Omega
(`taurus-omega/core/capability/document`).

| Axis | Concept | Omega field / op | User sees it as |
| --- | --- | --- | --- |
| **1. Kind** | what the block *is* | `block.kind` — seven values; `set_block`, `insert_block` | "**element**" (text / code / callout / list / divider / image / prompt) |
| **2. Text sub-kind** | a text block's semantic role | `block.subKind` (`body`, `heading_1..6`, or a custom style id); `set_block_subkind` | "**Text type**" — Body, Heading 1–6 |
| **3. Semantic style** | a named, reusable token style | `block.styleRef` (styleId + semantic overrides) + doc `styleRegistry`; `assign_block_style`, `set_style_default`, `put_style_definition` | the *definition behind* a block type — **not surfaced directly** |
| **4. Custom typography** | free-form real fonts, per block | `block.styleRef.overrides.custom` (`CustomTypography`) and the document's `base.defaultTypography`; `set_block_custom_typography`, `set_default_typography` | "**font / size / colour**" on a whole line, and "Document defaults" |
| **5. Inline typography** | the same real fonts, per **run** | the `font` / `fg` / `bg` marks, anchored at byte offsets like every other mark; `add_mark` / `remove_mark` | "**font / size / colour**" on the selected text or the next character typed |

### Kind: seven, with headings moved into the sub-kind

`BlockKind` is `text | code | callout | list | divider | image | prompt`. Omega folded
its old heading kinds into a `text` block carrying a `subKind`, and Alpha follows: a
heading is a `text` block whose sub-kind is `heading_1..6`, not a kind of its own.
`block-kinds.ts` is the single metadata table for the set — label, icon, which menu the
kind belongs to, whether it bears atoms, whether it is a content-free leaf, whether it
carries typed `Data`. `text` is the base prose kind; of the six element kinds, five
appear in the Insert-element menu, because `image` round-trips (its typed data is
preserved untouched by the differ) but is not yet insertable, pending the files/upload
pass.

The ProseMirror projection follows from that table rather than from a parallel list:
`heading` nodes for heading sub-kinds, `paragraph` for body text and for `callout` and
`prompt` (whose real kind rides in the node's `kind` attr), `code_block` for code,
`divider` and `list`/`list_item` for their own shapes, and a read-only `block_leaf`
placeholder for image.

## Decision 1 — The semantic style registry is **internal**

The style registry (axis 3 — `StyleDefinition`s plus per-kind defaults) is an
**internal mechanism**, **not** a user-facing control. The user never picks a semantic
token; they pick a **text type**, and the registry is part of what *defines* how a block
of that type looks. **Keep** the registry; **do not** surface it raw (that was the
mistake in the inspector's short-lived "Typography" select).

This is now literally true in the code: `effectiveTypography` resolves a block's token
(explicit override → assigned style → the registry default for the kind →
`defaultTypographyForKind`'s convention) and the presentation pass paints
`typographyCss` for it, but no control in the inspector writes one. The
`setBlockTypography` / `setBlockKindTypography` actions remain in the frozen
`EditorActions` contract, and the registry still resolves whatever other clients put
there — the resolution path is live, the picker is not.

Rationale unchanged: the product wants a familiar word-processor model (pick "Heading
1", get a heading), not Omega's semantic-token vocabulary exposed as-is.

## Decision 2 — "Text type" is the sub-kind; "element" is the kind

The user has **no notion of "blocks."** Two distinct controls:

- **Insert element** — offered on an empty **"new line"** (never called "block"), at the
  **top** of the lens. A line is text by default (you just type); choosing code,
  callout, list, divider or prompt converts it to that **element** — axis 1, via
  `insertElement`, which replaces an empty line and otherwise inserts after it.
- **Text type** — shown when the line is text: on a new line, and at the **bottom** of
  the inspector when text is selected. It lists **Body / Heading 1–6** — axis 2. The
  action (`setTextType`) is **whole-line and multi-block**: it converts every text block
  the selection touches, leaving non-text kinds alone, and the differ emits one
  `set_block_subkind` per converted block.

Because the sub-kind rides on the block, a text-type change needs no block splitting in
the common case; a selection that covers part of a line converts that whole line, which
is the word-processor behaviour users expect.

## Decision 3 — Real fonts are custom typography **and** inline marks

Font family, size and colour are the **real-font** escape hatch — values Omega stores
verbatim — and they exist at **two** levels, both live:

- **Per block** (`set_block_custom_typography`, and `set_default_typography` for the
  document-wide base). This is the "whole line" level, and the Layout panel's "Document
  defaults" section is the same mechanism at document scope.
- **Per run** — the `font`, `fg` and `bg` marks in the editor schema, applied by
  `actions.setInlineStyle` over the selection or held as stored marks for the next typed
  character. Omega's mark vocabulary carries them alongside bold/italic/underline/strike/
  code/link, so a mid-line font or highlight is a first-class, persisted mark, not a
  client-side illusion.

Both render through the same validated CSS path (`customTypographyCss` for the block
level, the mark `toDOM`s for the inline level), and every value is checked by
`systems/documents/sanitize.ts` on the way into a `style` attribute — Omega validates
colours but only length-bounds font names, so this boundary is the last line of defence,
not a second one.

## The five-level cascade

Because the two typography systems coexist, a rendered character's appearance is
resolved by layering, broadest scope first and narrowest last:

1. **Built-in** — the base CSS in `DocumentStage.svelte` for the node the block became:
   paragraph rhythm, the code and callout treatments, the list markers.
2. **Document default** — `base.defaultTypography`, rendered by `customTypographyCss`
   as an inline style on the editor host, so the whole document inherits it.
3. **Sub-kind and semantic token** — a heading's size comes from its own `h1`–`h6` rule
   (which is why `defaultTypographyForKind` returns `body` for every text block,
   whatever its sub-kind, and why a heading keeps its size over an inherited document
   default), and on top of that the block's effective `SemanticTypography` is painted as
   a decoration whenever it differs from the kind's conventional token.
4. **Block custom typography** — `CustomTypography` on the block, layered into that same
   decoration so its font/size/colour override the token's.
5. **Inline marks** — `font` / `fg` / `bg` on the run, rendered as spans inside the
   block, so the narrowest scope wins outright.

Levels 3 and 4 are computed in the one presentation pass in `model/presentation.ts`,
which resolves each block through the optimistic overlay before falling back to the
server snapshot — so an unconfirmed font change paints immediately without ever being
written into the snapshot.

## Where Alpha diverges from Omega (integration notes)

- **Kinds are at parity.** Alpha models all seven of Omega's block kinds; the only gap
  is that `image` round-trips rather than being insertable, and its rendering is a
  placeholder until the files pass.
- **Custom sub-kinds are typed for but not offered.** `subKind` is a `string` on the
  wire precisely so a custom style definition's id can appear there; the inspector
  offers only the seven built-ins (`TextSubKind`).
- **"Body" is a style token in Omega and a text type in Alpha's UX**, reconciled by
  Decision 2: the text type writes the sub-kind, and the registry independently supplies
  the token that defines how a `text` block renders.
- **Line spacing is modelled per row, persisted per block.** `systems/documents/layout.ts`
  keeps the row-height math (standard row height plus an increase, in whole points) that
  drives the row min-height decoration, while the op that persists it is
  `set_block_line_height`. Page geometry is read-only server truth — there is no
  pagination, so nothing in Alpha fits content to pages.
