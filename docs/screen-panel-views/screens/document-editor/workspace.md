# Document editor — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only state this screen has | The editor: ProseMirror, paginated, with everything Icarus adds on top of it | Editor |

## Layout

| 1fr |
| --- |
| editor |

The whole workspace is one region. A rich-text editor is not a composition of
panels, and drawing it as one would describe the framework's job rather than
ours.

## Editor

### The framework

**ProseMirror.** A document is a `DocumentBody` rendered into a ProseMirror view,
with the schema derived from the body model rather than the other way round.

The view, the canonical furniture editors, undo history, IME state and pending
operations all live in the tab runtime, so switching to another tab and back does
not discard buffered edits, an in-flight composition, or an undo stack.

### What we do not take from it

**The default toolbar and menu bar.** There are none. Every property of the thing
you selected is in [the inspector](../../inspector/resource/), and every insert is in
[the Insert view](../../context/resource/insert-document.md). This is the decision that makes the
inspector load-bearing: it has to be keyboard-reachable and must never be the
only path to an essential command.

**Selection-local formatting.** ProseMirror is happy to carry family, size and
spacing as marks on a range. Icarus does not: those live on a named `TextStyle`,
and changing one from a selection edits the style. Only the inline marks that are
genuinely local — bold, italic, underline, strike, code, link — behave the way
the framework expects.

**Its idea of a document as one continuous flow.** See pagination below.

### What we add on top

**Pagination.** ProseMirror has no concept of a page. Icarus computes one: pages
of a chosen paper and orientation, all four gutters drawn as a dashed guide, and
a page break where the author put one. A computed page has no ID — "page 3" is a
label for where a block currently falls, and changes with paper and margins.

**Page furniture.** Header and footer bands, each with one canonical editor. Their
appearance on every page is a read-only projection of that single state, so you
are never editing "the header on page 4".

**Inline formulas.** An atom in running text that reads its value when it runs.
Set as ordinary prose, not as a widget.

**Prompt blocks.** Generated content that runs when the document is opened. Also
set as ordinary prose — a document is stable, and nothing pops out of it. What
marks a block as generated belongs in the gutter and in the inspector.

**Collaboration.** Only user-origin transactions become outbound operations.
Accepted-local, remote and display-refresh origins must not echo back as new
edits, or two clients will amplify each other's changes.

**Zoom.** A trackpad pinch reaches the page as a wheel event carrying `ctrlKey`,
which the workspace takes before the browser acts on it, scaling the pasteboard
and leaving the shell alone.

### What we configure

| | |
| --- | --- |
| Paper and orientation | Letter or A4, portrait or landscape |
| Gutters | Top, bottom, inside, outside |
| Header and footer | Band heights, and whether the first page differs |
| Page numbering | Start, position, and visibility on the first page |
| Named styles | Family, size, line height, weight, spacing, per style |

All of it is in [the Layout view](../../context/resource/layout.md) and
[the Styles view](../../context/resource/styles-document.md).

### What is unresolved

**Open** — pages are computed, so anything that wants to address one has nothing
to hold. Comments, find results and the outline all currently carry a page as a
label.

**Open** — the browser's own zoom (⌘+ / ⌘−) happens above the document and
enlarges the shell with it. No page can scope that, and this one does not pretend
to.
