# 0122 — A scope change clears the prior-answer carryover

The second bug the live suites found, hiding behind the first. After the
connector race ([0121](0121-connector-sync-race.md)) was fixed, the
`context-scope` suite still failed intermittently — and what looked like model
noise turned out to be contextual contamination across a scope boundary.

## The symptom, and why it first looked like a flake

At the suite's swap step — rebind the report's variable from the solar document
to the wind document, refresh — the resolver would sometimes return
`"status":"insufficient"` instead of answering. Retrieval was correct every
time: the evidence contained only the wind source. One conservative sample from
a live model, plausibly.

So the suite gained a bounded retry
([0123](0123-live-suite-repairs.md)) — and the retry is what disproved the
flake theory. The model declined **again** on the re-resolve, in run after run,
and only ever at the swap step. A one-off sample doesn't survive a retry;
something systematic was biasing it. Then one refusal named names:

> "The EVIDENCE only describes the Borealis turbine, a wind technology, but
> does not mention any solar technology or a **Zephyrite reactor**."

Zephyrite is the *solar* document's invented identifier. The evidence contained
only the wind source — the old scope's identifier had reached the model through
some channel other than retrieval.

## The cause

The synthesis prompt deliberately includes the block's previous answer
(`PromptData.LastOutput`) as a PRIOR ANSWER, a formatting draft: when a
*source* changes under the same scope, the model keeps the wording and updates
the facts, so a changed source propagates instead of reading as a
contradiction. That mechanism is right, and stays.

But `set_block_context` cleared only `ResolvedAt`. The carryover survived, so
the next resolution received a prior answer synthesized from a **different
source set**. The model saw a draft naming Zephyrite, evidence naming only
Borealis, and — despite the system prompt's instruction to judge from evidence
alone — a weak model reads that mismatch as "the evidence doesn't support the
expected answer" and declines, sometimes echoing the out-of-scope identifier
into its refusal.

That second part makes this more than a quality problem: the per-block scope
model says resolution is restricted to includes − excludes, and here content
from outside that scope influenced — and leaked into — the block's output.

## The fix

`set_block_context` now clears `LastInstruction` and `LastOutput` along with
`ResolvedAt`: a prior answer from a different scope is not a valid draft for
the new one, so the next resolution starts clean (the template renders
`(none)`, the never-resolved form). `set_prompt` keeps the carryover — same
scope, new question — which is exactly what the PRIOR PROMPT / CURRENT PROMPT
format comparison exists for.

Undo needed no change: the op's inverse already restores the entire prior
block, carryover included. The op comment, the apply-site comment, and the
prompt-resolution workflow doc now state the boundary.

## Test

`TestApplySetBlockContextClearsPriorAnswerCarryover`, written first and watched
fail on the uncleared carryover: applying `set_block_context` to a resolved
prompt block must empty `LastInstruction`/`LastOutput`, and applying the
generated inverse must restore both. Live confirmation — the swap step
resolving cleanly with no retry — is recorded with the run evidence in
[0123](0123-live-suite-repairs.md).
