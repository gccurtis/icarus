# 0134 — The lattice had no ceiling

Investigating a rate limit during embedding turned up something the rate limit
was hiding: nothing bounded how much the lattice would try to cluster at once,
and the failure at the far end of that is not slowness, it is an allocation that
cannot be served.

This record covers the guard. The batching that prompted the investigation, and
the redundant re-clustering found alongside it, follow separately.

## The arithmetic

`ascend` clusters a pool by building the complete pairwise cosine matrix. That
matrix is `n²` float64 — **n²·8 bytes, independent of vector dimension**, which
is the part that makes it a hard wall rather than a slow path:

| pool | `sims` | + the sorted copy `buildLevel` takes |
|---|---|---|
| 1,000 | 8 MB | 12 MB |
| 4,000 | 128 MB | ~192 MB |
| 10,000 | 800 MB | ~1.2 GB |
| 50,000 | 20 GB | ~30 GB |

Two paths reach it, and neither had a bound:

- **The corpus tier**, over every source's frontier in the project. A connector
  pointed at a large directory reaches five and six figures here.
- **A source's own windows.** Connectors capped a connector's *name* at 200
  bytes and nothing else — no file size limit existed at all — so one large file
  produced a proportionally large pool by itself.

Reducing the vector dimension does not help. PCA at 1536 → 128 cuts the *compute*
about 12×; the matrix is still 20 GB at n=50,000, because the term that matters
is n², not d.

## Refuse, don't approximate

`ascend` now takes a `maxPool` and returns `(created []Node, skipped bool)`. Over
the bound it clusters nothing and says so.

Sampling or partitioning the pool was the obvious alternative and is worse. Both
answer a different question than the caller asked, and answer it *silently*: a
partial lattice and a genuine lattice have the same shape, so nothing downstream
could tell them apart. The one thing the system must not do at scale is quietly
change what clustering means.

Refusing costs less than it appears. Unclustered artifacts stay orphans and carry
upward, which is exactly the shape the lattice already produces when nothing
clusters — a case `EntryFrontier` and descent already handle, entering at the
source frontiers. So the degradation is a flatter entry frontier, not a break.

It is also honest in a way an approximation could not be: `SourceClusterSkipped`
and `CorpusClusterSkipped` on `AddResult` (and `CorpusClusterSkipped` on
`RemoveResult`) name which tier was refused. Without them the signal is
`Nodes: 0`, which is also what a source with nothing in common reports — a
project that outgrew its lattice would be indistinguishable from a project whose
content never clustered, and the retrieval degradation that follows would have no
visible cause.

Default `max_pool` is 4,000, configurable at `knowledge.cluster.max_pool`.

## A file size limit for connectors

`connectors.max_file_bytes`, default 1 MiB — matching the bound chat attachments
already had. This is what keeps the *source*-tier pool under `max_pool` in
practice, so that guard should rarely be the one that fires.

An oversized file is skipped, not fatal: one huge file in a folder is a reason to
leave that file out, never to abandon everything beside it — the same judgement
`IndexAttachment` makes about a PDF.

The skip is placed **before** `want[sid] = true` in `applySync`, so an oversized
file is also *pruned*. That is deliberate and it is the case that matters: a file
which has grown past the bound since its last sync would otherwise keep its old,
smaller snapshot in the lattice indefinitely, and retrieval would go on citing
content the file no longer has. Saying nothing about a file beats saying
something stale.

`UseMaxFileBytes` reads three ranges rather than two — 0 takes the default,
negative means unbounded, positive sets the bound. With only zero-means-unbounded
an absent config key and a deliberate opt-out would be the same value, and
silence has to get the safe one.

## A logging port

The guard needed to be loud, and no capability could say anything: none of them
import `log`, by design.

`core/platform/logging` adds the missing port — a narrow leveled `Logger`
(`Infof`/`Warnf`/`Errorf`) that capabilities depend on while the composition root
decides what it is. It sits beside `platform/telemetry` rather than inside it
because the two carry different things: telemetry carries **measurements**, typed
events aggregated over a run; this carries **narration**, conditions an operator
needs told about that have no natural aggregate.

There is deliberately no `Fatalf`. A capability that can call `log.Fatal` can kill
the server from inside a request, and no caller can defend against that.

`Nop` and `OrNop` keep a `Logger` from ever being nil. A capability that guards
every log call with a nil check eventually forgets one, and the forgotten call
panics on exactly the degraded path the log was added to explain.

## What this does not fix

The bound stops the process dying. It does not make the lattice work at scale.

At tens of thousands of files a project's frontier is 10⁵–10⁶ entries, and there
is no `max_pool` that both fits in memory and covers that — so the guard trips
permanently, there is no corpus tier, and retrieval enters flat. Survivable at the
low end, poor at the high end.

Making clustering actually scale means not building a complete graph at all: an
approximate k-nearest-neighbour graph (k≈32) thresholded and cliqued gives
O(F·k) memory instead of O(F²), keeps the KLR rule, and makes incremental
updates fall out naturally. That is a separate piece of work, and it changes
retrieval *quality*, so it needs live `dev-test/` validation against a
full-rebuild oracle. Two prerequisites it will need are already visible: `ascend`
re-mints every node id on every rebuild, and `Add` re-mints every window id even
for windows it reused.
