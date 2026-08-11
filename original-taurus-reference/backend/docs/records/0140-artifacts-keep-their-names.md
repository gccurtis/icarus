# 0140 — Artifacts keep their names

Every add minted a fresh id for every window; every rebuild minted a fresh id for
every node. So a one-character edit to a document replaced the identity of every
artifact in it, and a corpus rebuild over an unmoved frontier replaced the whole
tier.

That is tolerable while a full rebuild is the only way to maintain the lattice.
It is fatal to anything incremental: the first question an incremental scheme
asks is "what changed?", and the honest answer was "everything".

## Window ids: reuse, don't mint

`planAdd` already built a map from old window text to its stored vector — the
smart-update path that makes an append re-embed only its tail. It now carries the
old window's **id** as well.

The subtlety is that ids and vectors cannot be reused under the same rule:

- A **vector** is a pure function of its text and the model, so any number of new
  windows may share one.
- An **id** is a primary key, so each prior one may be claimed at most once.

So there are two maps. `reuse` is a plain text → vector map; `priorIDs` is a
*queue* per text, popped as windows claim it.

Getting this wrong is not subtle in its consequences. A document containing the
same paragraph three times produces three windows with byte-identical text.
Reusing ids by text alone would hand all three the same id — a primary-key
collision, and two windows silently lost. With the queue, three prior windows
serve at most three new ones and a fourth copy gets a fresh id, while all four
share the single embedding.

## Node ids: content-address them

```go
nodeID(projectID, localRefID, level, memberIDs) = sha256(...)[:16]
```

A node is nothing but a clique's representative, so two clusterings that find the
same clique should produce the same node. Deriving the id from the member set
makes that true by construction — no lookup, no reconciliation, no state to keep
in step. Stability falls out of the definition rather than being maintained.

Two details carry weight:

**Members are sorted for hashing only.** `MemberIDs` keeps its own order, which
is the order membership edges are written in, but a set is a set — the same
clique discovered in a different order is the same node.

**Fields are length-prefixed.** Without it `("ab", "c")` and `("a", "bc")` hash
alike, so a project id ending in the bytes a local ref begins with would collide.
`TestNodeIDFieldsCannotRunTogether` pins it.

The digest is truncated to 16 bytes so ids keep the same 32-hex-character shape
`newID` produces; nothing downstream can tell a derived id from a minted one.

## A test that was measuring the wrong thing

The first version of the corpus-stability test added a third document between two
rebuilds and asserted the corpus node ids survived. It failed — correctly. Adding
a source changes the frontier, which changes the corpus clique's member set,
which changes its id. That is the content address working, not breaking.

Rewritten to assert what was actually meant: appending to a source leaves the
node ids of the clusters it did not touch alone.

`TestAscendDeterministic` was also extended. It compared node *shape* across two
runs but not ids — which was the right test when ids were random and is a hole
now that they are derived.

## What this unblocks

An incremental scheme can now ask what changed and get a useful answer: unchanged
windows keep their ids, so cliques over them keep theirs, so a diff against the
stored lattice is meaningful. That is the precondition for repairing the graph
locally rather than rebuilding it — which is what the k-NN work needs.
