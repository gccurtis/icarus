package knowledge

import (
	"errors"
	"net/http"
	"testing"

	kb "github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

func TestEmbedErrPreservesKnowledgeLimitShape(t *testing.T) {
	res := embedErr(kb.ArtifactLimitExceeded("project-1", 100, 101))
	if res.Status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d", res.Status, http.StatusUnprocessableEntity)
	}
	body, ok := res.Body.(map[string]any)
	if !ok {
		t.Fatalf("body = %#v, want limit body", res.Body)
	}
	if body["code"] != kb.CodeArtifactLimit || body["retryable"] != false {
		t.Fatalf("body = %#v, want typed non-retryable artifact limit", body)
	}
	details, ok := body["details"].(map[string]any)
	if !ok || details["artifactClass"] != "windows_and_nodes" {
		t.Fatalf("details = %#v, want artifact class", body["details"])
	}
}

func TestEmbedErrMapsEmbeddingLifecycleFailures(t *testing.T) {
	tests := []struct {
		err    error
		status int
		code   string
	}{
		{kb.ErrEmbeddingSpaceUnavailable, http.StatusServiceUnavailable, "knowledge.embedding_space_unavailable"},
		{kb.ErrEmbeddingSpaceChangeRequired, http.StatusConflict, "knowledge.embedding_space_change_required"},
		{kb.ErrGenerationConflict, http.StatusConflict, "knowledge.generation_conflict"},
		{kb.ErrReembedPreviewStale, http.StatusConflict, "knowledge.reembed_preview_stale"},
		{kb.ErrReembedIncomplete, http.StatusConflict, "knowledge.reembed_incomplete"},
		{kb.ErrReembedValidationFailed, http.StatusUnprocessableEntity, "knowledge.reembed_validation_failed"},
		{kb.ErrReembedSourceChanged, http.StatusConflict, "knowledge.reembed_source_changed"},
		{kb.ErrReembedCancelled, http.StatusConflict, "knowledge.reembed_cancelled"},
		{kb.ErrRollbackExpired, http.StatusGone, "knowledge.rollback_expired"},
		{kb.ErrEvidenceChanged, http.StatusConflict, "knowledge.evidence_changed"},
		{kb.ErrEvidenceCorrupt, http.StatusInternalServerError, "knowledge.evidence_corrupt"},
		{kb.ErrReembedForbidden, http.StatusForbidden, "knowledge.reembed_forbidden"},
		{kb.ErrReembedNotFound, http.StatusNotFound, "knowledge.reembed_not_found"},
	}
	for _, tc := range tests {
		t.Run(tc.code, func(t *testing.T) {
			res := embedErr(errors.Join(errors.New("context"), tc.err))
			if res.Status != tc.status {
				t.Fatalf("status = %d, want %d", res.Status, tc.status)
			}
			body, ok := res.Body.(map[string]any)
			if !ok || body["code"] != tc.code || body["retryable"] != false {
				t.Fatalf("body = %#v, want code %q", res.Body, tc.code)
			}
		})
	}
}
