# Templates — the library

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The centre this tab opens on | Recently used templates for recognition, followed by every available template for scanning | Header · Recently used · All templates |

The library has two complementary views of the same templates. A single
horizontal shelf makes recent choices quick to recognize; the complete library
is a table because names and metadata are what make a large collection easy to
scan. There are no folders and no library navigation state.

## Data

The shared `templates/procedures/library.svelte.ts` read model currently returns sample
`LibraryTemplate` rows. The stored
`TemplateFields` representation carries a flat `tags: string[]`, but it does not
yet carry enough ownership information to derive Project, Shared and Personal
truthfully. The sample seam should be replaced when the library capability
exposes scope and usage.

Tags are labels, not a hierarchy. A template may have any number of them, an
empty list means untagged, and no tag encodes a parent, child or path.

The sample contains ten used templates, so the recent shelf renders all ten.
More generally it is the ten most recently used templates, or every used
template when fewer than ten exist. It is derived from usage and ordered newest
first; it is not filtered along with the table.

## Layout

| 1fr |
| --- |
| header |
| recently used shelf |
| all templates heading |
| filters and template table |

## Header

`ScreenHeader` shows **Templates** at the left and one compact explanation at the
right: reusable starting points for documents, slide decks and spreadsheets.
There is no subtitle beneath the title or second Templates subheader above the
table.

## Recently used

`ScreenGroup` labels the band **Recently used**. `ScreenShelf` supplies a
recessed well with a native horizontal scrollport and discreet bottom scrollbar;
there are no overlaid arrow buttons or broad edge fades. The scrollport and its
scrollbar are inset inside the rounded well. A narrow four-edge occlusion shadow,
matching the editor gutters, shows cards passing underneath the shelf boundary.
Each `ScreenShelfItem` contains a `ScreenCard` with a raised shadow so its
abstract target-shaped preview reads as an object resting on that gutter.

A card shows the target, scope, last use and variable count. A single click
selects the template and opens its inspector. A double click raises the
not-yet-wired alert. Selection uses the active surface and border; hover uses the
ordinary panel-hover surface, so the two states remain visibly distinct.

## Filters

`ScreenFilters` contains:

- Search by template or tag.
- Scope: All scopes, Project, Shared or Personal.
- Kind: All kinds, Document, Slide deck or Spreadsheet.
- Tags: a checkbox menu containing All, then the sorted union of tags on every
  template. The panel has a fixed maximum height and scrolls internally.
- Sort: Updated, Name, Makes or Variables.
- An icon-only direction button sharing the sort control's frame.

Tag selection is multi-select and matches a template carrying any checked tag.
**All** toggles the full set on or off without closing the menu. Search is
broader and matches a substring of the template name, description or any tag.
Clearing a no-match state resets search, scope, kind and every tag together.

## Templates

`ScreenTable` has Name, Makes, Scope, Variables, Tags and Updated columns. The
name cell carries the target-kind icon. Tags are rendered as a comma-separated
flat list; an untagged template renders an em dash.

A single click anywhere in a non-control cell selects the row and opens the
template inspector. The name button provides the same action to keyboard
users. A double click on either the row or its name raises the not-yet-wired
alert; it does not enter the template editor.

## Empty state

An empty filtered result names the mismatch and offers to clear every filter. A
genuinely empty library says that templates will appear after one is created.

## Context and inspector

The Templates context rail offers only `templates.overview-library` for now. It
has three session-local creation choices, then one compact inventory containing
the total plus Project/Shared/Personal and Document/Slide deck/Spreadsheet
breakdowns. It repeats neither recent use nor the current selection, since those
already belong to the shelf and inspector. Nothing in this panel collapses.

`templates.template` has compact scope/kind/update/creator metadata, an inline
description editor entered by double click, session-local Duplicate and Delete
actions, variable disclosures with descriptions, and tag chips followed by an
add field. It deliberately has no preview, revision or template-id field.
