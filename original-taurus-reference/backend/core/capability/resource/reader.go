// Package resource provides the unified Project resource catalog, now extended
// with exact reading — resolving a resource by stable ID or name and reading its
// current canonical content directly from the owning family, independent of
// Knowledge admission.
package resource

import (
	"context"
	"errors"
	"io"
)

// Resource-level errors for exact reading.
var (
	ErrInvalidSelector       = errors.New("resource selector is invalid")
	ErrNameAmbiguous         = errors.New("resource name is ambiguous: more than one visible match")
	ErrTrashed               = errors.New("resource is trashed")
	ErrProjectionUnsupported = errors.New("resource does not support this projection")
	ErrContentNotTextual     = errors.New("resource content is not textual")
	ErrVersionChanged        = errors.New("resource version has changed since the request")
	ErrOriginUnavailable     = errors.New("resource origin is temporarily unavailable")
	ErrOriginGone            = errors.New("resource origin no longer has this content")
	ErrReadLimitExceeded     = errors.New("resource read limit exceeded")
	ErrReadCursorInvalid     = errors.New("resource read cursor is invalid")
)

// ProjectScope is trusted caller context that identifies the Project and
// requester. It is supplied by the transport layer after access has selected
// a Project, never from model-supplied arguments.
type ProjectScope struct {
	ProjectID  string
	CallerID   string
	CallerName string
}

// ResourceSelector identifies a resource by stable ID or by exact human name
// plus optional kind. Names are conveniences, never durable identity — the ID
// field takes precedence when both are set.
type ResourceSelector struct {
	ID   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
	Kind Kind   `json:"kind,omitempty"`
}

// ResourceLocator is a stable pointer to a resource within a Project. It is
// returned by Resolve and by Knowledge search results, and it is the input to
// exact reading.
type ResourceLocator struct {
	ResourceID string `json:"resourceId"`
	Kind       Kind   `json:"kind"`
	Subpath    string `json:"subpath,omitempty"`
	Projection string `json:"projection,omitempty"`
}

// ExactReadRequest is the model-facing read parameters. The Selector identifies
// the resource; optional fields narrow the read to a subpath, projection, or
// line range.
type ExactReadRequest struct {
	Selector        ResourceSelector `json:"selector"`
	Subpath         string           `json:"subpath,omitempty"`
	Projection      string           `json:"projection,omitempty"`
	StartLine       int              `json:"startLine,omitempty"`
	EndLine         int              `json:"endLine,omitempty"`
	Cursor          string           `json:"cursor,omitempty"`
	ExpectedVersion string           `json:"expectedVersion,omitempty"`
}

// ExactReadResult is the complete read response, carrying the current content,
// version, content hash, line range, truncation/cursor state, and direct-origin
// provenance.
type ExactReadResult struct {
	Resource    ResourceSummary `json:"resource"`
	Locator     ResourceLocator `json:"locator"`
	Version     string          `json:"version"`
	ContentHash string          `json:"contentHash"`
	Projection  string          `json:"projection"`
	StartLine   int             `json:"startLine"`
	EndLine     int             `json:"endLine"`
	Text        string          `json:"text"`
	Truncated   bool            `json:"truncated"`
	NextCursor  string          `json:"nextCursor,omitempty"`
	Provenance  Provenance      `json:"provenance"`
}

// Provenance describes where the returned content came from — always direct
// origin, never indexed evidence.
type Provenance struct {
	Origin string `json:"origin"`
}

// ProjectionRequest carries the parameters for opening a projection on a
// resource.
type ProjectionRequest struct {
	Subpath         string
	StartLine       int
	EndLine         int
	Cursor          string
	ExpectedVersion string
	ByteLimit       int
	LineLimit       int
}

// MaxExactReadBytes is the maximum decoded textual projection one exact read
// will materialize. Families may stream from much larger origins, but they must
// never make an unbounded body reachable through a model-callable read.
const MaxExactReadBytes = 64 * 1024

// LineMap maps logical (one-based) line numbers to their byte ranges in the
// projection's text.
type LineMap struct {
	Lines []LineRange
}

// LineRange is one line's byte range, start inclusive, end exclusive.
type LineRange struct {
	Start int
	End   int
}

// VersionedProjection is the result of opening a projection on a resource. The
// Text reader must be closed by the caller.
type VersionedProjection struct {
	Version     string
	ContentHash string
	MediaType   string
	Text        io.ReadCloser
	LineMap     LineMap
}

// ResourceSummary is the caller-facing summary of a resource, returned in read
// results.
type ResourceSummary struct {
	ID      string `json:"id"`
	Kind    Kind   `json:"kind"`
	Name    string `json:"name"`
	Version string `json:"version,omitempty"`
}

// ReadableFamily extends Family with support for opening a textual projection.
// Families that support exact reading implement this interface; families that
// do not (e.g., binary, media, or structured resources) return
// ErrProjectionUnsupported.
type ReadableFamily interface {
	Family
	OpenProjection(ctx context.Context, scope ProjectScope, locator ResourceLocator, req ProjectionRequest) (VersionedProjection, error)
}

// ExactResourceReader is the application port for resolving and reading
// resource content. It is implemented by Resources and bound to a trusted
// ProjectScope.
type ExactResourceReader interface {
	// Resolve resolves a selector to a stable locator. It authorizes access and
	// returns ErrNameAmbiguous when more than one visible resource matches.
	Resolve(ctx context.Context, scope ProjectScope, selector ResourceSelector) (ResourceLocator, error)
	// Read reads the current content of the resource identified by the selector.
	Read(ctx context.Context, scope ProjectScope, req ExactReadRequest) (ExactReadResult, error)
}
