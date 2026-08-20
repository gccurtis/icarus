# Document editor — panels

A paginated writing surface with no toolbars. Every property of the thing you
selected is in the inspector, and everything about the document as a whole is in
the context panel.

One subscreen.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](context/overview.md) | The document itself — identity, who is in it, whether it is saved | This document · Editing now · Saved · From template · Attribution |
| [Navigator](context/navigator.md) | Getting somewhere in a long document | Outline · Pages · Breaks and furniture |
| [Find](context/find.md) | Search and replace, as a panel rather than a dialog | Results |
| [Insert](context/insert.md) | Putting something new in | Basics · Content · Data and AI · Structure |
| [Styles](context/styles.md) | The named styles this document uses | Named styles |
| [Page](context/page.md) | Paper, gutters, furniture, numbering | Paper · Gutters · Header and footer · Page numbering |
| [Variables](../_shared/context/variables.md) | The project's named values | *shared* |
| [Comments](context/comments.md) | Conversation on the document | Scope chips · Open · Resolved |
| [Context](context/context.md) | What prompt blocks in this document can look up | Available to prompt blocks · Resolved preview |

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A range of text | The selection, its marks, and the style it belongs to | [text-selection.md](inspector/text-selection.md) |
| A block | One paragraph, heading or list, and its block-level format | [text-block.md](inspector/text-block.md) |
| An inline formula | What it shows, what it reads, how it is formatted | [formula.md](inspector/formula.md) |
| A table | Size, structure, and the actions that change either | [table.md](inspector/table.md) |
| A prompt block | The prompt, what it produced, and what it could look at | [prompt-block.md](inspector/prompt-block.md) |
| The header | The canonical header, and its spacing | [header.md](inspector/header.md) |
| The footer | The canonical footer, and page numbering | [footer.md](inspector/footer.md) |
| A link | Where it goes | [link.md](inspector/link.md) |
| A named style | Typography and spacing, edited once for everywhere it is used | [named-style.md](inspector/named-style.md) |
| A comment | One thread and its replies | [comment.md](inspector/comment.md) |
| Nothing | The document itself | [document.md](inspector/document.md) |
| An avatar, a "who" link, a variable | *shared* | [`_shared/inspector`](../_shared/inspector/) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| The only one | The editor — ProseMirror, and what Icarus adds to it | [workspace.md](workspace.md) |

## The rules this screen keeps

**Nothing is stale.** A formula reads its value when it runs and a prompt block
runs when the document is opened. There is no cached derived state, so no badge,
no count, and no refresh prompt.

**Named styles, not local overrides.** Family, size, indentation and line spacing
live on a `TextStyle`. Changing one from a selection edits the style rather than
pretending the change is local.

**Removing the toolbar makes the inspector load-bearing.** Every formatting
action has to be reachable by keyboard, and the inspector must never be the only
path to an essential command.
