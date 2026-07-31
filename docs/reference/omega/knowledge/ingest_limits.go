package knowledge

import (
	"errors"

	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// The read limits are actual decoded bytes. Provider size, MIME, and hashes are
// useful hints, never authority: an absent or dishonest size must take the same
// bounded path as an honest one.
const (
	CodeSourceBytesLimit = "knowledge.source_bytes_limit"
	CodeRunBytesLimit    = "knowledge.run_bytes_limit"
)

var (
	ErrSourceBytesLimit = errors.New("knowledge: source exceeds the decoded-byte limit")
	ErrRunBytesLimit    = errors.New("knowledge: ingest run exceeds the decoded-byte limit")
)

type ingestLimit struct {
	*limit.Exceeded
	target error
}

func (e *ingestLimit) Is(target error) bool { return target == e.target }
func (e *ingestLimit) Unwrap() error        { return e.Exceeded }

// SourceBytesLimit constructs the typed refusal used before a known-size local
// source is materialized. The stream guard remains authoritative: callers use
// this only to avoid loading bytes that the trusted local File metadata already
// proves cannot fit.
func SourceBytesLimit(sourceID string, max, actual int64) error {
	retryable := false
	return &ingestLimit{Exceeded: &limit.Exceeded{
		Code:      CodeSourceBytesLimit,
		Message:   "This source exceeds the decoded-byte limit for Knowledge ingestion.",
		Limit:     max,
		Actual:    actual,
		Subject:   sourceID,
		Retryable: &retryable,
		Details: map[string]any{
			"remediation": "Reduce the source size or ask an administrator to raise the Knowledge ingest byte limit.",
		},
	}, target: ErrSourceBytesLimit}
}

func sourceBytesLimit(sourceID string, max, actual int64) error {
	return SourceBytesLimit(sourceID, max, actual)
}

func runBytesLimit(projectID string, max, actual int64) error {
	retryable := false
	return &ingestLimit{Exceeded: &limit.Exceeded{
		Code:      CodeRunBytesLimit,
		Message:   "This ingestion run exceeds the decoded-byte limit for Knowledge ingestion.",
		Limit:     max,
		Actual:    actual,
		Subject:   projectID,
		Retryable: &retryable,
		Details: map[string]any{
			"remediation": "Reduce the run size or ask an administrator to raise the Knowledge ingest byte limit.",
		},
	}, target: ErrRunBytesLimit}
}
