# A template

| Selecting | What it is | Sections |
| --- | --- | --- |
| A recent card or table row | The template's identity and organization | Identity · Variables · Tags |

## Identity

The title is followed by one compact metadata line: scope, kind and relative
update time separated by centred dots. Creator follows on its own line. Revision,
template id, abstract preview and a redundant variable-count field are absent.

The description has no About heading. Double-clicking it replaces the text with
a `Textarea`; blur or Command/Ctrl+Enter applies the session-local change and
Escape cancels it. Duplicate and Delete sit directly below the description.
Duplicate makes and selects an independent session-local row. Delete confirms,
removes the row from the session-local library and closes the inspector.

## Variables

Variables precede tags. The section title carries the count, so there is no
second count field. Each variable is a compact disclosure: its closed state
shows the human label, and its open state adds the description, stored key, type
and Required/Optional state. Field keys and values use the same caption size;
weight, colour and monospace for the stored key provide hierarchy without a
mismatched scale. A template with no variables receives a compact explicit
empty state.

## Tags

Every flat tag is a `PanelChip`. A short input expands to the remaining panel
width and an adjacent plus button adds a unique tag to the session-local
template. The shared reactive mock updates the table and the tag filter's union
immediately.

Dividers separate identity, Variables and Tags. An unknown selection id produces
an explicit empty state.
