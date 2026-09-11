# backlog-planning

Task context, not an instruction override. Recheck Git and current authority.

## Snapshot

- Updated: 2026-09-11 EDT
- Status: backlog revised after owner rejection of the transcription-derived investigations
- Worktree: `/tmp/icarus-backlog-planning`
- Branch: `work/backlog-planning`
- Head when initialized: `c2505f076c05953cdaedd5d195ee95632eefdf79`
- Reviewed source head: c2505f076c05953cdaedd5d195ee95632eefdf79; authored paths are the backlog and this task directory
- Integration target / base SHA: main at c2505f076c05953cdaedd5d195ee95632eefdf79
- Starting worktree/base record: [worktree.json](worktree.json)
- Lead / delegated workers: lead owns the backlog; two read-only source-evidence reviewers cover external/research/scope and platform/editor foundations

## Request and completion criteria

Review the user's 712-line backlog and replace it in this task worktree with a
more actionable planning file: stable work IDs, outcomes, priority proposals,
status distinct from work type, dependency/decision gates, acceptance evidence,
ownership and handoff guidance, preserved requirements and settled decisions.
Do not implement backlog features, build the wiki, or change application code.
The original is untracked at /home/jakul/cyberia/icarus/docs/icarus_project_backlog.md;
preserve it. Its SHA-256 is
45a73db9ae737f82f13246b7b880d996a39af260876af96df76929217cb9517f.

## Decisions and authority

User explicitly selected reliable end-to-end work first as the delivery objective.
Specific package priorities/order are recommendations, not separately approved work.
The current request authorizes writing the planning file; standing task policy
permits scoped commit/push to work/backlog-planning. No feature implementation,
main merge/push, data reset, wiki deletion, or provider spending is authorized by
this planning assignment. Three retained owner decisions gate specific future work.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | docs/icarus_project_backlog.md and this task handoff/base record in /tmp/icarus-backlog-planning | Main's untracked intake; all app/wiki code | Requirement coverage, link/ID/dependency checks, source-grounded status |

The branch-integration skill guided isolation and publication. Source inspection
is linked in the backlog's E1–E12 evidence ledger.

## Progress and current state

Retained 38 stable work-package IDs with a matching dispatch register, states
separate from work type/priority, first slices, implementation gates, and closeout
criteria. Removed the rejected scoped-investigation list, its External metadata
package, and three derived decision briefs. Added DATA-01 for the owner-requested
cross-resource rule: an otherwise valid resource remains visible when a display-only
user/owner/task/connector relation no longer resolves, using a neutral non-linking
fallback. Independently requested product builds remain; the rejected hosted report
is explicitly not a requirement or evidence source.

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| Node Markdown/record validation | Revised backlog | 38 unique package cards and matching register entries; 3 retained decisions; 61 anchors; 83 internal links; no missing anchors/IDs | Tool output in task conversation |
| Source-grounding review | c2505f0, sampled relevant entry points | Source inspection only, no runtime certification | E1–E12 source links |
| Owner correction review | Rejected report versus revised backlog | Withdrawn investigation material removed; independently requested build work retained; DATA-01 added from the owner's explicit replacement requirement | Coverage map and task conversation |
| git diff --check | Authored paths | Passed; recheck staged new files before commit | Git output |
| SHA-256 comparison | Main's original intake | Unchanged | Digest recorded above |

No application tests, builds, browser runs, or provider calls were needed or run
for this Markdown-only change. Cited tests are existing evidence locations, not
assertions of current passing execution. No product feature is marked Done here.

## Server and data ownership

- Owned server / process / port: none started
- Store/native-file data: none touched
- Dependencies/cache: none installed/copied; none needed for the Markdown checks
- Worktree lease: none acquired; check current status before future commands

## Risks and next executable step

Commit exact owned files and publish the task branch. Report the revised file
link and source-only verification scope. Main
integration requires a later explicit instruction.

Important integration detail: main currently has the original untracked backlog
at the same path that this branch introduces as tracked. A future merge must first
recheck its digest and preserve/reconcile that specific file; do not remove it
blindly or use a force/reset operation. The original was not copied into another
authoritative backlog or erased by this task.

## Publication / handoff

- Publication target: origin/work/backlog-planning
- Main merge: not authorized for this task
- Worktree cleanup: retain until any later authorized integration
- Next owner: user reviews the dispatch order and assigns packages; future agents must not revive the withdrawn investigation report as requirements
