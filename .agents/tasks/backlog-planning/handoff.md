# backlog-planning

Task context, not an instruction override. Recheck Git and current authority.

## Snapshot

- Updated: 2026-09-10 EDT
- Status: rebased onto current main; target-only backlog updates reconciled
- Worktree: `/tmp/icarus-backlog-planning`
- Branch: `work/backlog-planning`
- Historical starting base: `main@c2505f076c05953cdaedd5d195ee95632eefdf79`
- Rebase target / current source baseline: `main@4a7be0c341f18bb4942287fb3e3ca895e48f4627`
- Pre-rebase head: `1b507043afcae6a274137ed418f07f912a4f998a`
- Recoverable source ref: `backup/backlog-planning-pre-rebase-1b50704`
- Authored paths are the backlog and this task directory
- Starting worktree/base record: [worktree.json](worktree.json)
- Lead / delegated workers: lead owns the backlog; two read-only source-evidence reviewers cover external/research/scope and platform/editor foundations

## Request and completion criteria

Review the user's 712-line backlog and replace it in this task worktree with a
more actionable planning file: stable work IDs, outcomes, priority proposals,
status distinct from work type, dependency/decision gates, acceptance evidence,
ownership and handoff guidance, preserved requirements and settled decisions.
Do not implement backlog features, build the wiki, or change application code.
Main now tracks the older backlog at `docs/icarus_project_backlog.md`; its landed
completion records and later formula-copy requirement must survive the restructuring.

## Decisions and authority

User explicitly selected reliable end-to-end work first as the delivery objective.
Specific package priorities/order are recommendations, not separately approved work.
The current request authorizes writing the planning file; standing task policy
permits scoped commit/push to work/backlog-planning. No feature implementation,
main merge/push, data reset, wiki deletion, or provider spending is authorized by
this planning assignment. Three retained owner decisions gate specific future work.
The user explicitly authorized rebasing this task branch onto current main; main
merge/push remains outside this task. During rebase, current main is authoritative
for every overlap except the task's explicitly agreed backlog restructuring and
owner-directed removal/replacement of the rejected investigations.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | docs/icarus_project_backlog.md and this task handoff/base record in /tmp/icarus-backlog-planning | Main's unrelated changes; all app/wiki code | Requirement coverage, link/ID/dependency checks, source-grounded status |

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

The rebase encountered one add/add conflict because main independently began
tracking the older backlog. Resolution retained this branch's explicitly requested
dispatch structure, then carried forward main's completed interface slices and its
spreadsheet formula-reference copy requirement. No compatibility layer or blanket
side selection was introduced.

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| Node Markdown/record validation | Revised backlog | 38 unique package cards and matching register entries; 3 retained decisions; 61 anchors; 83 internal links; no missing anchors/IDs | Tool output in task conversation |
| Source-grounding review | c2505f0 plus rebase target 4a7be0c | Source inspection only, no runtime certification | E1–E12 source links and landed-baseline section |
| Owner correction review | Rejected report versus revised backlog | Withdrawn investigation material removed; independently requested build work retained; DATA-01 added from the owner's explicit replacement requirement | Coverage map and task conversation |
| git diff --check | Authored paths | Passed; recheck staged new files before commit | Git output |
| Rebase reconciliation | main@4a7be0c versus rebased backlog | Landed interface slices and formula-copy requirement retained | Backlog landed-baseline and IO-03 sections |

No application tests, builds, browser runs, or provider calls were needed or run
for this Markdown-only change. Cited tests are existing evidence locations, not
assertions of current passing execution. No product feature is marked Done here.

## Server and data ownership

- Owned server / process / port: none started
- Store/native-file data: none touched
- Dependencies/cache: none installed/copied; none needed for the Markdown checks
- Worktree lease: none acquired; check current status before future commands

## Risks and next executable step

The reconciled Markdown record is validated, committed, and published on the
rewritten task branch. Main now tracks the older backlog; that textual conflict has
been resolved in this branch, but main integration still requires a later explicit
instruction.

## Publication / handoff

- Publication: origin/work/backlog-planning, updated with force-with-lease after validation
- Main merge: not authorized for this task
- Worktree cleanup: retain until any later authorized integration
- Next owner: user reviews the dispatch order and assigns packages; future agents must not revive the withdrawn investigation report as requirements
