package wiring

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"sort"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// fileResourceFamily makes uploaded files—especially chat attachments—a
// first-class readable Resource. File lifecycle remains owned by the upload
// capability, so generic Resource mutation deliberately does not invent a
// second create/rename/delete path for it.
type fileResourceFamily struct{ files *file.Files }

func (fileResourceFamily) Kind() resource.Kind { return resource.KindFile }

func (f fileResourceFamily) List(projectID string, before *resource.Boundary, limit int) ([]resource.Summary, error) {
	items, err := f.files.List(file.Scope{ProjectID: projectID})
	if err != nil {
		return nil, err
	}
	out := make([]resource.Summary, 0, len(items))
	for _, item := range items {
		summary := fileResourceSummary(item)
		if before != nil && !resourceSummaryAfter(summary, *before) {
			continue
		}
		out = append(out, summary)
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		}
		if out[i].Kind != out[j].Kind {
			return out[i].Kind < out[j].Kind
		}
		return out[i].ID < out[j].ID
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (f fileResourceFamily) Get(projectID, id string) (resource.Summary, error) {
	meta, err := f.files.Meta(file.Scope{ProjectID: projectID}, id)
	if errors.Is(err, file.ErrNotFound) {
		return resource.Summary{}, resource.ErrNotFound
	}
	if err != nil {
		return resource.Summary{}, err
	}
	return fileResourceSummary(meta), nil
}

func (fileResourceFamily) Create(string, resource.Actor, string) (resource.Summary, error) {
	return resource.Summary{}, resource.ErrUnavailableKind
}

func (fileResourceFamily) Rename(string, resource.Actor, string, string) (resource.Summary, error) {
	return resource.Summary{}, resource.ErrUnavailableKind
}

func (fileResourceFamily) Delete(string, resource.Actor, string) error {
	return resource.ErrUnavailableKind
}

func (f fileResourceFamily) OpenProjection(ctx context.Context, scope resource.ProjectScope, locator resource.ResourceLocator, req resource.ProjectionRequest) (resource.VersionedProjection, error) {
	if err := ctx.Err(); err != nil {
		return resource.VersionedProjection{}, err
	}
	if locator.Subpath != "" || req.Subpath != "" || (locator.Projection != "" && locator.Projection != "text") {
		return resource.VersionedProjection{}, resource.ErrProjectionUnsupported
	}
	meta, err := f.files.Meta(file.Scope{ProjectID: scope.ProjectID}, locator.ResourceID)
	if errors.Is(err, file.ErrNotFound) {
		return resource.VersionedProjection{}, resource.ErrOriginGone
	}
	if err != nil {
		return resource.VersionedProjection{}, err
	}
	if !textualContentType(meta.ContentType) {
		return resource.VersionedProjection{}, resource.ErrContentNotTextual
	}
	if meta.Size > resource.MaxExactReadBytes {
		return resource.VersionedProjection{}, resource.ErrReadLimitExceeded
	}
	_, content, err := f.files.Download(file.Scope{ProjectID: scope.ProjectID}, locator.ResourceID)
	if errors.Is(err, file.ErrNotFound) {
		return resource.VersionedProjection{}, resource.ErrOriginGone
	}
	if err != nil {
		return resource.VersionedProjection{}, err
	}
	hash := sha256.Sum256(content)
	version := hex.EncodeToString(hash[:])
	if req.ExpectedVersion != "" && req.ExpectedVersion != version {
		return resource.VersionedProjection{}, resource.ErrVersionChanged
	}
	return resource.VersionedProjection{
		Version:     version,
		ContentHash: version,
		MediaType:   meta.ContentType,
		Text:        io.NopCloser(strings.NewReader(string(content))),
	}, nil
}

func fileResourceSummary(meta file.File) resource.Summary {
	return resource.Summary{
		ID: meta.ID, Kind: resource.KindFile, Name: meta.Name,
		CreatedAt: meta.CreatedAt, UpdatedAt: meta.CreatedAt, CreatorID: meta.UploaderID,
	}
}

func resourceSummaryAfter(summary resource.Summary, before resource.Boundary) bool {
	if !summary.UpdatedAt.Equal(before.UpdatedAt) {
		return summary.UpdatedAt.Before(before.UpdatedAt)
	}
	if summary.Kind != before.Kind {
		return summary.Kind > before.Kind
	}
	return summary.ID > before.ID
}

func textualContentType(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	return strings.HasPrefix(contentType, "text/") || contentType == "application/json" ||
		contentType == "application/xml" || contentType == "application/yaml" || contentType == "application/x-yaml" ||
		contentType == "application/javascript" || contentType == "application/sql"
}
