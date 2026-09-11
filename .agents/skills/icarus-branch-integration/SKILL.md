---
name: icarus-branch-integration
description: Set up an Icarus task worktree or evaluate and integrate a feature workbranch against its intended base, separating textual conflicts from semantic and architectural risks and verifying the combined tree. Evaluation alone remains read-only; main integration requires explicit authorization.
---

# Icarus branch integration

Read root `AGENTS.md`, the current request, and the worker's handoff. Establish
whether this task is setup/implementation, evaluation, or authorized integration.
Apply root decision boundaries: scoped task-branch commits/pushes are permitted
for implementation, not evaluation; rewriting history or merging/pushing `main`
needs explicit task authority. A worker's green report is useful evidence, not
certification of the current combined tree.

## Establish or reuse the task worktree

Read-only evaluation can stay in the current checkout. For implementation, reuse
the assigned worktree or create an owned `work/<task>` from current `origin/main`:

```sh
node .agents/scripts/worktree.mjs start my-task
```

Run it from an existing checkout; move to the reported worktree before editing.
Use `--path <absolute>` for a chosen destination. Inspect an existing branch or
destination (including a task branch already on origin) rather than replacing it,
and do not recreate a worktree each turn.
The helper records the starting SHA in `.agents/tasks/<task>/worktree.json` and
creates a handoff. Keep that historical base distinct from the latest target SHA.
Setup never copies secrets/data/caches or installs dependencies; do not share
`node_modules` by symlink. Reuse the existing dev/verify helpers inside the new
worktree. One lead coordinates shared Git metadata and integration.

For ordinary commits, stage exact owned paths, review the staged diff, and publish
the task branch with an explicit destination when verified:
`git push -u origin HEAD:refs/heads/work/<task>`. Raw Git remains appropriate; no
helper or additional approval ceremony is required for routine task-branch work.

## Establish the exact trees

Use the status helper and read-only Git checks to identify worktree ownership,
dirty files, intended target, source branch/head, tracking refs, and merge base.
Confirm the actual source SHA rather than resolving a misspelled branch by guess.
If remote freshness matters, fetch the specifically relevant remote/refs without
changing checked-out files; report inability to verify them.

`worktree.mjs status [--path <registered-worktree>]` reports the selected checkout.
`worktree.mjs ready [--path <registered-worktree>]` fetches `origin/main` and reports
Git preflight against it. Read the reported checks; readiness is neither test
certification nor authorization to integrate.

Inspect both the branch-only changes since the merge base and target changes
since that base. Record commit IDs in the handoff. A branch that is not based on
current main needs that called out explicitly; it is not automatically broken.
Treat unrelated dirty work as unavailable for integration, not cleanup material.

## Separate three kinds of work

1. Textual conflicts: paths/hunks whose resolution needs a choice between edits.
2. Semantic conflicts or feature defects: code that merges but violates shared
   types, ownership, lifecycle, transaction, interaction, or current-schema rules.
3. Integration follow-up: missing wiring such as resource creation or opening.
   Do not label every unfinished feature a merge conflict.

Inspect shared representation, capabilities, workspace/runtime lifetime, global
UI primitives/tokens, browser harnesses, and checker/baseline changes when the
diff touches them. These can affect sibling features even if the branch was
named for one editor. Check removed exports and renamed paths against real
consumers. Do not preserve obsolete APIs or schemas as compatibility bridges.

For each material risk, report a concrete path and behavior, consequence,
recommended resolution, owner, and acceptance check. Distinguish verified
findings from hypotheses. Use the editor or Store workflow only where the
changed boundary requires that additional depth.

## Integrate only when authorized

Agree exact owned paths and a single integration owner when worker and lead
changes must land in sequence. Give a worker the target SHA, expected scope,
remaining actions, and verification contract; do not send a vague instruction
to make every check green.

Before a requested rewrite or merge, ensure relevant work is committed or
otherwise safely isolated and preserve an explicit recoverable source reference
where history will be rewritten. Do not reset, stash, or stage somebody else's
changes. Resolve each conflict against the intended behavior of both branches;
neither blanket side selection nor carrying baseline fingerprints forward proves
correctness. Stop for unresolved product/authority choices, not ordinary conflicts
whose desired result is established.

## Certify the resulting tree

Use an owned worktree/server/Store and the root verification helpers. Verify the
combined candidate, not only its parents: focused regression contracts, typecheck,
architecture and mutation/script checks, unit tests, production build, and
Chromium workflows appropriate to the scope. Inspect rendered states when UI or
fixtures change. Report provider skips separately from passes.

Compare the final diff to the intended target: expected feature scope, current
names/schemas, no compatibility shims, no accidental data/log files, and no new
baseline debt. Confirm the source and target SHAs still match what was verified
before publication; if either moved, reevaluate the changed boundary.

The handoff should name the final head and base, integrated commits, commands and
results, unresolved risks, review server/data ownership, and commit/push state.
If the request was evaluation only, finish with a merge recommendation and a
bounded worker/lead action list; leave branches and product files unchanged.

## Clean up only after approved integration

Stop only task-owned processes and inspect local artifacts before cleanup. Use
`node .agents/scripts/worktree.mjs remove <task> --confirm <task>` from a surviving
checkout. The helper requires the clean task head to be merged into both local
and freshly fetched `origin/main`, no Git/worktree leases or visible processes
rooted there, no pending Git operations or hidden index flags, and no
ignored/untracked data. It never force-removes or deletes the branch.
Do not bypass a refusal: retain the worktree until its exact owned artifacts and
processes are safely handled. Never delete another agent's data to make it pass.
