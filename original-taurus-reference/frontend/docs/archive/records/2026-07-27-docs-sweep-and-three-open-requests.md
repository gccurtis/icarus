# 2026-07-27 — Archive the old docs; three open backend requests, each standalone

Two asks in one pass: write the requests Omega still needs, and make it unambiguous which requests
those are. The second turned out to be the bigger problem.

## The problem: two competing "build this" lists

`docs/backend-requests/` and `docs/integration/current/2026-07-25-backend-outstanding.md` both
claimed to say what Omega should build, and both were stale. Re-audited against Omega's registered
routes and capability source:

| Claimed Open | Actually |
|---|---|
| workspace state | ✅ shipped — `GET/PUT /workspace` |
| `list` block kind + indent | ✅ shipped — `BlockKindList` |
| typography defaults | ✅ shipped — `Base.DefaultTypography` |
| project member summary | ✅ shipped — bounded `members` on `GET /projects` |
| chat attachments | ✅ shipped |
| AI resource generation | ✅ shipped — `POST /resources/generate`, wired |
| document row windows | ⛔ withdrawn — Alpha deleted pagination and windowing |

Six of seven "open" items were not open. A list like that is worse than no list.

## The fix: archive, don't curate

Rather than keep re-syncing, everything shipped/withdrawn/superseded moved to `docs/archive/`:
19 backend requests, the whole `integration/` tree, `superpowers/`, four dead plans, and the
row-windows discrepancy.

**`docs/backend-requests/` now contains only open asks.** Three files plus a README. If a file is
there, it needs building.

Links from `docs/records/` are deliberately **not** rewritten — a record describes what was true on
its date. The archive README explains the sweep so a 404 is one hop from resolution.

## The three requests

Each written standalone: what already works (so nothing gets rebuilt), the gap, request/response
shapes, the rules that matter, a numbered verification list, and Alpha's current fallback. Omega
should not need to read Alpha's source.

1. **[Validate document mark payloads](../../backend-requests/document-mark-payload-validation.md)** —
   high, security. Refreshed from the earlier filing with verification steps.
2. **[Per-turn / per-task persona override](../../backend-requests/persona-override-per-turn-and-task.md)** —
   new. Includes why Alpha will *not* fake it client-side: PATCH-post-PATCH is a lost-update race
   and makes the chat's persona briefly wrong for other readers.
3. **[Live collaboration presence](../../backend-requests/live-collaboration-presence.md)** — new.
   Names the real gap precisely: Alpha polls `GET /sessions` every 30 s because there is no `GET`
   for document presence and no push channel, and infers document occupancy from *project*
   sessions. Asks for the read, an SSE stream, and a server-side TTL — noting the TTL alone is
   worth shipping, since it fixes ghost occupants for every client.

## Deferred is now a place, not a footnote

`docs/deferred/` records work deliberately **not** being done, so it stops resurfacing as a gap:

- **Notifications feed** — Omega already ships `GET /notifications`; Alpha is not building the
  surface. Activity already answers "what happened". Records what *would* change our mind.
- **pdf / docx** — long-term. Markdown round-trips today. Notes the honest blocker for pdf: Alpha
  deliberately removed pagination, so there is no page model to export from.

Neither is a backend request, and the backend-requests README says so explicitly.

## Workstream E — real Share

Investigating "is the real Share model ours or Omega's" answered itself: **`ShareDialog.svelte` is a
41-line mock** copying `/join/mock-share-token`, while every piece it needs is already real *and
already used* by `ProjectSettingsDialog` — links (fetch/rotate/disable), visibility, and member
add/role/remove, with `joinByToken` covered by a passing e2e.

**No backend work.** Filed as workstream **E** (reorg plan §6): extract the sharing UI into a shared
`ProjectSharing.svelte` used by both dialogs so they cannot drift, then delete the mock. E runs
before D.
