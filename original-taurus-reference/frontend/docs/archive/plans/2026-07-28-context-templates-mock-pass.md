# Context & Templates — mock-first surface pass (2026-07-28)

**Status: ✅ SHIPPED 2026-07-28** — approved by the user (routes confirmed as the open point),
then landed as the three planned commits: `5c5483b` (routes + top-bar nav + projects theme
fix), `bca3ad4` (Templates rail panel + the missing-Toaster fix it uncovered), and the sign-in
theme toggle (records `2026-07-28-library-routes-and-top-bar.md`,
`…-templates-rail-panel.md`, `…-signin-theme-toggle.md`).

The user wants to start building toward a **template library** and, eventually, a **context
library**. Both are *asset spaces*: largely user- and organization-scoped, independent of any
one project (a context or template should be usable across projects). This pass adds the
surfaces **fully mocked** — buttons, one new rail panel, one modal, two placeholder spaces —
so the shape is visible and reviewable before any backend model exists. Per the standing
principle: everything mocked is **badged Mock**; nothing fake presents as real.

## Decisions already made (user, 2026-07-28)

- **Not permanent tabs.** Four permanent tabs is too much; the tab strip stays
  Overview + Agents. Context and Templates live in the **top bar**, above the tabs.
- They are **navigational**: clicking one takes you to its own space, which today is an honest
  "not implemented yet" placeholder.
- **Project selection needs them too** (they are user/org-scoped) — but *not* the whole
  workspace top bar: search/import/export/share make no sense there. The projects screen keeps
  its own slim bar and gains the two entries.
- The document editor's **context rail gains a Templates panel** (kept in the rail for now; a
  "drop template" button in the editor's own top bar is a possible future move, recorded in the
  companion, not built).
- The **sign-in screen gets a theme toggle** at the very bottom — a quiet text control whose
  label names the mode you are currently seeing; clicking it switches.
- **Convert text → prompt is deferred** — future feature where AI classifies text vs prompt
  content and auto-generates context variables. Companion-doc note only; no UI.

## 1. Two new spaces: `/library/context` and `/library/templates`

New routes, each a full-screen placeholder in the style of the Agents tab: a label
("Asset library"), the space's name, and honest copy — e.g. *"The template library — reusable
templates for documents and slide decks, shared across your projects and organization — is not
implemented yet."* Plus a back affordance (history back, falling back to `/projects`) and the
slim top bar (wordmark/theme + account) so the page is not a dead end.

**Why routes, not work-surface stages or tabs** (recommendation): these spaces are
project-independent and must be reachable from project selection, where there is no tab strip
and no work surface. A route works identically from both places and adds no tab-strip weight.
(The alternative — on-demand closeable tabs à la resource tabs — only works inside a project
and was rejected for that reason.)

## 2. Top-bar entries

**Workspace top bar (`ShellTopBar`)**: two labeled text buttons, **Context** and **Templates**,
in the left cluster right after the project menu — they are navigation, and new concepts get
words, not icons. Each `goto`s its `/library/*` route.

**Project selection (`routes/projects/+page.svelte`)**: the same two buttons in its existing
slim `TopBar`'s start section, after the wordmark.

While touching the projects page: its theme toggle is ad hoc (local component state seeded to
light regardless of the real theme — the first click can visually no-op, nothing persists, no
cross-fade). It switches to the shared `$lib/theme` store like the rest of the app. Small
honest fix, same pass.

## 3. The Templates panel (document + slides context rails)

A new rail section **Templates** in the document surface's contribution (after Layout), and in
the slides surface's rail. One shared component — `features/shared/templates/` — because two
stages render it and a second trimmed copy is the drift this repo keeps deleting:

- `TemplatesPanel.svelte` — the rail panel, two sections:
  - **Add a template** — an "Add template" button opening the modal below.
  - **Make a template** — Name input, Description textarea, a "Make template" button
    (mock: success toast, fields clear). On the slides surface this section gains a scope
    choice — **This slide / Whole deck** — per the user: a slide and a whole deck should both
    be saveable as templates. The document variant has no scope choice (the document is the
    scope).
  - Both sections badged **Mock**.
- `AddTemplateModal.svelte` — search input filtering a small fixed mock catalog (name,
  one-line description, kind badge: document / slides); choosing one "drops it in" (mock:
  toast + close — the copy says the insertion is mocked). Badged **Mock**.
- `mock-templates.ts` — the fixed catalog + search filter (pure, unit-testable).

Companion documents the deferred **Convert text → prompt** future (AI classifying text vs
prompt; auto-generated context variables) and the possible future "drop template" button in
the editor top bar.

## 4. Sign-in theme toggle

At the bottom of the login screen: a quiet text button via the shared theme store. Label =
the current mode's name ("Dark mode" while dark, "Light mode" while light — *"whatever it says
is the mode that you see"*); clicking toggles. Uses `$lib/theme`, so the choice persists and
the pre-paint bootstrap in `app.html` keeps honoring it.

## 5. What this pass does NOT do

- No backend calls, no new Omega requests. When the template/context model gets designed, a
  standalone backend request follows and the mocks get replaced (same playbook as the rest of
  the un-mocking effort).
- No template rendering/insertion mechanics — "drop in" is a toast.
- No convert-text-to-prompt UI.
- No changes to the tab strip, stages, or the editor runtime.

## Implementation shape (three commits, gates green each)

1. **Library routes + top-bar entries** — `/library/{context,templates}` placeholders; the
   Context and Templates buttons in `ShellTopBar` and the projects page; projects-page theme
   toggle moved to `$lib/theme`. *Known e2e touch:* `resources.spec.ts:461` clicks
   `getByText('Context')` (the AI panel's disclosure) — must be scoped before the top-bar
   button exists.
2. **Templates panel + modal** — `features/shared/templates/*`, registered in the document and
   slides surface contributions; `mock-templates.ts` with a small unit test.
3. **Sign-in theme toggle** — login page only.

Each commit: companions same-change, change record, `pnpm check` / vitest / build /
companions verifier / full e2e. A small e2e (or an extension of `persona-and-surfaces`) covers:
the top-bar buttons reach the placeholders, the Templates panel opens its modal with Mock
badges, the login toggle flips `data-theme`.

## Open points for review

1. **Routes over tabs** for the two spaces — recommended above; confirm.
2. **Slides scope choice now** (This slide / Whole deck in Make a template) — recommended in;
   cut if it feels premature.
3. **Button labels** — "Context" and "Templates" as plain words; rename freely.
