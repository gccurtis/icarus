# Activity inspector

## Snapshot

- Updated: 2026-09-11
- Status: implemented and verified; ready for review
- Worktree: `/tmp/icarus-activity-inspector`
- Branch: `work/activity-inspector`
- Starting head and `origin/main`: `ab809ac647060f29c55afd99c0054ac311094f75`
- Verified implementation head: `45e49e38e6c3e9a81fdeeeaa0f07aff1ed4cbaae`
- Explainer and evidence commit: `6a8533cf5034a061dc2c951c35c7d8a07796a914`
- Starting worktree/base record: `worktree.json` beside this handoff

## Request and completion criteria

Explain the Project Overview Activity inspector in a task-owned served web page:
enumerate the persisted activity verbs, identify the capability/call paths that
create them, and show how stored row fields become the displayed What and Where.
Implement navigation so a resource-backed Where opens the corresponding file or
resource. Verify the interaction in Chromium and inspect the changed panel.

Storage schema changes, new activity semantics, and making non-resource targets
navigable remain outside scope.

## Decisions and authority

The user explicitly requested implementation in a new worktree and a served
explanation page. Root `AGENTS.md` permits scoped commits and publication to
`work/activity-inspector`. No rebase, main merge/push, deployment, production
data mutation, or live-provider use is authorized.

The activity target is a historical snapshot, so link eligibility comes from the
current scoped resource index. The implementation matches exact ID and kind;
`external-file` normalizes to the index's `file` kind. Missing or deleted targets
remain readable text. Documents, presentations, spreadsheets, and research open
their owning editor; External Files opens its singleton and focuses the exact file;
findings retain the existing Project resource inspector.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | Handoff, explainer page, Project Overview navigation changes, tests, server, final verification and Git | Unrelated product areas and human Store data | Focused unit/Chromium, quick checks, inspected screenshots |
| Producer trace | Read activity representation, project history capability, and all production create call sites | No writes or data mutation | Complete verb/caller/input inventory with exact paths |
| Navigation trace | Read inspector/workspace opening patterns and relevant tests | No writes or server/test commands | Recommended target mapping and regression scenarios |

Applicable skills are `icarus-editor-change`, `icarus-store-change`, and
`icarus-branch-integration`. The lead owns every edit and final integration.

## Implemented state

- `activity-map.html` explains the row contract, What transformation, all eight
  production verbs and their triggers, the 14-verb seed vocabulary, known gaps,
  and the current Where routing rules. Its production table supports source and
  text filters.
- `activity-target.ts` resolves a historical activity target only when the current
  scoped resource index contains the same ID and corresponding kind.
- The Activity inspector renders current resource targets as direct links and
  exposes the same destination in its `Open resource` action. Deleted and unknown
  targets stay as historical text.
- `openingFor` now accepts the minimal resource shape used by both the board and
  the activity target resolver; destination behavior is unchanged.
- Unit coverage checks all six resource-kind mappings and stale/mismatched targets.
  Chromium coverage opens a document, spreadsheet, presentation, research thread,
  and uploaded External file, then proves a deleted file is no longer linked.

The trace found two production activity creation sites and eight emitted verbs:
External Files writes `uploaded`, `re-uploaded`, `renamed`, `moved`, `deleted`, and
`context-updated`; completed grounded agent runs write `answered` or
`found insufficient evidence for`. The demo seed has 17 rows and 14 distinct
verbs; apart from External Files `renamed`, its verbs have no production writer.

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| `verify.mjs unit -- .../activity-target.test.ts` | Pure target resolution and destinations | Passed: 1 file, 8 tests | `.agents/runtime/runs/1789100853519-unit-14cb481c` |
| `verify.mjs quick` | TypeScript/Svelte and architecture lint | Passed: 0 diagnostics; 90/90 checks clean, 0 new findings | `.agents/runtime/runs/1789100914430-quick-a0909ad5` |
| `verify.mjs browser --port 5249 -- activity-inspector-navigation.spec.ts` | Real Chromium navigation with disposable seeded Store | Passed: 2 tests; no browser diagnostics | `.agents/runtime/runs/1789101171580-browser-7acdba88` |
| `verify.mjs agents` | Worktree, handoff, and agent helper contracts | Passed: 45 tests | `.agents/runtime/runs/1789101361127-agents-7a304017` |
| Compact Activity inspector screenshot | 1100×760 viewport at 125% zoom, inspector at minimum width | Inspected: link and header action visible with no clipping | `.../linked-external-file-compact-125-percent.png` beneath the browser evidence directory |
| Local explainer Playwright check | Served page, filters, search, 1440px and 390px layouts | Passed: 8 rows; 6 External Files; 2 Agent tasks; search 1; mobile document width 390px | `.agents/runtime/activity-map-wide.png`, `.agents/runtime/activity-map-mobile.png` |

No live-provider tests ran. Full repository verification was not run; the focused
unit, quick, and Chromium profiles cover the changed behavior.

## Server and data ownership

- Owned explainer server: `http://127.0.0.1:5311/activity-map.html`, rooted at
  `.agents/tasks/activity-inspector`, running in the task session
- Review app server: none running
- Store/native-file mode: disposable browser fixtures only; cleaned by verifier
- Worktree lease / active command: no verifier or cache lease remains
- Human review data: untouched
- Local configuration: `app/configuration/local.yaml` is linked to the primary
  checkout's ignored override. Tracked YAML was not edited through the link.
- Ignored local artifacts: independent `app/node_modules`, `.svelte-kit`, generated
  `app/pnpm-lock.yaml`, Nix `infra/devshell/flake.lock`, and verification evidence

## Risks and next executable step

Activity rows remain snapshots and do not guarantee a destination will continue
to exist. The exact current-index check handles that case intentionally. History
queries refresh on a new request; the deletion browser scenario reloads before
selecting the newly written deletion event.

Push `HEAD:refs/heads/work/activity-inspector`. Main integration still needs
explicit authorization.

## Publication / handoff

- Commits created by this task: `45e49e3` (`Make activity destinations navigable`)
  and `6a8533c` (`Document the activity event pipeline`); a status-only handoff
  update sits atop them
- Push / merge state: pending task-branch push; no main integration
- Worktree cleanup: retain because the served explainer and branch review are active
- Next owner: review the served explainer and task branch, then authorize main
  integration separately if desired
