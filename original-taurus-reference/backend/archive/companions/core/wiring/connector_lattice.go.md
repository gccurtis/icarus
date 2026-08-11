# connector_lattice.go

The composition seam between connectors and the knowledge lattice, plus the
background change detector. `connectorLatticeWriter` implements the connector
capability's `LatticeWriter` by calling `knowledge.AddBatch` / `Remove` /
`SourcesUnder` under the connector source type, so the two capabilities never
import each other. `connectorCostRecorder` adapts the telemetry sink;
`connectorProviderFactory` builds a connector's `Provider` from its configured
path; and `runConnectorDetector` re-syncs changed connectors on a configured
interval until its context is cancelled. See repo conventions (AGENTS.md).

## Code breakdown

### `AddSources` — the connector's whole snapshot in one lattice call

It maps a sync's `LatticeFileWrite`s to `knowledge.AddItem`s and makes a single
`AddBatch` call, summing the per-item usage back into one `connector.Usage`.

It replaced a per-file `AddSource`, and the reason is what that loop cost: one
embedding provider request per file, back to back, plus one project-scale corpus
rebuild after each — for as many files as the folder held. A first sync over a
large directory was a request storm, which is the shape a per-minute rate limit
exists to stop.

Each file still gets a whole-text `BlockSpan`; a connector file has no internal
block structure to cite, so the span is the file.

### `SourcesUnder` — the label crosses back as the provider's key

It maps each stored origin to a `connector.LatticeFile`, pairing the source id with
the label the lattice holds for it — which, for a connector file, is the path it was
synced from.

That is what makes a re-sync able to recognise a file it has seen before. The
connector capability knows its files only by path; the ids are minted at sync time
and stored here, so the lattice is where the mapping between the two lives.
`AddSources` writes the same label on the way in, which keeps the pair consistent
without a second table.

The two names describe the same string from opposite sides of the seam. Knowledge
calls it a label because it is the human-facing name of a source, whatever kind of
source that is; the connector calls it a key because it is what its provider
identifies a member by. This adapter is where the two vocabularies meet, which is
the right place for the translation to be visible.

### `connectorProviderFactory` — the scheme is the dispatch

```go
if strings.HasPrefix(c.Path, "http://") || strings.HasPrefix(c.Path, "https://") {
	return connector.NewHTTPProvider(c.Path), nil
}
return connector.NewLocalFolderProvider(c.Path), nil
```

An `http(s)` endpoint is served by the external watcher (the same shape a real cloud
provider will use); anything else is a filesystem path read in-process by the
local-folder provider. A path says what it is, so no configuration flag needs to.

Before this dispatch existed the factory returned the HTTP provider
unconditionally, so a plain directory path — the thing the in-process local-folder
provider exists to read — errored on every sync. The knowledge-scale suite is what
exposed it: pointing a connector at a real docs tree is exactly how a large corpus
is admitted.

### `runConnectorDetector` — the sweep, and what it says

It ticks on the configured interval (`connectors.sync.detect_interval`, falling back
to `defaultConnectorDetectInterval` when unset or non-positive) and calls
`DetectChanges`, which reconciles every connector across every project. Errors are
logged, never fatal.

The interval became a parameter rather than a constant because it is a cost: every
tick is a fingerprint comparison per connector, and a deployment with many
connectors and slow-moving sources should be able to say so.

What it logs matters as much as what it does, because it runs for the life of the
process:

- A **failure this tick** is news, and is logged every time, together with how many
  connectors are waiting to retry — so the line distinguishes "three things just
  broke" from "one thing is still broken".
- A connector that has **stopped retrying** is news exactly once. It is a standing
  condition, and at a two-second cadence repeating it would bury everything else,
  so the goroutine keeps the last count it reported and logs only on a change — in
  both directions, including the recovery.
