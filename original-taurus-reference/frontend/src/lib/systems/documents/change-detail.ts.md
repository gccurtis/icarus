# `change-detail.ts`

Reconstructs a change set's **before/after** text. This module exists because Omega will not tell us
what a document said before an edit.

## Why reconstruction is necessary at all

`GET /documents/:id/history/:changeSetID` returns the change set's forward ops, which carry the
**new** text and nothing else. The prior value is computed and stored — the change set's
`InverseOps` is exactly it — but the field is deliberately withheld:

```go
// InverseOps is the server-computed compensation stored with this revision.
// It is private persistence state used by undo, not part of the public response.
InverseOps []ChangeOp `json:"-"`
```

An earlier version of this code coped by showing only the result, labelled "Result". That was
honest and useless: a reader cannot tell what changed from the new value alone. So the client
recovers the old value the one way it can — **an atom's text before change set N is whatever the
most recent change set older than N set it to** — by walking history backwards.

Exposing `inverseOps`, or a derived `before`, would delete this whole module. It is asked for in
[`resource-access-enforcement.md`](../../../../docs/backend-requests/resource-access-enforcement.md).

## The walk, and its budget

```ts
for (const olderId of olderChangeSetIds.slice(0, LOOKBACK_BUDGET)) {
  if (prior.size === wanted.length) break;
  …
}
```

Each hop is a request, so it is bounded at `LOOKBACK_BUDGET` (12) and stops the moment every edited
atom is accounted for. In practice the previous edit to the same atom is a hop or two back, because
that is what typing looks like — the editor flushes a change set every few keystrokes against the
same atom.

A fetch that fails mid-walk is skipped rather than aborting: a pruned change set costs recall, not
correctness. When an atom is never found, `priorUnknown` is set and the UI says the earlier text is
older than the retained history — which is a different statement from "there was nothing there".

Callers pass `olderChangeSetIds` themselves, newest-first, because they already hold the history
page; making this module re-read it would double the requests.

## `atomTextInOp` — two ways text is established

```ts
if (op.atomId === atomId && op.setText !== undefined) return op.setText;
if (op.atom?.id === atomId) return op.atom.text ?? '';
for (const atom of op.block?.atoms ?? []) …
for (const block of op.row?.blocks ?? []) …
```

Not just `set_atom_text`. An atom's first text arrives inside the **insert** that created it — a new
row carries blocks, which carry atoms, each with its text. Missing that branch would make the first
edit after a paragraph was created look like it had no prior value, which is the single most common
case in a fresh document. The e2e covers exactly this path.

`setText !== undefined` rather than a truthiness check, throughout: clearing text to `''` is a real
edit, and treating it as falsy would silently drop it.

## `atomTextInChangeSet` scans backwards

A change set may write the same atom more than once. What matters to the *next* change set is the
value it ended on, so the scan runs from the last op to the first and returns the first hit.

## `describeChange`

Turns ops plus whatever prior text was recovered into two strings. Text edits become a quoted pair;
an empty prior value renders as `(empty)` rather than as unknown, because "was blank, now has text"
is a fact we have. Structural and formatting ops describe themselves on whichever side applies
(`row inserted` after, `formatting removed` before). Quoting truncates at 80 characters so one large
paste cannot flood an inspector panel.

It is pure, which is where the tests concentrate — `change-detail.test.ts` covers the insert-payload
branch, the empty-string cases, the backwards scan, and the `priorUnknown` flag.
