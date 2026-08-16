# Change conflict checks

How an incoming [change set](../data-models/revisions/change-set.md) is decided
against the ones that landed while its author was not looking.

The whole procedure answers one question — **does anything that happened since
`baseRevision` interfere with what this change does?** — and the answer is
either *apply it unmodified* or *reject it*.

## Nothing is transformed

**Structural** transformation is gone. Ordering ops [address positions by
id](../data-models/revisions/change-set.md#the-same-five-ops-serve-all-three-resources),
so no path is ever rewritten and nothing is renumbered.

What remains is **offset shifting inside a single string** — small enough to
specify completely, and specified [below](#shifting-offsets). It applies in
exactly two places, a `text` op's `at` and a mark's `from`/`to`, and both use one
function.

Worth keeping rather than rejecting on, because it is what lets two people type
into the same paragraph without either losing a keystroke, and that is the most
common form of collaboration there is.

## The ladder

Checks run cheapest-first. Steps 2 and 3 can only reject; step 4 may shift.
Reaching the bottom means applying.

```text
0.  B == C ?                          → apply
1.  load intervening sets (B, C]      → none? apply
2.  touched ∩ touched ≠ ∅,
      excluding same-string pairs ?   → reject
3.  any removal covering my path ?    → reject
4.  not plainly literal-on-literal ?  → reject
    overlapping ranges ?              → reject
    otherwise shift offsets           → apply shifted
5.                                      apply unmodified
```

Three of the four checks reject. Only step 4 produces a modified change, and it
does so only after refusing everything it is not certain about.

### 0 — Nothing happened

`baseRevision` equals the current revision. Append at `C + 1`. The overwhelming
majority of edits take this exit, because most editing is one person at a time.

### 1 — Load the window

Read the change sets in `(B, C]` — an [indexed range
scan](../storage/general-resources.md#reading-the-current-body), bounded by the
consolidation interval. If `B` is older than the retained window the change is
rejected outright, because the sets needed to evaluate it are gone and assuming
safety would be guessing.

### 2 — Identity intersection

Every set carries `touched`: the deepest id each of its ops addresses. Intersect
the union of the window's `touched` with the incoming set's.

Non-empty means two changes reached for the same thing, and it is rejected —
**except** where both are string-offset ops on the same atom or block, which
[step 4](#4--shifting-offsets) transforms instead.

This is the check that resolves nearly everything, and it is a set operation over
short string lists — no path parsing, no body access. Deepest ids only, because
including ancestors would make every pair of edits inside one paragraph look like
a collision.

### 3 — Removal containment

Identity misses one relationship: an intervening set that removed `#b7x2` touches
`#b7x2`, while a change editing `#b7x2/atoms/#a91` touches `#a91`. They do not
intersect, and the edit is plainly invalid — its block is gone.

So: for each intervening op with `op: "remove"`, test whether any removed id
appears anywhere in an incoming op's path. Removal covers its whole subtree, and
a path is a string, so this is a substring or prefix test.

Only `remove` ops are scanned, and they are rare, so this costs almost nothing in
the common case.

### 4 — Shifting offsets

Two things measure positions in a string, and an intervening `text` op moves
both:

- another `text` op on the **same atom** — its `at` is now wrong
- a `mark` op on **any atom in the same block**, since
  [marks index the block's whole display
  string](../data-models/content/content-block.md#marks-index-the-display-string)

Step 2 defers these pairs rather than rejecting them — but only some of them are
actually transformable.

#### The precondition: reject unless it is plainly text on text

Shifting is correct only when **every intervening op that moved the string moved
it by a known amount**. If anything in the window changed the string's length in
a way the ops do not state, the delta cannot be computed and the shift would be
guessing.

So before shifting, every intervening op affecting the same block must be a
`text` op on a **literal** atom. If any of these appear instead, reject:

| Intervening op | Why it disqualifies |
| --- | --- |
| a formula atom re-resolved | `resolved` changed length by an amount nothing in the op states |
| a formula's `expression` set | it may re-resolve, changing display unpredictably |
| an atom inserted or removed | display changed by that atom's whole length |
| the block `set` wholesale | the old string is gone; offsets mean nothing |

`text` ops only ever target **literal** atoms. A formula's expression is replaced
with `set`, never edited with `text` — expressions are short, and the rule
removes an entire category of case from this precondition.

This is what keeps the risk bounded. The shift runs on one narrow, fully
specified situation — literal text edited concurrently with literal text — and
everything else takes the same reject path as any other conflict.

#### Shifting offsets

For an intervening text op `A` and any offset `p` measured against the string
before `A` was applied:

```text
aStart = A.at
aEnd   = A.at + A.remove.length
delta  = A.insert.length - A.remove.length

shift(p) =
    p >= aEnd     →  p + delta        // after the replaced range
    p <= aStart   →  p                // before it
    otherwise     →  CONFLICT         // strictly inside it
```

Apply `shift` to the incoming op's offsets — a `text` op's `at`, or a mark's
`from` and `to` independently. With several intervening text ops, apply them in
revision order, each against the result of the last.

That is the whole transformation.

#### Why it is correct

**A mark spanning the edit grows with it.** `from <= aStart` stays, `to >= aEnd`
shifts, so bolded text someone types into the middle of stays bolded — which is
what anyone would expect.

**A mark entirely inside replaced text conflicts.** Both offsets fall strictly
inside, so both hit `CONFLICT`. Correct: the text it marked no longer exists.

**Equal offsets are deterministic.** Two pure inserts at the same point have
`aStart == aEnd == p`, so `p >= aEnd` holds and the incoming one shifts. The
already-committed edit keeps the position and the later one lands after it —
stable, and independent of arrival order.

**Overlapping replacements conflict.** If both edits replace overlapping ranges,
the incoming offset falls strictly inside, and merging would produce text neither
person wrote. Rejecting is the only honest answer.

#### Why this one step needs care

Every other check in the ladder **fails closed** — in doubt, it rejects, and the
worst outcome is someone resubmitting. This one produces a result, so a bug here
puts characters in the wrong order with no error raised and nothing to notice.

The precondition is what keeps that bounded: the shift only runs on literal text
against literal text, and every case that is not obviously safe is routed to
rejection instead. Correctness only has to hold for one narrow situation rather
than for everything that might arrive.

Within that situation it still wants direct tests over the case table above —
spanning marks, contained marks, equal offsets, overlapping replacements, and
multi-op accumulation — and offsets must be UTF-16 throughout, matching
JavaScript string slicing, so a surrogate pair is never split by an off-by-one.

### 5 — Apply

Nothing objected. The change is appended at `C + 1`, shifted if step 4 shifted it
and exactly as authored otherwise.

## Marks shift when text applies

Separately from rebasing: when the server **applies** a text op, it shifts every
mark in that block by the same `shift` function.

Marks are therefore never carried in a change set alongside a text edit. An
earlier draft bundled a whole-array marks `set` with every text op so the two
stayed consistent — which meant rebasing a text op also meant rewriting that
payload, and that was the genuinely fiddly part.

Making the shift a consequence of applying the op removes it. One function,
called in two places: once when applying, once when rebasing.

## Why this order

Each step is more expensive and less likely to fire than the one above it.

Step 2 is a set intersection over data already in memory. Step 3 touches only
removal ops. Step 4 touches only mark and text ops and only compares blocks. None
of them reads the body, and none resolves a path against anything.

Running them in the other order would mean doing the narrow, structural work on
every change to catch cases the cheap test would have caught first.

## Worked cases

**Two people in different paragraphs.** A edits `#a41`, B edits `#a91`. Disjoint
`touched`, no removals, no marks. Step 5. Both land.

**Two people in one paragraph, different runs.** A edits the literal before a
formula, B the literal after it. Different atom ids, so still step 5.

**Two people in the same run, apart.** Both edit `#a91` — A at offset 4, B at
offset 40. Step 2 defers to step 4, which shifts B by A's delta. Both land.

**Two people in the same run, overlapping.** Both replace text covering offset
12. Step 4 finds B's offset strictly inside A's replaced range and rejects.

**Bolding while someone types.** A adds a mark to `#b7x2`; B types into `#a91`
inside that block. Step 4 shifts A's mark offsets past B's edit. Both land, and
the mark still covers the words it was put on.

**Typing near a formula that re-resolved.** A types into `#a91`; meanwhile the
formula atom beside it resolved to a longer value. The precondition fails — the
display moved by an amount no op states — so A is rejected and resubmits against
the resolved text.

**Bolding two different phrases.** A marks `#m03`, B marks `#m07`, no text
changed. Nothing at any step. Both land — two people can format one paragraph
simultaneously.

**Deleting under an edit.** A removes row `#r4m1`; B edits a block inside it.
Step 2 passes — different ids. Step 3 rejects.

**Inserting after the same row.** Both insert after `#r4m1`. `touched` holds the
new ids, which differ, so step 2 passes and both land. Their order is settled by
revision.

## Rejection is cheap

A rejected change costs one round trip: the client re-reads at `C`, reapplies its
pending edits to the new state, and resubmits. It does not lose work, because the
edits are still in the client's buffer.

The lever if rejections turn out to be common is
[`flushAfterOps` and `flushAfterMs`](../../app/configuration/revisions.yaml) —
smaller change sets touch fewer ids, collide less, and lose less when they do.
Partial acceptance is deliberately not that lever: half an applied change is a
state nobody authored, which is what this whole procedure exists to prevent.

## Related

[change set](../data-models/revisions/change-set.md) ·
[revisions](../data-models/revisions/README.md) ·
[general resources in Convex](../storage/general-resources.md)
