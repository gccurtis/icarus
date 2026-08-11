# End-to-end live-document demo (live-document Slice I)

The final slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-live-document-demo.md`](../superpowers/plans/2026-07-26-live-document-demo.md)).
One terminal run that exercises Slices A–H against a live server and proves every
acceptance criterion — the integration gate and the demo runbook.

## What it is

`dev-test/live-document/run.sh` (walkthrough in `manual.md`): a document that is
mostly a prompt block, fed by connector-backed context variables, that resolves
scoped, flips on a variable swap, refreshes on its own when the external folder
changes (system-attributed), scopes exactly including exclude, and is extended by
the AI quarterback into live prompt blocks it authors and resolves. It is
model-backed, so it **skips without an OpenRouter key** and **reports its token
cost** (a full run is ~5k tokens, < $0.002). Assertions target scope membership
(which source's fact appears), not model wording. No production code — this is
the proof.

## Criteria proved

1–2. Connector create + sync (two watchers, distinguishable content). •
3. External folder change → the block re-resolves on its own, and the edit is in
Activity attributed to the **system** actor. •
4. Swapping the block's bound context variable flips its output. •
5. Include-both-minus-one (exclude) yields exactly the finance source. •
6. An Action task has the quarterback author and resolve new finance-scoped
prompt blocks.

## Bugs the live run caught (fixed)

Running against real models — never a stub — surfaced defects unit tests missed:

- **`validateBlockContext` rejected include+exclude of the same name**, which is
  the primary exclude use case; relaxed (see the Slice E fix commit).
- **`DependentPrompts` scanned `List()`**, whose base omits pending change sets,
  so a just-edited block's context was invisible and the cascade found no
  dependents; it now `Get`s each document so pending ops are folded in (Slice F
  fix commit). This was the root cause of the auto-refresh not firing.
- Dev-test harness lessons folded in across the live suites: `/changes` requires
  a `submissionId`; a helper must redirect `request`'s logging before capturing
  `$LAST_BODY` in a command substitution; the agent's reasoning cast
  (`general/medium/...`) needs a route in the test config.

## Settled

- The whole program works end to end against real intelligence, with cost
  surfaced. ✓
- Parked (spec non-goals): the frontend "updating in progress" hold-state UX and
  continuous no-viewer polling cadence.
