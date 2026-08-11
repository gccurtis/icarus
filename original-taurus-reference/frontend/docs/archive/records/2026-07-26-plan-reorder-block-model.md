# Re-order the full-integration plan around the block-model migration

Docs-only change. No code touched. Re-sequences the remaining full-integration work so
that everything **independent of Omega's block model** is built first, and the work that
reads or writes block/row payloads runs **after** the in-progress block-model migration
(a `text` kind with sub-kinds). This is a **re-order, not a deferral** — every phase stays
on the roadmap and visible; only the sequence changed.

## Why

Omega is mid-migrating its block model. A2's inspector/Layout work (Commits 2–3) and the
windowed row reads both target block/row shapes the migration rewrites, so building them
now against the current 14-kind model would be throwaway. The rest of the backlog (the AI
dock, resource access, organizations, templates, pdf/docx options, Name Manager) has no
block-model coupling and is fully backable today (verified: Omega HEAD `aa81b20` shipped
templates, toast notifications, organizations, and per-resource access; `model.go` still
carries the current kinds — the migration has not landed yet).

Framed as a re-order (not "deferred") per the standing **nothing-hidden** principle: a
deferral reads like shelving and risks being forgotten; a re-order keeps each item on the
active roadmap, just later in sequence.

## New sequence

Build now (block-model-independent): **B2 (AI dock) → Resource access (G4) + Organizations
→ Templates (G1) → pdf/docx options → Name Manager verify.**

After the block-model migration lands (re-ordered, still on the roadmap): **A2 Commit 2–3
(inspector + Layout cleanup; revisit `block-kinds.ts` for sub-kinds first) → Windowed row
reads.**

Last, separate: **Notifications (G2)** — ephemeral drain-toast channel; discuss the shape
first.

A side effect: the fg/bg custom-typography color split (which needed a new Omega
`CustomTypography.backgroundColor` field) travels with A2 Commit 2, so that decision is
parked until after the migration too.

## Files

- `docs/superpowers/plans/2026-07-26-full-integration.md` — rewrote the Order section;
  added "re-ordered (not deferred)" notes to Phase 1 (A2) and Phase 6 (windowed rows).
- `docs/integration/current/ORIENTATION.md` — "What's next" is now one 1–8 sequence; added
  a "block-model fault line (re-order, not deferral)" entry to decisions-locked.
- `docs/integration/current/2026-07-25-integratable-now.md` — updated the recommended order.
- Persistent memory (`full-integration-and-backend-migration.md`) — updated "next is A2
  Commit 2" to the re-ordered sequence (B2 next).
