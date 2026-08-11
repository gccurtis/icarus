# 2026-07-28 — Table header: order, icons, and one word for one action

## What changed

- **Order** is now search, filter, download, import.
- The header's bulk control is labelled **Download**, matching the per-row menus — one word
  for one action across the table.
- **Import's icon** is `FileInput` (a rightward arrow entering a document) instead of `Upload`.
  `Upload`'s arrow points up and out, which reads as content *leaving* — the opposite of what
  import does, and confusable sitting next to Download's arrow.
- `Menu` gained a `title` passthrough, so a trigger can read one way to a screen reader and
  another on hover.

## The naming collision, and why it mattered

Renaming Export → Download put **two controls with the identical accessible name in one
table**: the header's bulk control and every row's menu. Two e2e tests locate controls by name
and silently grabbed the wrong one — the header (which opens the bulk dialog) where a row menu
was expected. It cost more time than the edit did.

That is not only a test problem. A name that cannot distinguish two controls is ambiguous to
anyone navigating by name, screen-reader user included. Resolved as the user proposed: distinct
**accessible names** (`Download` for the header, `Row download` for each row) with the **same
visible tooltip** on both. The tests now target the row by name instead of by index, which is
also more robust than what they had before.

## Verification

`pnpm check` 0/0 · vitest **359/359** · build clean · companions OK · e2e **20/20**.

One unrelated intermittent seen mid-run: `resources.spec.ts` timed out clicking a history entry
("scrolling into view if needed"). Passes standalone 2/2 and touches nothing in this change —
recorded rather than absorbed, per the rule that no failure gets written off.
