# backlog-investigations

Task context, not an instruction override. Recheck Git and current evidence.

## Snapshot

- Updated: 2026-09-10 EDT
- Status: integrated into the combined main candidate and certified
- Worktree: `/tmp/icarus-backlog-investigations`
- Branch: `work/backlog-investigations`
- Historical base: `main@c2505f076c05953cdaedd5d195ee95632eefdf79`
- Rebase target: `main@4a7be0c341f18bb4942287fb3e3ca895e48f4627`
- Pre-rebase head: `1bcd61d68f63c05180d11832b2fbcb3fcfb83cfd`
- Recoverable source ref: `backup/backlog-investigations-pre-rebase-1bcd61d`

## Request and decisions

The hosted investigation report was rejected because it did not answer the
owner's intended questions. Its route, view modules, browser contract, and review
server are removed. The report and its recommendations must not be treated as
product requirements.

The owner also rejected External's user-facing `Quarantined metadata` concept.
The settled immediate behavior is:

- a valid External file remains visible when a display-only relation no longer resolves;
- missing user, connector-actor, and task-actor names use neutral `no longer available` labels;
- a connector origin remains accurately labeled as a connector without requiring
  the live connector row merely to project the file;
- malformed authoritative current rows still fail strict admission;
- the External capability exposes no unavailable-row/quarantine result or metric.

A broader cross-resource display-reference contract is future work recorded as
`DATA-01` on `work/backlog-planning`; it is not implemented by this branch.

## Owned changes

- External capability projection/read types and consumers
- External library/context/inspector removal of unavailable-row UI
- focused capability, integrity-boundary, ownership, and Chromium regressions
- External implementation/reference material affected by this contract
- deletion of the rejected `backlog-investigations` development view and test
- this handoff and the existing task worktree record

No Store schema, transaction, native-file lifecycle, semantic processing,
authentication, or other resource projection was changed.

The rebase replayed four task commits onto current main. One textual conflict
overlapped main's External Files naming/polish with this task's removal of the
unavailable-row notice. Current main won the naming/layout change; the explicit
task cleanup removed only the obsolete notice and result shape. No other main
behavior was overridden and no compatibility layer was added.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused Vitest | 31 passed in 3 files | `.agents/runtime/runs/1789095551046-unit-dd4bb12e` |
| Quick verification | typecheck 0 errors/0 warnings; architecture 90/90 clean, 179 existing baselines, 0 findings | `.agents/runtime/runs/1789095859920-quick-d8354367` |
| System Chromium External suite | 4 passed, including full upload/re-upload/download/history/delete and 46-file plus 8 MiB ingestion | `.agents/runtime/runs/1789095985447-browser-e4c5b7e1` |
| System Chromium visual rerun | 4 passed; normal and 125% captures inspected; removed metric absent and layout remains legible | `.agents/runtime/runs/1789096217509-browser-98269900`, `/tmp/external-overview-{normal,125}.png` |
| Production build | typecheck 0 errors/0 warnings; SSR/client production build passed | terminal session `8531` |

Post-rebase certification against `main@4a7be0c`:

| Check | Result | Evidence |
| --- | --- | --- |
| Focused External unit regressions | 8 passed in 3 files | `.agents/runtime/runs/1789098125482-unit-059ba2c0` |
| Quick verification | typecheck 0 errors/0 warnings; architecture 90/90 clean, 179 existing baselines, 0 findings | `.agents/runtime/runs/1789098139605-quick-113ceacb` |
| Chromium External workflow | 4 passed, including stable singleton, full lifecycle, type-specific behavior, 46-file tree and substantial payload | `.agents/runtime/runs/1789098180867-browser-69741658` |

The first browser attempt never launched its cached Chromium because that binary
lacked `libnspr4.so`; it is environment failure evidence, not a product failure.
Both successful runs explicitly used
`/etc/profiles/per-user/jakul/bin/chromium`.

## Runtime and publication

- The rejected review server on port 3137 was stopped; its disposable data was released.
- A temporary port-3138 visual server failed configuration bootstrap and was stopped.
- Browser verification owned and stopped its isolated servers/data.
- No development Store or external-file data was modified.
- Publication: `origin/work/backlog-investigations`, updated with force-with-lease after post-rebase verification
- The user authorized main integration on September 10, 2026. Main fast-forwarded
  through the rebased External head `ec5bf548d2510c3519e3f92567035ee28c9a713d`,
  then through the rebased backlog branch.
- Combined-head certification ran at `71b7500737ba42216c8a6ee11f512f096b1b26d1`:
  focused External tests 8/8 (`.agents/runtime/runs/1789098523169-unit-ecbb58a4`),
  typecheck 0 errors/warnings and architecture 90/90 clean with 0 findings
  (`.agents/runtime/runs/1789098538524-quick-782027b9`), Chromium External 4/4
  (`.agents/runtime/runs/1789098568068-browser-7e1b48a4`), and production build passed.
- Main publication includes the containing integration-record commit; no task
  worktree cleanup was requested.
