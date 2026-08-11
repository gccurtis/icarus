package wiring

import (
	"context"
	"log"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

// refreshCascader turns a changed source into reload resolves for every prompt
// block that depends on it. Refresh is best-effort: a failure is logged and never
// propagated back into the sync that triggered it. Resolution is already authored
// by the system actor and logged in Activity, so no attribution code is needed
// here.
type refreshCascader struct {
	docs  *document.Documents
	queue job.Enqueuer
}

func (c refreshCascader) RefreshDependents(projectID, sourceType, sourceID string) {
	deps, err := c.docs.DependentPrompts(projectID, document.ScopeOrigin{Kind: sourceType, ID: sourceID})
	if err != nil {
		log.Printf("cascade: dependents for %s/%s: %v", sourceType, sourceID, err)
		return
	}
	for _, d := range deps {
		payload := map[string]string{
			"projectId":  projectID,
			"documentId": d.DocumentID,
			"blockId":    d.BlockID,
			"mode":       "reload",
		}
		if _, err := c.queue.Enqueue(context.Background(), document.JobTypeResolve, payload); err != nil {
			log.Printf("cascade: enqueue resolve %s/%s: %v", d.DocumentID, d.BlockID, err)
		}
	}
}
