# Templates — panels

A template is an ordinary body with some of it left open. The open parts are
variables you fill when you use it, and authoring one is authoring a document, a
deck, a slide or a spreadsheet.

The current centre is the **library**. Ten recently used templates sit as raised
cards on a horizontally scrollable shelf; the complete collection is a table
filtered by scope, kind and flat tags. There are no folders. Double-click is a
placeholder alert until editor entry is designed again.

A template is Project, Shared or Personal. That scope is written on its recent
card and table row, and is also a filter beside search.

## Context panel — library

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/templates-library.md) | Start a template or see a compact inventory of the library | New template · Library |

Creation produces a session-local mock row of the chosen kind. That keeps this
surface interactive without claiming a durable write path before one exists.

[Library](../../context/library/templates.md),
[Kinds](../../context/library/template-kinds.md), Recent and Resources are on no
rail. The plane is the library; recent use has its own shelf, while scope, kind
and tags live in the filter row.

## Context panel — editor

Authoring context subviews are not offered for now. Their division between a
Templates rail and the ordinary target editor will be designed with editor
entry, rather than exposed on the library rail in advance.

## Inspector panel — library

| Selecting | What it is | File |
| --- | --- | --- |
| A recent card or template row | Metadata and editable description, actions, variable disclosures and tags | [template.md](../../inspector/library/template.md) |

## Inspector panel — editor

| Selecting | What it is | File |
| --- | --- | --- |
| A variable in the template | One thing it will ask for | [template-variable.md](../../inspector/library/template-variable.md) |
| Content in the template body | The ordinary editor's inspector, reused exactly | [body-entity.md](../../inspector/library/body-entity.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

The editor's lenses are the ones the resource type already has. A template being
edited is a document, a deck, a slide or a spreadsheet being edited, and a second
set of lenses for the same objects would be the same panels written twice.

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| Library | A recent shelf over the searchable, tag-filterable template table | [workspace-library.md](workspace-library.md) |
| Editor | The template's body, on the surface it will become, under a bar that says which one | [workspace-editor.md](workspace-editor.md) |

## The rules this screen keeps

**"Variable", not "slot".** That is what they are: a variable inside an ordinary
body.

**What a template makes is fixed at creation.** Changing it would mean converting
the body, which is not modelled — which is why New template asks first.

**Using a template hands back an independent copy.** The result records where it
came from and nothing else; later edits to the template never reach it.

**Scope is a filter and visible metadata.** Every template has exactly one; the
filter narrows the table without turning scope into a navigation hierarchy.

**Tags organize without containing.** A template may carry several flat labels,
and the bounded checkbox menu can match any of several selected tags. **All**
toggles the complete set. A tag never becomes a folder or a nested library
state.

**The editor auto-saves as a template.** There is no Save control; the revision on
the bar is what says a change took.

## The gap that gates this screen

No body entity carries a variable key. Nothing in a body records which variable it
stands for, so a variable cannot be placed, highlighted, jumped to, or filled.
Listing and adding variables works; everything else does not, and **Use** is
disabled on every template that has one.
