# Integration

The single source of truth for the Alpha ↔ Omega integration of the **document editor**. Verified
against Omega `main` @ `2a7229f` (2026-07-24) — routes in `core/transport/transport.go`, capabilities
in `core/capability/`, and Alpha's live op-emitting runtime.

## [`current/`](current/) — the live set (read these)

Three documents, each superseding its same-named predecessor in [`old/`](old/):

- **[current/omega-integration.md](current/omega-integration.md)** — **the audit.** Every
  document-editor feature classified WIRED / mockable-now / blocked, with file-level evidence, the
  exact Omega endpoint or changeset op, and an Omega reliability tier. Start here.
- **[current/alpha-implementation-plan.md](current/alpha-implementation-plan.md)** — **Alpha work
  plan.** A Goal-by-Goal transition plan for every mock Omega can already back — plus a Phase 0 that
   fixes the two live bugs (the `set_row_height` → `set_block_line_height` op break and presence never joining). This is the
  "un-mock it" checklist.
- **[current/backend-contract.md](current/backend-contract.md)** — **Omega work requests.** Only the
  features that are genuinely blocked because Omega has no capability yet — each with what it is, why
  the editor needs it, why it's blocked, and the concrete backend to build. This is what the Omega
  team reads.

**How the three relate:** the audit is the survey; the plan executes its "mockable now" column; the
contract enumerates its "blocked" column. Live bugs live in the plan (they're Alpha fixes for
already-supported features); realtime co-typing is called out in the contract as a deliberate
non-goal.

## [`old/`](old/) — historical

The first integration pass (2026-07-24, earlier). Superseded because a large body of Omega document
work (records 0049–0057: sessions/presence, creator, identity enrichment, agent/persona engine,
anchors, duplicate, diff) landed **after** it was written, so its "blocked/build" verdicts for those
items are stale. Kept for provenance. Do not plan against `old/`.

## Relationship to other docs

These supersede `docs/discrepancies/` and `docs/backend-requests/` for anything not yet shipped; those
directories remain as historical per-feature record. Related design docs:
[../plans/2026-07-24-runtime-architecture.md](../plans/2026-07-24-runtime-architecture.md),
[../plans/2026-07-24-data-layer-architecture-migration.md](../plans/2026-07-24-data-layer-architecture-migration.md).
