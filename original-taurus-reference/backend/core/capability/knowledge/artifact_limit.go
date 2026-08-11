package knowledge

// artifact_limit.go is the project's artifact ceiling: how many windows and
// nodes one project's lattice may hold, and the refusal it answers with when a
// sync would carry it past that.
//
// The ceiling is a RAM bound wearing a count. A corpus rebuild holds every
// frontier vector at once — ~12KB per artifact at 1536 dims — so a project of
// 200k artifacts needs ~2.4GB to rebuild, and the machine that cannot supply it
// does not fail politely: the process is killed mid-sync by the OOM killer. What
// makes that the worst possible failure is that it is indistinguishable from a
// crash. Nobody is told a bound was reached, because no bound existed to reach.
//
// The pure helpers here support advisory estimates. The Store adapter is the
// correctness authority: it counts exact candidates and publishes them in the
// same transaction.

import (
	"errors"

	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// CodeArtifactLimit is the stable identity of the project artifact ceiling. It
// lives here, with the code that enforces it, for the same reason document owns
// its conflict codes: the shared limit type is a shape, not a registry.
const CodeArtifactLimit = "knowledge.project_artifact_limit"

// ErrArtifactLimit is the sentinel the ingest path branches on. The typed limit
// below answers to it, so a caller that only needs to know whether the ceiling
// was hit does not have to destructure anything.
var ErrArtifactLimit = errors.New("knowledge: the project cannot hold this many artifacts")

// artifactLimit is a limit.Exceeded that also answers to ErrArtifactLimit.
//
// Both identities are needed and neither subsumes the other, exactly as for
// file.sizeLimit: errors.Is is the cheap question, limit.From is what a handler
// needs in order to report the arithmetic to the person who has to act on it.
type artifactLimit struct{ *limit.Exceeded }

// Is preserves the sentinel check, the document.AdmissionConflict device.
func (e *artifactLimit) Is(target error) bool { return target == ErrArtifactLimit }

// Unwrap exposes the embedded limit so errors.As — and therefore limit.From —
// can reach it.
//
// Embedding alone is not enough, and the gap is invisible from the outside: it
// promotes Error() and Body(), so the value prints like a limit and looks like
// one in a log, while errors.As fails because the concrete type is
// *artifactLimit and there is no chain to walk. Record 0154 caught this on
// file.sizeLimit only because the test asserted both identities at once; this
// one's test does the same, for the same reason.
func (e *artifactLimit) Unwrap() error { return e.Exceeded }

// artifactLimitExceeded builds the same typed refusal whether the exact
// arithmetic ran in Knowledge or in its transactional Store adapter. The
// latter is the authority: a preflight estimate can save a read, but it cannot
// make an admission decision that remains true under a concurrent writer.
func artifactLimitExceeded(projectID string, limitCount, actual int64) error {
	retryable := false
	return &artifactLimit{&limit.Exceeded{
		Code:      CodeArtifactLimit,
		Message:   "This Project cannot hold the indexed artifacts this source produced; ask an administrator to raise the Project limit.",
		Limit:     limitCount,
		Actual:    actual,
		Subject:   projectID,
		Retryable: &retryable,
		Details: map[string]any{
			"artifactClass": "windows_and_nodes",
			"remediation":   "Remove indexed content or ask an administrator to raise the Project limit.",
		},
	}}
}

// ArtifactLimitExceeded is for a Store adapter that has performed exact
// arithmetic inside its write transaction. Keeping the concrete type private
// preserves the single public sentinel while letting adapters retain
// limit.From's stable wire shape.
func ArtifactLimitExceeded(projectID string, limitCount, actual int64) error {
	return artifactLimitExceeded(projectID, limitCount, actual)
}

// CheckArtifactCapacity is an advisory arithmetic check for a caller that has
// already measured both values. It never authorizes publication: concurrent
// writers and source-local node construction can invalidate any preflight, so
// AdmitAndReplaceSources / AdmitCorpus repeats the exact check transactionally.
//
// A ceiling of zero or less is no ceiling. That is the shape a caller takes when
// no budget was resolved (a test), and the operator's explicit opt-out when the
// manifest sets a negative max_artifacts, matching connectors.max_file_bytes.
func (k *Knowledge) CheckArtifactCapacity(projectID string, current, adding int) error {
	if k.maxArtifacts <= 0 {
		return nil
	}
	total := current + adding
	if total <= k.maxArtifacts {
		return nil
	}
	return artifactLimitExceeded(projectID, int64(k.maxArtifacts), int64(total))
}

// ProjectedWindows reports how many windows a source of sizeBytes will produce,
// which is what turns a snapshot's byte total into something the ceiling can be
// checked against before anything is read.
//
// Each window advances target−overlap runes, and one byte per rune is the floor,
// so the count is bytes divided by the stride. For multibyte text that
// OVER-estimates — fewer runes fit in those bytes, so fewer windows are produced
// — and over-estimating is the direction to be wrong in: it refuses a sync that
// would just have fitted, rather than admitting one that will not and finding
// out during the rebuild.
func (k *Knowledge) ProjectedWindows(sizeBytes int) int {
	if sizeBytes <= 0 {
		return 0
	}
	stride := k.windowTarget - k.windowOverlap
	if stride <= 0 {
		// Overlap at or past the target is a misconfiguration the windower would
		// not survive either; one window per byte is the honest upper bound.
		return sizeBytes
	}
	return (sizeBytes + stride - 1) / stride
}
