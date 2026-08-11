// Package file is the project-scoped binary file store: uploaded attachments and
// the images documents embed. A File is metadata (name, content type, size,
// uploader) plus opaque bytes, keyed by project. Content lives behind a Store
// port so the bytes can move to object storage later without touching callers.
package file

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// Scope is trusted application context set after access selects a Project.
type Scope struct{ ProjectID string }

// DefaultMaxSize caps a single upload when the composition root passes 0.
const DefaultMaxSize int64 = 25 << 20 // 25 MiB

var (
	ErrNotFound     = errors.New("file: not found")
	ErrInvalid      = errors.New("file: invalid request")
	ErrInvalidScope = errors.New("file: Project scope is required")
	ErrTooLarge     = errors.New("file: content exceeds the maximum size")
)

// CodeTooLarge is the stable identity of the per-upload size bound. The code lives
// here, with the capability that enforces the bound, for the same reason document
// owns its conflict codes: the shared limit type is a shape, not a registry of every
// limit in the system.
const CodeTooLarge = "file_too_large"

// tooLarge builds the size limit as a limit.Exceeded carrying the arithmetic, so a
// client can say "this file is 31 MB and the cap is 25 MB" rather than only that
// something was too big.
//
// It still satisfies errors.Is(err, ErrTooLarge) through sizeLimit.Is below, so every
// existing check keeps working and callers that only care whether it failed need no
// change.
func (f *Files) tooLarge(name string, size int64) error {
	return &sizeLimit{&limit.Exceeded{
		Code:    CodeTooLarge,
		Message: "file content exceeds the maximum size",
		Limit:   f.maxSize,
		Actual:  size,
		Subject: name,
	}}
}

// sizeLimit is a limit.Exceeded that also answers to the ErrTooLarge sentinel.
//
// Both identities are needed and neither subsumes the other: errors.Is(err,
// ErrTooLarge) is what existing callers ask, and limit.From(err) is what a handler
// needs in order to report the numbers. Embedding rather than reimplementing means
// the shape stays defined in exactly one place, and promotes Error() and Body() for
// free.
type sizeLimit struct{ *limit.Exceeded }

// Is preserves the sentinel check. Same device as document.AdmissionConflict, and for
// the same reason: enriching an error must not silently break every errors.Is that
// already matched it.
func (e *sizeLimit) Is(target error) bool { return target == ErrTooLarge }

// Unwrap exposes the embedded limit so errors.As — and therefore limit.From — can
// reach it.
//
// Embedding is not enough on its own, and the difference is easy to miss: it
// promotes Error() and Body(), so the value looks like a limit and prints like one,
// while errors.As still fails because the concrete type is *sizeLimit and there is no
// chain to walk. The test asserts both identities together for exactly this reason.
func (e *sizeLimit) Unwrap() error { return e.Exceeded }

// File is one stored file's metadata; the bytes live in the Store.
type File struct {
	ID           string    `json:"id"`
	ProjectID    string    `json:"projectId"`
	Name         string    `json:"name"`
	ContentType  string    `json:"contentType"`
	Size         int64     `json:"size"`
	UploaderID   string    `json:"uploaderId"`
	UploaderName string    `json:"uploaderName"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Store persists file metadata and content, keyed by project. Every read takes
// the project it is made on behalf of and must return ErrNotFound when the file
// belongs to another project, so the boundary is enforced by the store itself
// rather than by each caller remembering to compare ProjectID.
type Store interface {
	Put(f File, content []byte) error
	Meta(projectID, id string) (File, error)
	Content(projectID, id string) ([]byte, error)
	ByProject(projectID string) ([]File, error)
}

// Files is the file service.
type Files struct {
	store   Store
	maxSize int64
	now     func() time.Time
}

// New constructs the service. A maxSize below 1 uses DefaultMaxSize.
func New(store Store, maxSize int64) (*Files, error) {
	if store == nil {
		return nil, errors.New("file: store is required")
	}
	if maxSize < 1 {
		maxSize = DefaultMaxSize
	}
	return &Files{store: store, maxSize: maxSize, now: time.Now}, nil
}

// MaxSize is the per-upload byte cap the service enforces.
func (f *Files) MaxSize() int64 { return f.maxSize }

// Upload stores a new file in the project, attributed to the uploader.
func (f *Files) Upload(scope Scope, name, contentType string, content []byte, uploaderID, uploaderName string) (File, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return File{}, ErrInvalidScope
	}
	name = strings.TrimSpace(name)
	if name == "" || len(content) == 0 || strings.TrimSpace(uploaderID) == "" {
		return File{}, ErrInvalid
	}
	if int64(len(content)) > f.maxSize {
		return File{}, f.tooLarge(name, int64(len(content)))
	}
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	meta := File{
		ID:           newID(),
		ProjectID:    scope.ProjectID,
		Name:         name,
		ContentType:  strings.TrimSpace(contentType),
		Size:         int64(len(content)),
		UploaderID:   uploaderID,
		UploaderName: strings.TrimSpace(uploaderName),
		CreatedAt:    f.now().UTC(),
	}
	if meta.UploaderName == "" {
		meta.UploaderName = uploaderID
	}
	if err := f.store.Put(meta, append([]byte(nil), content...)); err != nil {
		return File{}, err
	}
	return meta, nil
}

// Meta returns a file's metadata, scoped to the project.
func (f *Files) Meta(scope Scope, id string) (File, error) {
	return f.load(scope, id)
}

// Download returns a file's metadata and its bytes, scoped to the project.
func (f *Files) Download(scope Scope, id string) (File, []byte, error) {
	meta, err := f.load(scope, id)
	if err != nil {
		return File{}, nil, err
	}
	content, err := f.store.Content(meta.ProjectID, meta.ID)
	if err != nil {
		return File{}, nil, ErrNotFound
	}
	return meta, content, nil
}

// List returns the project's files, newest first.
func (f *Files) List(scope Scope) ([]File, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return nil, ErrInvalidScope
	}
	return f.store.ByProject(scope.ProjectID)
}

// load fetches metadata and enforces project scope: a file in another project is
// reported as not found, so a project cannot reach another project's files. The
// scope goes into the store's query, and the returned row is re-checked here —
// two independent layers, so neither the store nor this check is load-bearing
// alone.
func (f *Files) load(scope Scope, id string) (File, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return File{}, ErrInvalidScope
	}
	meta, err := f.store.Meta(scope.ProjectID, strings.TrimSpace(id))
	if err != nil {
		return File{}, ErrNotFound
	}
	if meta.ProjectID != scope.ProjectID {
		return File{}, ErrNotFound
	}
	return meta, nil
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
