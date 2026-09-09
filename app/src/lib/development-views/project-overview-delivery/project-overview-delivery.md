# Project Overview delivery reference

`/demo/project-overview-panels/delivery` is the durable delivery record for the Git range
`3e670c5..930fb95`. It complements the interactive panel reference: that page answers how the six
panels look and behave, while this page explains everything added to make them production-ready.

The page is deliberately assembled from small, static components and typed procedure data. The
release module owns the pinned range, totals, commits, areas, architecture repairs, and verification
facts. The contracts module owns the panel and capability contracts. The ledger module accounts for
every changed path exactly once. A unit contract keeps those totals aligned.

When a later delivery needs documenting, create a separate pinned reference instead of silently
moving this range forward. Historical references should describe the code that was actually merged.
