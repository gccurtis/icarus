# 0155 — Failures say why, everywhere

Phase 3 of the resilient-ingest design
([spec](../superpowers/specs/2026-07-29-resilient-ingest-design.md)), second half:
the sweep record 0154 deliberately left out, plus the last ad-hoc limit.

## A correction first

Record 0154 said nothing in the system set `endpoint.Response.Err`, and the design
doc's fourth defect said "zero handlers". **Both were wrong.** `chatErr` has set it
since `3350dc0` — record 0130, "make failures say why" — with a comment that gets the
reasoning exactly right:

> The client gets an opaque message; the cause travels to the request log, because a
> 500 with no recorded reason cannot be diagnosed afterwards.

So the practice was not missing. It was **isolated to one handler and never spread**,
which is a more useful thing to know: this phase generalizes record 0130's local
solution rather than inventing one. Both statements are corrected in place.

It also explains record 0121 more precisely than "nobody set the field" did. The
connector's handler simply was not the one handler that had figured this out, so an
intermittent 500 answered `{"error":"connector error"}` and the log held nothing
further.

## `endpoint.Fail`

One constructor: opaque body, attached cause.

The placement is the interesting decision. Adding the cause handler-by-handler would
have meant touching seventeen private, identical `errResp` helpers — and *deepening*
the duplication that made the field easy to forget in the first place. So the body
shape moved to `endpoint`, where the convention already effectively lived.

The repo has been here before and settled it the same way: every handler package used
to carry its own `canWrite(role) bool` copy, folded into `access.Role.CanWrite` on the
reasoning that a change to what "may write" means should not have to be repeated in
each of them, with one missed copy becoming a silent authorization gap. Identical
private copies across handler packages get one definition.

`map[string]any` rather than `map[string]string` so a body can be extended; both
serialize identically for string values, so **no response shape changed**. The
per-package `errResp` helpers stay for the genuinely causeless failures — a 403 for a
read-only role, a 501 for an unconfigured service — where there is no error to attach
and inventing one would be noise.

## The sweep, and how it was made safe

Two tiers, and only one of them was worth doing now.

**Done: the 5xx sites.** 66 of them across 19 packages, plus 14 sentinel-mapping
helpers. This is where an operator was actually blind — a 500 saying "could not list
documents" and nothing else.

**Deferred: the ~54 bind-error sites.** Those are 400s where the client is already
told what is wrong in the message, so the log's marginal value is small. Not worth a
uniform edit across every handler today.

The 5xx conversion was a mechanical `sed` over a uniform pattern, which is exactly the
shape of change that goes wrong quietly. Three things made it safe:

1. **HEAD was clean and pushed** (`79ee190`) before the edit, so the rollback point was
   the commit boundary.
2. **The compiler was the correctness gate.** The transformation appends `err` to each
   call, so any site where `err` was not in scope, or was shadowed, fails to compile.
   It compiled on the first run — which is the proof that all 66 sites genuinely had
   the cause in hand and were discarding it.
3. **The diff was reviewed before committing**, not after.

## The last ad-hoc limit

`workspace.ErrTooLarge` (64KB of cockpit state) now carries `CodeStateTooLarge`, the
cap and the actual size, via the same `stateLimit` wrapper shape as `file.sizeLimit`
— `Is` for the sentinel, `Unwrap` so `errors.As` can reach the limit.

The numbers matter here for a specific reason: a cockpit told its state is 70KB
against a 64KB cap can shed panels and retry, while one told only "too large" can only
retry the same payload forever.

`Unwrap` was written from the start this time. Record 0154 records why — omitting it in
`file.sizeLimit` produced a value that printed like a limit while `errors.As` could not
find it, and only a test asserting both identities together caught it. The workspace
test asserts both for the same reason.

With this, every bound in the system speaks one shape.

## Gates

Full suite green, companions and format clean. The workspace test now asserts the
sentinel and the arithmetic together.

Worth being honest about what is *not* verified: 66 of these edits are covered only by
compilation and the existing suite, since no test asserted on a 500's log line before
and none does now. The behaviour change is confined to a field that was previously
always nil, so the risk is low, but "the tests pass" is a weaker statement here than
usual.
