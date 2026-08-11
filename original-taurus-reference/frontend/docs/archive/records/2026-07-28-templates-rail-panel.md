# 2026-07-28 — Library pass 2/3: the Templates rail panel (+ a real bug: no Toaster)

Second commit of the Context & Templates plan: the mocked **Templates** panel in the document
and slides context rails — and, found by its e2e, a real pre-existing bug fixed.

## The panel (`features/shared/templates/`)

Shared implementation, per-stage 5-line wrappers (rail sections mount with **no props**, so
each stage pins its scope): document rail gets it after Layout, the slides rail beside the
slide list. Two sections, both badged Mock, both toasting honest "…mocked for now" copy:

- **Add a template** → the Add-template modal: search over a fixed six-entry mock catalog
  (`mock-templates.ts`, search rules unit-tested, +3 → suite 346); choosing one toasts what
  *would* drop in and closes.
- **Make a template** — name (gates the button) + description; the slides scope adds
  **This slide / Whole deck** (`RadioGroup`), per the user: a deck and a single slide are both
  saveable as templates.

**Deferred, recorded in the panel's companion:** *Convert text → prompt* — left out because a
template author wouldn't know when to convert; the future shape is AI classifying prompt-vs-text
content, which also unlocks auto-generated context variables. Also recorded: the alternative
"drop template" button in the editor's own top bar, a candidate once templates are real.

## The bug: `toast()` rendered to nothing

The new e2e asserted a toast — the first test ever to — and it never appeared. Investigation:
**`Toaster` (the single subscriber of the toast store) was mounted only on the `/components`
showcase page.** Every toast the real app has ever fired — import/export confirmations, sharing
errors, rename failures — silently went nowhere. Fixed by mounting `<Toaster />` once in the
root layout (it is a fixed bottom-right overlay, built for exactly that). A test that asserts
what the user *sees* pays for itself again.

## Verification

`pnpm check` 0/0 · vitest **346/346** (+3) · build clean · companions OK (five new, three
updated) · e2e **16/16** (new test: panel sections + Mock badges, modal search narrowing,
add/make toasts, make gated on a name) · screenshots read back visually.
