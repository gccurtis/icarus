# backlog-investigations

Task context, not an instruction override. Recheck Git and current evidence.

## Snapshot

- Updated: 2026-09-11 EDT
- Status: rejected report removed; External stale-relation behavior implemented and verified
- Worktree: `/tmp/icarus-backlog-investigations`
- Branch: `work/backlog-investigations`
- Base: `main@c2505f076c05953cdaedd5d195ee95632eefdf79`
- Starting branch head: `10c00e3b66b7b8ae82c3a3afc878a3413d0d6031`
- User-owned exclusion: the untracked original backlog in the primary worktree remains untouched

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

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Focused Vitest | 31 passed in 3 files | `.agents/runtime/runs/1789095551046-unit-dd4bb12e` |
| Quick verification | typecheck 0 errors/0 warnings; architecture 90/90 clean, 179 existing baselines, 0 findings | `.agents/runtime/runs/1789095859920-quick-d8354367` |
| System Chromium External suite | 4 passed, including full upload/re-upload/download/history/delete and 46-file plus 8 MiB ingestion | `.agents/runtime/runs/1789095985447-browser-e4c5b7e1` |
| System Chromium visual rerun | 4 passed; normal and 125% captures inspected; removed metric absent and layout remains legible | `.agents/runtime/runs/1789096217509-browser-98269900`, `/tmp/external-overview-{normal,125}.png` |
| Production build | typecheck 0 errors/0 warnings; SSR/client production build passed | terminal session `8531` |

The first browser attempt never launched its cached Chromium because that binary
lacked `libnspr4.so`; it is environment failure evidence, not a product failure.
Both successful runs explicitly used
`/etc/profiles/per-user/jakul/bin/chromium`.

## Runtime and publication

- The rejected review server on port 3137 was stopped; its disposable data was released.
- A temporary port-3138 visual server failed configuration bootstrap and was stopped.
- Browser verification owned and stopped its isolated servers/data.
- No development Store or external-file data was modified.
- Publication target: `origin/work/backlog-investigations`
- Main merge/push is not authorized by this task.
