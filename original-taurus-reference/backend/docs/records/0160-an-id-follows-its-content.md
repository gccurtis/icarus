# 0160 — An id follows its content

Window ids were 16 bytes of `crypto/rand`. Both frontier queries order by id, and
the sparse path's threshold sample draws pairs **by index** under a fixed seed — so
the same seed selected the same positions holding different vectors. A fresh
ingest of identical content pinned a different threshold, formed different
cliques, and produced a different lattice.

Measured on the 596-file corpus, byte-identical code, two runs:

| | run A | run B |
| --- | --- | --- |
| pinned threshold | 0.563 | 0.564 |
| corpus nodes | 172 | 205 |

Clustering was always a pure function of its inputs, exactly as record 0141 says.
One of its inputs arrived shuffled.

## What is derived now

- `localRefID(projectID, sourceType, sourceID)` — the triple is already unique
  (`UNIQUE(project_id, source_type, source_id)`), so deriving costs nothing and
  buys reproducibility. The project is in the hash: identical content in two
  projects stays two sources, because a project is an access boundary.
- `windowID(localRefID, occurrence, text)` — the window's text, and which
  occurrence of that text it is within its source.
- `connector.FileKeyID(key)` — the per-file half of a connector source id, hashed
  from the provider's key. This was the last random input feeding a source
  identity, and without it the derivations above were reproducible from a random
  starting point.

Node ids were already content-addressed (record 0140) from their members' ids, so
they inherited the randomness and now inherit the determinism.

Existing rows keep their random local refs: rewriting one would orphan every
window, node and resolved citation pointing at it. Only new sources get derived
ids, which is enough for what derivation is for — a *fresh* ingest is
reproducible, and cross-database reproducibility was never a property an existing
row could have.

## Why text-and-occurrence, and not the ordinal

The ordinal is the obvious key and it is worse than the random ids it would
replace. Prepending a paragraph shifts every ordinal, so every id after an edit
churns — and a churned id is a re-clustered subtree plus a dropped corpus
reference for content that did not change.

Occurrence-among-identical-texts reproduces exactly what `planAdd`'s `priorIDs`
queue did by lookup: three identical windows becoming four means the first three
keep their ids and the fourth is new. **That queue is deleted.** Inheritance is
what the hash *is*, rather than machinery that reconstructs it — one reuse map
now, keyed on text, for vectors alone.

## The gate, and the hole falsification found in it

`deterministic_ids_test.go` pins: identical content → identical ids at both
tiers; ingest order irrelevant; duplicate text still distinct ids; identical
content in two sources or two projects never shares an id; and the 32-hex shape
`encodeEdges` requires.

Falsifying it three ways found that **one of those tests was decoration**.
Reverting to `newID()` failed the reproducibility tests, and dropping the
occurrence index failed the primary-key test — but keying on the *ordinal*
**passed everything**, including the test written specifically to catch it.

The reason is worth recording. `TestPrependingLeavesLaterWindowIDsAlone` asks "did
ids survive the edit?", and ordinal-keyed ids survive *every* edit — ordinals do
not move. It is the perfect score that gives it away. The property that actually
matters is the converse: **wherever an id survives, the text under it must be
byte-identical.** Under ordinal keying, window 3 keeps its id while its content is
replaced, and the corpus tier goes on citing member ids whose text changed
underneath them — record 0140's failure reached from the opposite direction, and
silent.

`TestAnIDNeverOutlivesItsText` is that assertion, and it fails immediately under
ordinal keying. Two of the three gates here were sound; the third had to be
attacked before it was worth anything.
