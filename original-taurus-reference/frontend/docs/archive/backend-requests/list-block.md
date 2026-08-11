# Backend request — a `list` block kind + a general text indent level

**Priority:** Medium · **Status:** ✅ **Shipped** — Omega has `BlockKindList` and a general indent level; Alpha ships native lists + indent

Two related capabilities the A2 inspector needs and Omega can't back today. They're
filed together because both surface in the same "Extra formatting" work
(design: [`../superpowers/specs/2026-07-25-a2-block-kinds-design.md`](../superpowers/specs/2026-07-25-a2-block-kinds-design.md);
gap **G5** in [`alpha-remaining-gaps-2026-07-25.md`](alpha-remaining-gaps-2026-07-25.md)).

## 1 — A native `list` block kind

A single **`list` block kind** — one list *element* that holds its items
**internally** — so the cockpit can model a list the way users think of it: you
insert *a list*, press **Enter** to add an item within the same element, and the
marker style is a setting on the list (not a property scattered across N blocks).

Omega today has only flat **`list_item`** (one block per line) and **no op to
mutate a block's typed data after insert** (`set_block` changes kind only; there is
no `set_block_data`). That shape can't express "one list element with internal,
editable items," so A2 **defers lists entirely** to this request rather than ship a
flat approximation or fake the settings.

```jsonc
// Block
{ "kind": "list", "data": ListData }

// ListData
{
  "type":  "bullet" | "ordered" | "check",  // marker style for the whole list
  "start": 1,                                 // ordered lists only (default 1)
  "items": [
    { "level": 0, "checked": false, "atoms": [ … ], "marks": [ … ] }
  ]
}
```

…plus edit ops to set the list `type` and to insert / remove / re-level / check an
item (e.g. `set_list_type`, `set_list_item`), or a single `set_block_data` that
replaces the list's data wholesale. **Omega owns the final contract** — a lighter
alternative is to keep flat `list_item` and add just `set_block_data`/`set_list_data`
so the cockpit can group consecutive items and edit type/level/checked; the
single-`list`-kind form above matches the cockpit's element model best.

## 2 — A general text indent level (not a list thing)

Every **text block** — paragraph, heading, quote-wrap, etc. — should carry an
**indent level**, the same way it carries alignment and line height. It is a
first-class text-type property, **independent of lists** (a list item's nesting
`level` is a separate concept). The inspector's **Extra formatting → Indent level**
control applies to any text block; today there is nowhere to persist it.

Proposed: an `indent` field on `BlockStyle` (a small non-negative integer step,
bounded like line height), set via a `set_block_indent` op — mirroring the existing
`set_block_alignment` / `set_block_line_height` shape:

```jsonc
{ "op": "set_block_indent", "blockId": "…", "indent": 2 }   // 0 = flush left
```

## What it unblocks (front-end)

- **List element** — Insert element → List, autoformat (`-` / `1.` / `[]` then a
  space), Enter-adds-item, Backspace-exits, marker rendering, and the inspector's
  list settings.
- **Indent level** in Extra formatting for **all** text blocks.

Until they land, lists and the indent control are **hidden** (not mocked); this pass
ships the other elements (code / callout / divider), the Text-type control, and
Line spacing in the new Extra-formatting section.

## Front-end follow-up (once shipped)

Add the `list` node + bridge + insert/keymap/autoformat + marker rendering + list
settings (building against the native kind — a clean 1:1 map), and a
`setBlockIndent` runtime action wired to the Extra-formatting Indent control.
