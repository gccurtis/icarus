# 0123 — Live-suite repairs, and what the runs cost

Running the full intelligence group (`./dev-test/run.sh intelligence`) end to
end — eight suites, every one against real providers — surfaced three distinct
failures: a production race ([0121](0121-connector-sync-race.md)), a scope
contamination ([0122](0122-scope-change-clears-prior-answer.md)), and two
problems in the suites themselves, fixed here. Telling them apart is the work:
a live failure is only worth its cost if it is diagnosed to the right layer.

## The prompt suite was two API generations stale

`dev-test/prompt/run.sh` failed 17 checks, starting with:

```text
POST /documents/<id>/changes
✗ expected status 201, got 400   {"error":"expectedRevision is required"}
```

The suite still sent the original `{"ops":[...]}` change payload. Document
changes have required `{"submissionId", "expectedRevision", "operations"}`
since revision-bound submissions landed (commit `0e6b3e6`, which predates this
whole review cycle) — the suite simply had not been run since. It now fetches
the document's current revision and submits each op through a `submit_op`
helper, the same pattern the live-document suite uses. All checks pass.

## The context-scope suite assumed the model never wobbles

Two of the suite's expectations are assertions about model judgment, and a
live model's judgment is sampled. Both wobble shapes showed up in this cycle:

- **Decline**: `"status":"insufficient"` on evidence that plainly answers the
  prompt (one conservative sample).
- **Paraphrase**: a correct, correctly-scoped answer — "the technology is wind
  technology" — that never names the invented identifier the assertion greps
  for.

Two aligned fixes. First, the instruction now asks for what the suite asserts:
"using the exact name the sources use for it" — the paraphrase failure was the
suite hoping for a wording it never requested. Second, `expect_scoped_answer`
grants exactly one retry when the model declines *or* paraphrases, then
asserts strictly: status `ok`, answer names the in-scope identifier, answer
never contains the out-of-scope one. That last assertion gets no grace on
either attempt — it is the scope-membership property itself, and a leak is a
leak. A single wobble no longer fails the suite; a systematic one still does.

The retry earned its place immediately: it is what turned "the model declined
once" into "the model declines *every time* at the swap step" — the
observation that unmasked the scope contamination fixed in
[0122](0122-scope-change-clears-prior-answer.md). A bounded retry is diagnosis
machinery, not failure-hiding: it separates sampling noise from the systematic
failures worth chasing.

## Provider transients get the same one bounded retry

A later verification run failed two suites inside a single provider-degraded
window: OpenRouter answered a literal "Reply with the single word: pong" check
with a 502 after 5.9 seconds, and minutes later the agent action's final
report was invalid twice in a row (the product's own tool-free re-ask,
[0124](0124-corrective-reask-for-invalid-reports.md), needs two bad samples to
fail — which a degraded provider supplies). Notably the action's *work* was
done: the effect assertions on the document all passed; only the settled state
was wrong.

The same policy now covers both: the `intelligence` suite retries a raw
provider call once when it 5xxes, and `live-document` retries the whole
action once, with a fresh action, when it settles `failed` (its effect
assertions tolerate the extra authored blocks). A provider that is actually
down, or an action that systematically fails, still fails the suite. Live
suites measure two things at once — our product and someone else's uptime —
and a bounded retry is what keeps one flake of the latter from reading as the
former.

## The runs and what they cost

| Run | Result |
| --- | --- |
| First full group | `prompt` 17 failures (stale suite, above) |
| Second full group | `context-scope` 500 — the race, [0121](0121-connector-sync-race.md) |
| Group ×2 after the race fix | run 1 all eight green; run 2 one `context-scope` decline |
| `context-scope` ×2 with the retry, before [0122](0122-scope-change-clears-prior-answer.md) | still failing — declines survive the retry (systematic, and one leaks the old-scope identifier) |
| `context-scope` ×3 after [0122](0122-scope-change-clears-prior-answer.md) | two green with no retry fired; one paraphrase (above) |
| `context-scope` ×3 with the aligned instruction | all green, no retry fired |
| Final full group over every change in 0121–0123 | all eight suites green |
| Group ×8 during streak verification | 6 green; one harness silent-exit (probe bug, above); one provider-degraded run (502 + twice-fumbled report) |
| **Fresh group ×8 on the final code** | **8 consecutive green** — 7 with no retry at all; run 5's action fumbled once and succeeded on its single bounded retry |

No 500 appeared anywhere after the race fix.

## The silent exits, root-caused

Twice in this cycle a suite died with no verdict at all — `connector-context`
once, `context-scope` once — always during watcher startup, never twice in a
row, never standalone. The cause was the watcher-address probe running under
`set -euo pipefail`:

```bash
addr="$(grep -oE 'listening ...' "$log" | head -n1 | awk '{print $2}')"
```

When the probe races the watcher's first print and greps a still-empty log,
`grep` exits 1, `pipefail` fails the pipeline, the assignment fails, and
`set -e` kills the whole script before the retry loop gets its second
iteration — silently, because the EXIT trap still runs cleanup. Whether a run
survived came down to whether a fresh Go process printed its first line before
bash finished three forks. The probe now ends in `|| true` in all four suites
that carry it (`connectors`, `connector-context`, `context-scope`,
`live-document`), so an empty log means "retry in 200ms," as the loop always
intended.

Total spend across every live run in this cycle: about **$0.03** — eight
suites, real plan/synthesize/embedding calls throughout. That bought one
production race no unit test could see, one scope contamination no unit test
could see, one suite brought back to the current API, and an honest accounting
of what a live model does and does not guarantee.
