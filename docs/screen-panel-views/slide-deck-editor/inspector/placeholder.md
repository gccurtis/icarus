# A placeholder

| Selecting | What it is | Sections |
| --- | --- | --- |
| A placeholder in the layout subscreen | A frame that a slide fills in | Placeholder · Status |

The layout supplies a frame and a style key. The slide supplies the content, in
its own copy, which it then owns.

## Layout

| 300px |
| --- |
| placeholder |
| status |

## Placeholder

**Shows** — `Role · body`, `Frame · 0.07 / 0.33 / 0.44 / 0.44`, `Style key · body`

**Needs** — the placeholder's role, frame and style key.

## Status

Read-only.

**Open** — placeholders have no stable key, so this is a layout summary rather
than an independently selectable object. Two placeholders with the same role
cannot be told apart, which blocks placeholder selection, duplicate-role reset,
and any per-placeholder property at all. This is the gate on the whole lens.
