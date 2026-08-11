# 2026-07-28 — Presentation-only changes stop dragging doc edits, and the table actions become icons

Three related changes, prompted by a one-line centring fix that pulled a companion edit behind
it for no reader benefit.

## The companion gate now distinguishes presentation from behaviour

`verify-companions.mjs` compared last-change times only, so *any* source edit failed until its
companion was touched — including a class-string tweak. That does not protect a reader; it
teaches people to edit the file to silence the gate, which is worse than not checking.

When a source now outranks its companion, the tool asks whether anything behavioural changed:
it fetches the source as of the companion's last commit (`git show <commit>:<path>`), blanks the
presentation out of both, and compares. Equal → `OK (presentation-only change since …)`.

**Presentation** means the *value* of a `class` attribute — including prop variants like
`triggerClass`, matched quoted or brace-delimited with real brace-matching so `cn(...)` is
handled — and `<style>` blocks. **Not** exempt, deliberately: Svelte's `class:name={expr}`
directives (the expression is logic; the pattern matches `class=`, not `class:`) and `.css`
files (`app.css` carries the design tokens). No new state file — git is the store.

Verified in both directions on a real component: a class-only edit reports `presentation-only`,
a changed `goto(...)` target still reports `STALE`.

## AGENTS.md says what to write about

Practice 1 gained the exemption, and a new **"Write about behaviour, not decoration"** section
covering companions and code comments alike: document what a reader cannot see by looking —
contracts, non-obvious choices, load-bearing constraints, mistakes already made once — and not
decoration. The test offered before writing either: *would a competent reader be surprised, or
get this wrong, without the note?*

The immediate case: nine lines of comment had been written above a `left-1/2 -translate-x-1/2`
centring change. The code already says it centres. Deleting a comment that no longer earns its
place is now explicitly a normal, welcome edit.

## Import and Export are icons

The table header's four controls are now uniform icon buttons — the words came off Import and
Export, and both carry `aria-label` + `title`, so the label is a tooltip and a screen-reader
name rather than visible text. Four controls fit the header centre without crowding it.

Note this change was correctly *not* exempted by the new rule: removing visible text and adding
accessible names is behaviour, and the gate said `STALE` until the companion was updated. The
exemption is narrow by design.

## Verification

`pnpm check` 0/0 · vitest **359/359** · build clean · companions OK · e2e **20/20** (the e2e
locators use accessible names, so `getByRole('button', { name: 'Import' })` still resolves —
now via `aria-label`).
