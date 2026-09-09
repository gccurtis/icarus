# Derived-output rebase reference

This development view records a disposable rebase audit of
`work/derived-output-architecture` at `bef7239` onto `main` at `06708d9`.
It is deliberately a served reference rather than a static report: the branch
topology, conflict chain, checker reduction and execution gates are easier to
verify as separate visual surfaces, and the active Helios/Selene appearance is
part of that proof.

## Safety boundary

The audit was performed in a disposable clone. Creating this reference did not
rebase the source branch. If either audited head moves, the replay must be run
again and the facts in `procedures/audit.ts` recertified before the operational
runbook is used. The reference-update commit after `bef7239` changes audit data
only; any later product commit invalidates the source certification.

## Pages

- `Readiness` answers whether the operation is understood and shows the exact
  branch heads, divergence, stop count, diagnostic reduction and recommendation.
- `Replay map` is the conflict procedure. It records all 40 audited commits, the
  eight stop commits, all 28 conflict occurrences, the 26 unique paths and the
  behavioral resolution for every cluster.
- `Checker map` distinguishes architecture debt, type diagnostics, import-blocked
  test files, script ratchet drift and whitespace findings. It records the four
  root implementation repairs instead of presenting cascades as separate bugs.
- `Runbook` is the executable operation: eight gated phases, commands, rollback
  points, commit slicing and final acceptance criteria.

## Source organization

- `procedures/audit.ts` owns immutable audit identity and headline counts.
- `procedures/commits.ts` owns the complete replay order.
- `procedures/conflicts.ts` owns conflict decisions and their proof obligations.
- `procedures/findings.ts` owns checker/test classification.
- `procedures/runbook.ts` owns the future mutation procedure and acceptance gates.
- `procedures/diagrams.ts` owns Mermaid source only.
- Page components compose those records without changing them.
- `reference.css` uses only project semantic tokens, so both appearances remain
  legible without page-specific color overrides.

## Audit commands

The disposable trial established divergence from merge base `8ba102e`, replayed
all source commits, recorded each unmerged path, then ran architecture lint,
typecheck, script tests, Vitest and `git diff --check`. Temporary conflict
resolutions were sufficient to prove the plan; compatibility fixes were not
made in the source branch as part of this audit.

The recertified replay found 18 type diagnostics in 7 files, reducible to 4
repairs. Architecture lint initially reported 26 stale records plus 2 validity
echoes; removing those exact records produced 90/90 clean checks with 259 live
baseline records. Vitest discovered 166 files: 138 passed, 27 were blocked at
module import, and 1 was skipped; 1,148 assertions already pass. The pinned
script suite has 165 tests, with only the 2 stale baseline-count assertions
failing. Patch hygiene reports 315 findings in one generated artifact.

## Updating the reference

Never edit a headline count alone. Repeat the disposable replay, update the
underlying conflict/finding ledger, and then change `audit.ts`. A page that says
the architecture suite is clean must be backed by a run of the resulting tree,
not inferred from either parent branch.
