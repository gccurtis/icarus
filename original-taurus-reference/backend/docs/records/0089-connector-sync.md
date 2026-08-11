# Connector sync + change detection (live-document Slice B)

The second slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-connector-sync-and-change-detection.md`](../superpowers/plans/2026-07-26-connector-sync-and-change-detection.md)).
It makes a connector's external content flow into the knowledge lattice and
re-flow automatically when the source changes — satisfying design acceptance
criterion 2.

## What changed

- **Provider seam.** `Provider.Snapshot()` returns a connector's current content
  plus a fingerprint that moves iff the content moves. The `local-folder` provider
  reads a directory (non-recursive, name-sorted; SHA-256 over each file's name,
  length, and bytes). This reads the directory **in-process** — the proto stand-in
  for the companion-watcher program the design calls for, behind the same
  `Provider` contract (see the proto-simplification note below).
- **Sync state.** A connector now records `Fingerprint` / `SyncSeq` / `SyncedAt`
  (persisted in memory and SQLite, surviving reopen), and the sync-state is
  exposed on the connector view (`syncSeq`, `syncedAt`).
- **Sync.** `Connectors.Sync` feeds the provider snapshot into the lattice
  (`knowledge.Add` under the new `SourceTypeConnector`) under a monotonically
  increasing sequence; `SyncIfChanged` re-syncs only when the fingerprint moved.
  The `LatticeWriter` seam and the wiring adapter keep `connector` and `knowledge`
  independent.
- **Automatic change detection.** `Connectors.DetectChanges` re-syncs every
  connector whose source changed, across projects (best-effort per connector). A
  bounded background detector goroutine (2 s) in the composition root runs it, so
  an external edit reaches the lattice with **no manual sync call**.
- **Manual sync route.** `POST /connectors/:id/sync` forces a re-sync and returns
  `{seq, changed}`.

## Deviations from the plan (deliberate)

- **No dedicated `connector.sync` job.** The plan sketched a job type + registry
  registration. Sync runs **inline** instead — via the manual route and the
  detector goroutine — which is simpler and fully covers the demo. A job (to move
  syncs off the request/detector path) is a clean follow-up behind the same
  `SyncIfChanged`.
- **Detector cadence is a constant, not config.** The 2 s interval and its
  always-on nature are a proto choice; a config knob and prod gating (the spec
  marks continuous no-viewer polling a future mode) are follow-ups.

## Known gap

- **Sync embedding cost is not surfaced in the sync response.** A sync embeds via
  `knowledge.Add`, but the HTTP sync response carries no `usage`, so the dev-test
  surfaces only the *retrieval* token cost. Threading usage through
  `LatticeWriter` → `SyncResult` → the response is a follow-up; per-sync cost for
  a small folder is negligible.

## Tests

- Unit (`core/capability/connector`): local-folder snapshot concatenates +
  fingerprints (stable when unchanged, moves on edit); `Sync` feeds a fake lattice
  and bumps the sequence; `SyncIfChanged` no-ops an unchanged source and re-syncs
  a changed one; `DetectChanges` re-syncs only the changed connector.
- Persistence (`core/platform/storage/sqlite`): sync state round-trips across a
  reopen.
- Transport (`core/transport`): `POST /connectors/:id/sync` returns `{seq,
  changed}`.
- Dev-test (`dev-test/connectors`, sync section key-gated): a `local-folder`
  connector syncs into the lattice, its content is retrievable
  (`sourceType=connector`), and the background detector re-syncs after an external
  file change with no manual call. CRUD checks still run without a key. Token cost
  is surfaced.

## Settled

- Connector content flows through the knowledge lattice under its own source type. ✓
- Change is detected by a provider fingerprint; the detector re-syncs automatically. ✓
- `connector` and `knowledge` stay independent (the lattice adapter lives in wiring). ✓
- Satisfies design acceptance criterion 2. Downstream prompt-block refresh is Slices F/G.

## Follow-up: externalized provider + surfaced cost

A follow-up brought the implementation in line with the design's original intent
(the server "queries a running companion program") and closed the two gaps above:

- **Cost is surfaced.** A new central sink `core/platform/telemetry` receives
  cost/usage events; the sync threads its embedding `usage` from the lattice write
  through `SyncResult`, returns it on the sync response, and reports it to the sink
  on every sync (manual or detector). No sync cost is discarded silently now. (The
  connectors dev-test's token total rose from 5 to 20, now counting the sync's
  embedding, not just retrieval.)
- **The watcher is a real external process.** `cmd/connector-watcher` is a tiny
  standalone web server that watches a folder and serves its content + fingerprint
  over HTTP (`GET /snapshot`). Omega's provider is now an **HTTP client**
  (`NewHTTPProvider`) that polls it; the in-process filesystem read is gone from
  the server. A connector's config is now the **provider endpoint** (the watcher
  URL), validated non-empty (format is the provider's concern). The detector
  goroutine remains in Omega but polls each connector's watcher over HTTP — the
  same shape a real cloud provider (Drive) will use. Push notifications become a
  later, per-subkind capability for providers that support them.
- The local-folder snapshot logic is reused by the watcher; Omega no longer reads
  the filesystem. The dev-test now starts the watcher over a temp folder and points
  a connector at it, proving the full external round-trip.
