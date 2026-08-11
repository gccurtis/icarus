# helpers.ts

Pure display helpers shared by the Quarterback panel's sub-components — the `lens-helpers` of
the A3 decomposition. Nothing here reads a store; components pass in what they hold.

- **`modeTones` / `modeName`** — a chat's fixed mode as badge tone + label (used by the chat
  list rows and the conversation header). The tone map says what the colors mean: `ask` is
  neutral, `action` is focus-blue, `plan` is attention-amber.
- **`taskLabels` / `taskTones`** — the seven `AiTaskState`s as human labels and badge tones for
  the spawned-task card (`waiting` reads "Needs review"; `partially_completed` reads "Partial").
- **`todoMarks`** — the working-list glyphs (`○ ◐ ● ▲ ×` for open/doing/done/blocked/canceled),
  rendered `aria-hidden` beside the todo text.
- **`relTime(iso)`** — a chat's `updatedAt` as the same relative wording the document bar uses
  (`documentEditRelative`), empty string for an unparseable date rather than "NaN years ago".
