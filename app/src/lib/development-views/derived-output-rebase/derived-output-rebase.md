# Derived-output rebase reference

This development view records a disposable rebase audit of
`work/derived-output-architecture` at `2c0bcad` onto `main` at `3e670c5`.
It is deliberately a served reference rather than a static report: the branch
topology, conflict chain, checker reduction and execution gates are easier to
verify as separate visual surfaces, and the active Helios/Selene appearance is
part of that proof.

## Safety boundary

The audit was performed in a disposable clone. Creating this reference did not
rebase the source branch. If either audited head moves, the replay must be run
again and the facts in `procedures/audit.ts` recertified before the operational
runbook is used.

## Pages

- `Readiness` answers whether the operation is understood and shows the exact
  branch heads, divergence, stop count, diagnostic reduction and recommendation.
- `Replay map` is the conflict procedure. It records all 39 commits, the seven
  stop commits, all 22 conflict occurrences, the 21 unique paths and the
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

## Updating the reference

Never edit a headline count alone. Repeat the disposable replay, update the
underlying conflict/finding ledger, and then change `audit.ts`. A page that says
the architecture suite is clean must be backed by a run of the resulting tree,
not inferred from either parent branch.
