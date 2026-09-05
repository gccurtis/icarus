# Document editor — panels

A paginated writing surface with no toolbars. Every property of the thing you
selected is in the inspector, and everything about the document as a whole is in
the context panel.

One subscreen.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/document.md) | The document itself — identity, who is in it, whether it is saved | This document · Editing now · Saved · From template · Attribution |
| [Navigator](../../context/resource/navigator.md) | Getting somewhere in a long document | Outline · Pages · Breaks and furniture |
| [Find](../../context/resource/find-document.md) | Search and replace, as a panel rather than a dialog | Results |
| [Insert](../../context/resource/insert-document.md) | Putting something new in | Basics · Content · Data and AI · Structure |
| [Styles](../../context/resource/styles-document.md) | The named styles this document uses | Named styles |
| [Layout](../../context/resource/layout.md) | Paper, dimensions, gutters, furniture, numbering | Paper · Dimensions · Gutters · Header and footer · Page numbering |
| [Variables](../../context/project/variables.md) | The project's named values | Actions · Search · Filters · Variables |
| [Comments](../../context/resource/comments-document.md) | Conversation on the document | Scope chips · Open · Resolved |
| [Context](../../context/resource/context-document.md) | What prompt blocks in this document can look up | Available to prompt blocks · Resolved preview |

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A range of text | The selection, its marks, and the style it belongs to | [text-selection.md](../../inspector/resource/text-selection.md) |
| A block | One paragraph, heading or list, and its block-level format | [text-block-document.md](../../inspector/resource/text-block-document.md) |
| An inline formula | What it shows, what it reads, how it is formatted | [formula.md](../../inspector/resource/formula.md) |
| A table | Size, structure, and the actions that change either | [table.md](../../inspector/resource/table.md) |
| A prompt block | The prompt, what it produced, and what it could look at | [prompt-block.md](../../inspector/resource/prompt-block.md) |
| The header | The canonical header, and its spacing | [header.md](../../inspector/resource/header.md) |
| The footer | The canonical footer, and page numbering | [footer.md](../../inspector/resource/footer.md) |
| A link | Where it goes | [link.md](../../inspector/resource/link.md) |
| A named style | Typography and spacing, edited once for everywhere it is used | [named-style-document.md](../../inspector/resource/named-style-document.md) |
| A comment | One thread, its anchor and its replies | [comment.md](../../inspector/collaboration/comment.md) |
| Nothing | The document itself | [document.md](../../inspector/resource/document.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |
| A project variable | The one in Analysis, wherever a variable needs a lens | [variable.md](../../inspector/analysis/variable.md) |

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
