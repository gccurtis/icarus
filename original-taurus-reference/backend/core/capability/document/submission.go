package document

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxSubmissionIDBytes bounds the opaque client idempotency key carried by one
// change submission.
const MaxSubmissionIDBytes = 128

// Admission conflict codes are stable wire values. A revision conflict means
// the client must resync to CurrentRevision; a submission conflict means the
// same idempotency key was already accepted with a different payload.
const (
	ConflictCodeRevision   = "document_revision_conflict"
	ConflictCodeSubmission = "document_submission_conflict"
)

// ChangeSubmission is the client-authored editing request. SubmissionID makes
// a lost response retryable, ExpectedRevision declares the head the user
// edited, and Operations is the typed atomic change to apply there or rebase
// only when retained semantic preconditions prove that safe.
type ChangeSubmission struct {
	SubmissionID     string     `json:"submissionId"`
	ExpectedRevision int64      `json:"expectedRevision"`
	Operations       []ChangeOp `json:"operations"`
}

// AdmissionConflict is a bounded collaboration conflict. ResyncRevision is the
// canonical head a client must load before constructing a new submission.
type AdmissionConflict struct {
	Code             string `json:"code"`
	ExpectedRevision int64  `json:"expectedRevision"`
	CurrentRevision  int64  `json:"currentRevision"`
	ResyncRevision   int64  `json:"resyncRevision"`
}

func (e *AdmissionConflict) Error() string {
	if e.Code == ConflictCodeSubmission {
		return "document submission id was already used with different changes"
	}
	return "document revision does not match the submitted revision"
}

// Is preserves errors.Is checks against the store/service sentinels while
// carrying the revisions needed by the HTTP conflict response.
func (e *AdmissionConflict) Is(target error) bool {
	switch e.Code {
	case ConflictCodeSubmission:
		return target == ErrSubmissionConflict
	case ConflictCodeRevision:
		return target == ErrRevisionConflict
	default:
		return false
	}
}

var (
	// ErrInvalidSubmission means the idempotency key or expected revision is
	// invalid. Invalid operations continue to use ErrInvalidChangeSet.
	ErrInvalidSubmission = errors.New("document change submission is invalid")
	// ErrSubmissionConflict means one scoped idempotency key was reused with a
	// different expected revision or operation payload.
	ErrSubmissionConflict = errors.New("document submission id already used")
)

func validSubmissionID(id string) bool {
	if id == "" || len(id) > MaxSubmissionIDBytes || !utf8.ValidString(id) ||
		strings.TrimSpace(id) != id {
		return false
	}
	for _, r := range id {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

// submissionHash fingerprints the request before server-assigned content ids
// are filled. encoding/json sorts string-keyed maps, giving an identical Go
// request a stable digest without treating server normalization as client input.
func submissionHash(submission ChangeSubmission) (string, error) {
	raw, err := json.Marshal(struct {
		ExpectedRevision int64      `json:"expectedRevision"`
		Operations       []ChangeOp `json:"operations"`
	}{
		ExpectedRevision: submission.ExpectedRevision,
		Operations:       submission.Operations,
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}
