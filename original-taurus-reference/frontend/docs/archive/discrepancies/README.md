# Front-end ↔ back-end discrepancies

Taurus Alpha is designed **front-end first**: we shape the user experience, then
back it with Taurus Omega data. When the two models differ, the **UX shape wins in
the interface** and we translate at the data boundary — and we record the mismatch
here so the translation is intentional and visible, never a silent surprise.

## When to add an entry

Whenever wiring a screen to Omega surfaces a difference the UI deliberately does
not mirror 1:1 — different vocabulary, a field the backend lacks (or vice versa), a
shape the UX reframes, an auth/transport detail. One file per topic; keep it short
and current.

## How to reconcile

- Keep the front-end types/labels that make the UX best.
- Map to/from the backend at the edge (the `src/lib/data/*` client layer), not
  scattered through components.
- Link the relevant discrepancy doc from the code that does the translation.

## Discrepancies vs backend requests

A **terminology/shape** difference is only a discrepancy — the front-end
translates it, no backend work. A **feature gap** is both a discrepancy (how we
mock it now) and an actionable ask in
[`docs/backend-requests/`](../backend-requests/README.md) (what the backend should
build). Feature-gap entries here link to the request that will close them.

## Entries

- [authentication.md](authentication.md) — session model, `/auth/me` shape,
  account creation, dev transport.
- [roles.md](roles.md) — project role vocabulary (`owner/editor/viewer` ↔
  `owner/edit/read`) and visibility.
- [projects.md](projects.md) — real project lifecycle, profile, purpose, membership,
  and sharing; records the remaining projects-list member-summary and timestamp UI
  gaps.
- [resources.md](resources.md) — project resources (the Overview stage's content) are
  real now (Omega's resource catalog); records the `availableKinds` gating and the
  locally-created non-document kinds.
- [overview.md](overview.md) — the Overview stage's **purpose statement** and
  **activity feed** are both real now; records the role write-gating on purpose and
  Activity's snapshot/current-state boundary.
- [documents.md](documents.md) — the document editor is **real** (Omega documents +
  change sets); records the shape translations (rows, byte-offset marks, single-atom
  writes), canonical resource-id binding, and the legacy-tab compatibility fallback.

Entries retired to [`../archive/discrepancies/`](../archive/README.md) when the thing
they described stopped existing: `document-row-windows.md` (row windowing and
pagination were deleted), `document-inspector.md` (the gutter-anchor interaction and
the Row / Multiple-Blocks lenses were removed; font and colour are real inline marks
now), and `ai-agent.md` (the AI surface is a real Omega client — chats, turns, tasks,
personas, attachments — not the mock it described).
