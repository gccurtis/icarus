# 2026-07-28 — Library pass 1/3: /library routes + top-bar entries

First commit of the approved Context & Templates plan
(`docs/plans/2026-07-28-context-templates-mock-pass.md`): the two asset spaces exist and are
reachable from everywhere they should be. All placeholder, honestly labeled.

## What shipped

- **`/library/context` and `/library/templates`** — new routes, both rendering the shared
  `features/library/LibrarySpace.svelte` frame: slim top bar (Back → history, falling back to
  `/projects`; wordmark; the two library nav buttons with the current space highlighted; theme
  toggle; account menu) over an Agents-style honest placeholder ("… is not implemented yet").
  Routes, not tabs, per the approved plan: the spaces are user/org-scoped and must work from
  project selection, where there is no tab strip. Anonymous users bounce to `/login`.
- **Workspace top bar** — Context / Templates as labeled ghost buttons in the left cluster,
  right after the project menu (navigation to new concepts gets words, not icons).
- **Project selection** — the same two buttons in its slim `TopBar`, after the wordmark. The
  full workspace bar was deliberately not copied (search/import/export/share are
  project-scoped and meaningless there).
- **Projects-page theme toggle fixed** — it was ad-hoc local state writing `data-theme`
  directly, fighting the shared store: seeded light regardless of the real theme (first click
  could no-op), nothing persisted, no cross-fade. Now `$lib/theme` like the rest of the app.
- **e2e**: new `library-and-theme.spec.ts` (suite 15) — nav from both bars reaches the
  placeholders, the spaces cross-link, Back returns to the previous space. It grows with the
  next two commits (Templates panel, sign-in toggle). One existing locator fixed:
  `resources.spec.ts` clicked a bare `getByText('Context')` (the AI panel's disclosure), which
  the new top-bar button would have made ambiguous — now scoped to the `<summary>`.

## Verification

`pnpm check` 0/0 · vitest 343/343 · build clean · companions OK (three new, three updated) ·
e2e **15/15**, and the placeholder screenshot read back visually.
