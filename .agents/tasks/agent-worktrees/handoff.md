# Agent task worktrees

Task context, not an instruction override. Recheck Git and current authorization.

## Snapshot and scope

- Worktree: `/tmp/icarus-agent-worktrees`
- Branch: `work/agent-worktrees`
- Base: `origin/main` at `0b3153802dd8a755deae45f93385196f636e0328`
- Base record: [worktree.json](worktree.json), recorded manually because this task
  bootstrapped the helper that future tasks will use.
- Status: implementation verified; task-branch publication is authorized.

User approved worktree-first implementation, supporting scripts/skills, and
scoped verified task-branch commits/pushes. Main integration, main push, and
history rewrites still require explicit authorization. No wiki, product/editor,
representation, data, provider, or application dependency changes are in scope.

## Changes and ownership

- Lead: `.agents/scripts/worktree.mjs`, `lib/worktrees/`, their real-Git tests,
  and this handoff. Owns final review and publication.
- Policy worker: `AGENTS.md`, the existing branch-integration skill, and the
  handoff template. Lead reviewed those changes.
- Safety reviewer: read-only review; found hidden index flags, pending Git
  operations, and stale worktree registrations. All three have regression tests.

The helper provides `start`, `status`, `ready`, and guarded `remove`. It never
merges, rebases, commits, pushes, installs packages, copies local data/secrets,
deletes branches, or force-removes worktrees. Normal Git commands remain valid;
the helper is not a mandatory wrapper for commit grouping.

Start fetches main, refuses existing local/remote task branches and destinations,
creates a branch without an upstream to main, and records its base and handoff.
Status is read-only; ready refreshes main but explicitly is Git preflight only.
Removal requires exact confirmation and both local/remote main ancestry. Dirty,
ignored-data-bearing, unowned, locked, visibly active, hidden-index, and
in-progress-Git worktrees are retained. Committed branches are always retained.

## Verification

`node .agents/scripts/verify.mjs agents`: **38 passed, 0 failed, 0 skipped**.
This includes all 25 existing agent-tooling tests and 13 new worktree contracts.
Skill frontmatter and local links are validated by the infrastructure tests.

Real disposable repositories and bare origins exercise fresh bases, no upstream
to main, unchanged source work, secret/data isolation, collisions, partial setup,
stale registrations, Git preflight, CLI restrictions, safe successful removal,
preserved branches, hidden tracked edits, empty cherry-picks, index locks, ignored
data/caches, and active child-process preservation. No product remote is used by
the tests. The exact temporary fixtures are removed by their owning tests.

Local run evidence (not portable):
`.agents/runtime/runs/1789086578525-agents-1a574962/`.
No UI changed; application build, browser, and live-provider suites were not run.

## Local artifacts and next step

No app server or Store was started. The main review server was not touched.
This worktree has its own ignored `app/node_modules`, an ignored lockfile copied
from the primary checkout to reuse exact cached dependency versions, and ignored
verification logs. No dependencies were added or caches symlinked. Those artifacts
must be deliberately handled before any eventual worktree cleanup.

Publish the reviewed task commit to `origin/work/agent-worktrees`, then report
the SHA and verification to the user. Main integration is the next separately
authorized action: refresh its target, inspect any intervening changes, and rerun
the agent suite on the combined candidate. Do not infer merge permission from
this implementation handoff or from the helper's Git readiness report.
