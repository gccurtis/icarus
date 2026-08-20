# A text selection

| Selecting | What it is | Sections |
| --- | --- | --- |
| A range of text inside one block | The selected text, the marks on it, and the named style it belongs to | Selected text · Marks · Text style |

The most common selection in the editor, and the one that used to be a toolbar.

## Layout

| 300px |
| --- |
| selected text |
| marks |
| marks |
| text style |

## Selected text

The text itself, quoted back. Offsets and atom counts were internals and are not
shown — what you selected is the useful confirmation, not where it starts.

**Shows** — "nearly a third of customer-minutes lost"

**Needs** — the selected range resolved to text.

**Open** — a selection spanning several blocks, or crossing an inline formula, has
no answer here yet. Whether that selection is legal at all is an editor question.

## Marks

The inline formatting that can be turned on and off, plus the two things a
selection can become.

**Shows** — Bold · Italic · Underline · Strike · Code, then **Add link** and **Comment**

**Needs** — the mark set the body model supports, and comment creation anchored to
a range.

## Text style

Which named style the selection sits in, and how much of it this affects.

**Shows** — `Named style · Body`, `Applies to · 38 characters`

Changing family, size or spacing from here edits the named style rather than
pretending it is a local override, and the section says so.

**Needs** — the block's style reference, and a route to the
[named style lens](named-style.md).

**Open** — editing a style from a selection changes text elsewhere in the
document. The panel needs to say how much before it does it, not after.
