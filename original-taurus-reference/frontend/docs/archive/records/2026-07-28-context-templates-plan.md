# 2026-07-28 — Plan filed: Context & Templates mock-first surface pass

Docs-only commit: filed `docs/plans/2026-07-28-context-templates-mock-pass.md`, the reviewed
plan for the next effort — the first surfaces of the **template library** and (eventually)
**context library**, fully mocked.

The user's direction, captured in the plan's decision list: Context and Templates are
user/org-scoped *asset spaces*, so they live in the **top bar** (not the tab strip — four
permanent tabs was explicitly rejected) and must also be reachable from **project selection**;
each leads to its own honest not-implemented placeholder space. The document (and slides)
context rail gains a mocked **Templates panel** — Add template (search modal over a mock
catalog) and Make a template (name/description; slides adds This slide / Whole deck) — and the
**sign-in screen gets a theme toggle** whose label names the current mode. Convert
text → prompt is deferred to a companion note (future: AI classifies text vs prompt,
auto-generates context variables).

Status in the plan header: **PROPOSED — awaiting user review**. No code changed in this
commit; implementation is three gated commits once approved.
