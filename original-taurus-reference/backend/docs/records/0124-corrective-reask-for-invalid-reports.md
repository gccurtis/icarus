# 0124 — A fumbled report must not discard completed work

The third product finding from the live runs
([0123](0123-live-suite-repairs.md)): during the consecutive-clean verification
runs the user asked for, one `live-document` run failed with

```text
✗ agent action state = failed
failure: "agent ask: invalid structured model output"
```

## What actually happened

The agent action had already done its work — the tool loop ran, the prompt
blocks were created, the resolves were enqueued. Then the model's **final
ExecutionReport** failed semantic validation (the report referenced a tool
call that never ran). `isInfrastructureError` classifies
`ErrInvalidModelOutput` as a business error — correctly, because re-running
the whole action through the job queue would replay tool side effects and
duplicate the work. So the task settled as failed on attempt one, discarding
an action whose effects were real and, as far as the tools report, successful.

That is the wrong failure for a sampled model. A semantically invalid report
is transient model behavior with a high chance of succeeding on a second
sample — but the retry must not re-execute anything.

## The fix: one tool-free corrective re-ask

When the report fails to decode or validate, `finishAction` now makes exactly
one more model call — with **no tools bound**, so no side effect can run
twice — handing the model the executed tool calls (the only valid
`toolCallId` values, each with its `ok` status), the rejected draft, and the
validation error, and asking for corrected paperwork for the same
already-completed work. The corrected report goes through the same
validation; a second invalid report fails the task exactly as before. The
extra call's tokens are added to the run's answer usage, so the cost stays
visible.

Job-level retry was considered and rejected for actions: the queue's retry
re-runs `RunJob` from the top, and an action's tool loop is not idempotent.
The plan path is left as is — a plan has no side effects to protect, and a
failed plan can simply be run again.

## Test

Two tests, written first and watched fail:

- `TestActionRecoversFromInvalidReportWithOneReask` — the tool loop's report
  references a ghost tool call; the corrective re-ask returns a valid report;
  the task must complete, the corrective request must carry the real executed
  `toolCallId`, and the extra tokens must appear on the run's usage.
- `TestActionFailsWhenReaskedReportIsStillInvalid` — the re-ask returns the
  same invalid report; the task must fail, and exactly one re-ask must have
  been made (the retry is bounded).
