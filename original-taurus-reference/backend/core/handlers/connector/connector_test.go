package connector

import (
	"net/http"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

func TestMapErrPreservesKnowledgeArtifactLimit(t *testing.T) {
	resp := mapErr(knowledge.ArtifactLimitExceeded("project-1", 10, 11))
	if resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", resp.Status)
	}
	body, ok := resp.Body.(map[string]any)
	if !ok || body["code"] != knowledge.CodeArtifactLimit || body["retryable"] != false {
		t.Fatalf("body = %#v, want typed non-retryable artifact refusal", resp.Body)
	}
}
