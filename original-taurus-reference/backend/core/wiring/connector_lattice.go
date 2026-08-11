package wiring

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/platform/telemetry"
)

// defaultConnectorDetectInterval is the fallback cadence for the background
// change detector when configuration does not set one. A few seconds, so a demo
// picks up an external edit promptly; the configured value
// (connectors.sync.detect_interval) is what a deployment actually runs on.
const defaultConnectorDetectInterval = 2 * time.Second

// connectorLatticeWriter feeds a connector's synced content into the knowledge
// lattice under the connector source type. It is the seam that keeps the
// connector capability independent of knowledge — the composition lives here.
type connectorLatticeWriter struct{ know *knowledge.Knowledge }

// AddSources admits a sync's listing. The items carry openers, not content, so
// this adapter — which used to build a third simultaneous copy of every file's
// bytes, after the provider's and the connector's — now costs a few hundred bytes
// per file. The lattice opens what it decides it needs.
//
// A connector file has no internal component structure to cite, so its single
// block span covers the whole file. Its end is the size the provider reported;
// where the provider could not report one, the span is left to the lattice, which
// knows the real length only after reading.
func (w connectorLatticeWriter) AddSources(projectID string, files []connector.LatticeFileWrite) (connector.Usage, []connector.SkippedFile, error) {
	items := make([]knowledge.AddItem, len(files))
	for i, f := range files {
		items[i] = knowledge.AddItem{
			SourceType: knowledge.SourceTypeConnector, SourceID: f.SourceID, Label: f.Label,
			Content:  knowledge.Content{Size: f.Size, Hash: f.Hash, Open: f.Open},
			Blocks:   []knowledge.BlockSpan{{Start: 0, End: int(f.Size)}},
			Revision: f.Revision,
		}
	}
	results, err := w.know.AddBatch(context.Background(), projectID, items)
	var usage connector.Usage
	var skipped []connector.SkippedFile
	for i, res := range results {
		usage.PromptTokens += res.Usage.PromptTokens
		usage.TotalTokens += res.Usage.TotalTokens
		// A file the lattice could not read is reported back to the caller rather
		// than swallowed. The sync succeeded; this one file did not arrive, and the
		// person who triggered the sync is the one who needs to know.
		if res.Unreadable != nil && i < len(files) {
			skipped = append(skipped, connector.SkippedFile{
				Path:   files[i].Label,
				Code:   connector.CodeFileUnreadable,
				Detail: res.Unreadable.Error(),
				Size:   files[i].Size,
			})
		}
	}
	return usage, skipped, err
}

func (w connectorLatticeWriter) RemoveSource(projectID, sourceID string) error {
	_, err := w.know.Remove(context.Background(), projectID, knowledge.SourceTypeConnector, sourceID)
	return err
}

// SourcesUnder lists the files currently stored under a connector — each id with
// the path it was synced from — so applySync can recognise a file it has seen
// before by its path, keep the id already minted for it, and prune sources whose
// file has vanished.
func (w connectorLatticeWriter) SourcesUnder(projectID, sourceIDPrefix string) ([]connector.LatticeFile, error) {
	origins, err := w.know.SourcesUnder(projectID, knowledge.SourceTypeConnector, sourceIDPrefix)
	if err != nil {
		return nil, err
	}
	out := make([]connector.LatticeFile, len(origins))
	for i, o := range origins {
		out[i] = connector.LatticeFile{SourceID: o.SourceID, Key: o.Label}
	}
	return out, nil
}

// connectorCostRecorder adapts the telemetry sink to the connector's CostRecorder
// port, tagging each event as a connector sync.
type connectorCostRecorder struct{ rec telemetry.Recorder }

func (c connectorCostRecorder) RecordSyncCost(projectID, connectorID string, usage connector.Usage) {
	c.rec.RecordCost("connector.sync", connectorID, telemetry.Usage{PromptTokens: usage.PromptTokens, TotalTokens: usage.TotalTokens})
}

// connectorProviderFactory builds the Provider for a connector from its
// configured path. An http(s) endpoint is served by the external watcher (the
// same shape a real cloud provider will use); anything else is a filesystem
// path and is read in-process by the local-folder provider. The scheme is the
// dispatch — a path says what it is, so no configuration flag needs to.
func connectorProviderFactory(c connector.Connector) (connector.Provider, error) {
	if strings.HasPrefix(c.Path, "http://") || strings.HasPrefix(c.Path, "https://") {
		return connector.NewHTTPProvider(c.Path), nil
	}
	return connector.NewLocalFolderProvider(c.Path), nil
}

// runConnectorDetector re-syncs connectors whose external source changed, on the
// given interval (zero takes the default), until ctx is cancelled. Errors are
// logged, never fatal.
//
// The sweep runs forever, so what it logs matters as much as what it does. A
// failure this tick is news and is logged every time. A connector that has
// stopped retrying is news exactly once — it is a standing condition, and at a
// two-second cadence saying so on every tick would bury everything else — so the
// count is logged only when it changes.
func runConnectorDetector(ctx context.Context, connectors *connector.Connectors, interval time.Duration) {
	if interval <= 0 {
		interval = defaultConnectorDetectInterval
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	reported := -1
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			out, err := connectors.DetectChanges()
			if err != nil {
				log.Printf("connector detector: %v", err)
			}
			if out.Failed > 0 {
				log.Printf("connector detector: %d connector(s) failed to sync (%d re-synced, %d waiting to retry)",
					out.Failed, out.Changed, out.Deferred)
			}
			if out.Attention != reported {
				if out.Attention > 0 {
					log.Printf("connector detector: %d connector(s) have stopped retrying and need attention", out.Attention)
				} else if reported > 0 {
					log.Printf("connector detector: no connectors need attention any more")
				}
				reported = out.Attention
			}
		}
	}
}
