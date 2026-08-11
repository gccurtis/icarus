# 0135 — A sync should cost what changed

`Knowledge.Add` had no early-out. Re-adding a source with byte-identical content
re-windowed it, minted a fresh id for every window, re-ran the ascent, and
rebuilt the project's corpus tier — all to arrive at the lattice that was already
there.

## Why it was expensive

On its own that would be a rounding error. It was not, because of who calls it.

`applySync` loops **every file** in a connector's snapshot whenever *any* one of
them changes. The whole-connector fingerprint decides whether a sync happens at
all; once it does, every file is re-added unconditionally. So editing one file in
a 200-file connector meant 200 source ascents and 200 corpus rebuilds, and 199 of
them reproduced what was already stored.

## Why it was easy to miss

The costly-looking part was already free. `embedWindows` builds a reuse map from
the previous snapshot's windows, so every window of an unchanged source hit the
map, `toEmbed` came back empty, and no provider call was made. The result even
said so — `Reused: n, Embedded: 0, Usage: {}`.

The embedding was spared and everything downstream of it was redone anyway. The
one signal that would have made this visible is the one the reuse map suppressed.

## The check

```go
if existed && unchangedFrom(prev, label, text, blocks) {
    return AddResult{Source: prev, Skipped: true}, nil
}
```

Three details are load-bearing:

**It compares text, not revision.** A connector passes its sync sequence as the
revision and bumps it on every sync, so `prev.Revision != revision` always. A
revision check would never fire for the exact caller this exists to serve.
(`Source.Revision` is stored but read nowhere in non-test code today.)

**Blocks are part of the comparison.** A document can be restructured into
different blocks that flatten to byte-identical text. Skipping that would leave
every stored span resolving against the old structure — a citation that points at
the wrong place is worse than one that cost a re-cluster.

**`SyncedAt` is not advanced.** Nothing changed, so `ProjectChangedSince` should
not report a change and dependent prompt blocks should not re-resolve. This fixes
a spurious cascade rather than introducing one.

`AddResult.Skipped` carries it out, because `Windows`, `Nodes` and `Usage` are
all zero on a skip and that is indistinguishable from a source that produced
nothing.

## A test that had started lying

`TestAddReusesUnchangedEmbeddings` asserted `third.Reused == third.Windows` after
re-adding identical text. With the early-out both are zero, so it passed —
vacuously, having stopped exercising the reuse map entirely.

It now asserts the behaviour that actually happens (`Skipped`, no embedder call,
no work reported, `SyncedAt` unmoved). The reuse map is still covered by the
append case above it, which is where it belongs: that path is about a *partial*
change, and a partial change is the only time the reuse map does anything.

Worth noting as a pattern — an optimization that short-circuits a path can leave
the tests for that path green and meaningless.

## Not done: the per-file fingerprint

`applySync` still calls into knowledge for every file; the skip just makes each
of those calls cheap (one row read). Skipping at the connector instead would save
that read too, but needs a content hash plumbed through `knowledge.Origin`, the
SQL, and `connector.LatticeFile`. That is the last 1% and it should be measured
before it is built.
