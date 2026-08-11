# 0151 — The real corpus, at scale

The parameter question deserved real text, not synthetic vectors. The new
`dev-test/knowledge-scale` suite copies every markdown file from this repo's
docs tree plus the sibling taurus-alpha's — 595 files, 6.0 MB of real prose —
and admits it through a local-folder connector exactly as production would.
One run, measured:

- **One sync, one batch**: 595 files in 22s — the connector snapshot lands as
  a single AddBatch (chunked embedding, one deferred rebuild), 1,207,894
  tokens, **$0.024**.
- **The corpus tier crossed the (lowered) crossover and ran sparse**: 664
  frontier entries clustered in **741ms** (load 31ms), 200 nodes, pinned
  threshold 0.563, index stored.
- **A one-file edit re-synced for 454 tokens** — the other 594 files skipped,
  only the appended tail re-embedded — and the rebuild **repaired**:
  `+1 −1 of 664, drift 0.0003`. The local-events design, on real data.
- **Retrieval descends and probes the stored index** — fittingly, the query
  about connector syncing retrieved record 0121, the connector-sync-race doc.

## Two findings only real scale could produce

**The local-folder path was not actually wired.** The in-process provider
existed, but the composition root built an HTTP provider unconditionally, so
a filesystem path errored on every sync. Fixed by scheme dispatch in
`connectorProviderFactory` — an http(s) path is the watcher/cloud shape,
anything else is a directory read in-process. "Make sure it is fully set up"
was the right instinct: the batching was wired end to end, the directory path
was not.

**descent.threshold 0.35 is marginal on a real doc corpus.** One of three
topical queries fell back to the exact scan — descent pruned every corpus
root below 0.35 for that phrasing, while the corpus's own within-cluster
threshold sat at 0.563. Real-embedding similarity between a query and a
cluster centroid runs lower than between documents; the beam/threshold pair
should be tuned against this suite (which now exists to tune against), and
the fallback answered correctly in the meantime — the design degrading as
designed.

One transient worth recording: an earlier run's manual sync 500'd mid-embed
(provider-side blip; the generic "connector error" hid the cause — the suite
now tails the server log when a sync answers badly) and the 2s change
detector retried and completed the whole sync unaided. Self-healing, but a
first sync at 100k-file scale should not restart its embedding from zero on
one failed chunk; sub-batching the snapshot into a few AddSources calls is
the noted hardening, cheap because a retry skips everything already
committed.
