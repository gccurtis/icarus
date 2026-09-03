# document

A document's body, and the change sets that move it.

Two procedures. `readDocumentBody` hands back the leader snapshot for one
document — a revision and a whole `DocumentBody` — or nothing, for a document
that has never been written to. `submitDocumentChanges` takes a change set and
either accepts it, returning the revision it became, or refuses it.

**Approval is application.** A change set is accepted when it was authored
against the revision the leader is actually at and every op in it resolves
against the body there. An op naming a row that is gone, or splicing text that
has since moved, is refused — so a caller that keeps its buffer on a rejection
loses nothing. Nothing partial is ever written: the body is rebuilt in full
before either row is touched.

**A refusal is an answer, not a throw.** `accepted: false` with `stale` or
`unresolved` and the revision the leader is actually at. A caller has to act on
that — keep its buffer, say so on screen, rebase — and an exception would make
it indistinguishable from a network failure, which needs the opposite handling.
Only a genuine fault throws.

The body never travels inbound. A caller sends what it did, not what it thinks
the result should be, which is what makes the precondition checkable at all.
