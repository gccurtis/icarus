// Package resource provides the unified Project resource catalog and routes
// lifecycle operations to the canonical owning family.
package resource

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"
)

const (
	DefaultLimit = 100
	MaxLimit     = 500
)

var (
	ErrUnknownKind           = errors.New("resource kind is unknown")
	ErrUnavailableKind       = errors.New("resource kind is not available")
	ErrInvalidName           = errors.New("resource name must not be empty")
	ErrAttributesUnavailable = errors.New("resource attributes are not configured")
	ErrInvalidAccessScope    = errors.New("resource access scope is invalid")
	ErrAccessDenied          = errors.New("resource access is denied")
	ErrNotOwner              = errors.New("only the resource owner can change its access")
	ErrInvalidCursor         = errors.New("resource cursor is invalid")
	ErrInvalidLimit          = errors.New("resource limit must be between 1 and 500")
	ErrNotFound              = errors.New("resource not found")
	ErrDuplicateFamily       = errors.New("resource family is registered more than once")
	ErrMissingFamily         = errors.New("resource family is required but not registered")
	ErrInvalidFamily         = errors.New("resource family has an invalid kind")
)

// Kind is the closed cross-family resource vocabulary.
type Kind string

const (
	KindDocument    Kind = "document"
	KindSpreadsheet Kind = "spreadsheet"
	KindSlides      Kind = "slides"
	KindChat        Kind = "chat"
	KindGeneral     Kind = "general"
	KindConnector   Kind = "connector"
	KindFile        Kind = "file"
)

var knownKinds = map[Kind]bool{
	KindDocument: true, KindSpreadsheet: true, KindSlides: true,
	KindChat: true, KindGeneral: true, KindConnector: true, KindFile: true,
}

// ParseKind validates a wire kind against the closed vocabulary.
func ParseKind(raw string) (Kind, error) {
	kind := Kind(raw)
	if !knownKinds[kind] {
		return "", ErrUnknownKind
	}
	return kind, nil
}

// Actor is trusted request identity passed to a family owner.
type Actor struct {
	ID   string
	Name string
}

// Summary is the common catalog projection; its ID remains family-owned. Pinned
// is a catalog attribute merged in at read time (see AttributeStore); the client
// renders pinned resources at the top of the table. Server-side ordering is left
// unchanged so keyset pagination stays correct.
type Summary struct {
	ID        string
	Kind      Kind
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
	Pinned    bool
	// CreatorID is the resource's owner, projected from the owning family. It is
	// the identity that always retains access and the only identity permitted to
	// change the resource's access scope.
	CreatorID string
	// Access is the resource's stored access scope, merged in at read time. Nil
	// means the project-wide default.
	Access *AccessScope
}

// Boundary is the decoded global keyset boundary passed to each family.
type Boundary struct {
	UpdatedAt time.Time
	Kind      Kind
	ID        string
}

// Family is the owner adapter contract. List returns entries strictly after the
// global boundary under Resource ordering, up to limit entries.
type Family interface {
	Kind() Kind
	List(projectID string, before *Boundary, limit int) ([]Summary, error)
	Get(projectID, id string) (Summary, error)
	Create(projectID string, actor Actor, name string) (Summary, error)
	Rename(projectID string, actor Actor, id, name string) (Summary, error)
	Delete(projectID string, actor Actor, id string) error
}

type PageRequest struct {
	Limit  int
	Cursor string
}

type Page struct {
	Resources      []Summary
	AvailableKinds []Kind
	NextCursor     string
}

// OrgMembershipResolver reports the organizations a user belongs to. It is the
// narrow port the access-scope resolver needs from the organization capability;
// the real *organization.Organizations satisfies it via UserOrgIDs. A nil
// resolver means org-scoped access can never match (no memberships), so an
// org-only scope simply admits nobody but the owner.
type OrgMembershipResolver interface {
	UserOrgIDs(userID string) ([]string, error)
}

// Resources is a fixed catalog over injected canonical family owners.
type Resources struct {
	families         map[Kind]Family
	readableFamilies map[Kind]ReadableFamily
	available        []Kind
	attrs            AttributeStore        // optional; nil = no catalog attributes (pinning/access)
	orgs             OrgMembershipResolver // optional; nil = no org memberships
	readCursorKey    [32]byte
}

// New builds a catalog with no attribute store (pinning/access disabled).
func New(families ...Family) (*Resources, error) {
	return NewWithAttributes(nil, families...)
}

// NewWithAttributes builds a catalog with a catalog-attribute store backing
// per-resource flags (pinning and access scope). A nil store disables those.
func NewWithAttributes(attrs AttributeStore, families ...Family) (*Resources, error) {
	r := &Resources{
		families:         make(map[Kind]Family),
		readableFamilies: make(map[Kind]ReadableFamily),
		attrs:            attrs,
	}
	if _, err := rand.Read(r.readCursorKey[:]); err != nil {
		return nil, err
	}
	for _, family := range families {
		if family == nil || !knownKinds[family.Kind()] {
			return nil, ErrInvalidFamily
		}
		if _, exists := r.families[family.Kind()]; exists {
			return nil, ErrDuplicateFamily
		}
		r.families[family.Kind()] = family
		if rf, ok := family.(ReadableFamily); ok {
			r.readableFamilies[family.Kind()] = rf
		}
		r.available = append(r.available, family.Kind())
	}
	sort.Slice(r.available, func(i, j int) bool { return r.available[i] < r.available[j] })
	return r, nil
}

func (r *Resources) AvailableKinds() []Kind { return append([]Kind(nil), r.available...) }

// ValidateFamilies closes startup composition over the families this deployment
// promises to serve. New remains intentionally open for focused tests and
// partial deployments; the composition root names its required set and refuses
// readiness if one is absent.
func (r *Resources) ValidateFamilies(required ...Kind) error {
	seen := make(map[Kind]bool, len(required))
	for _, kind := range required {
		if !knownKinds[kind] {
			return fmt.Errorf("%w: %q", ErrInvalidFamily, kind)
		}
		if seen[kind] {
			return fmt.Errorf("%w: required kind %q is listed twice", ErrDuplicateFamily, kind)
		}
		seen[kind] = true
		if _, ok := r.families[kind]; !ok {
			return fmt.Errorf("%w: %s", ErrMissingFamily, kind)
		}
	}
	return nil
}

// ValidateBoundPorts verifies the late-bound collaboration port required by the
// production Resource access policy.
func (r *Resources) ValidateBoundPorts() error {
	if r.orgs == nil {
		return errors.New("resource: organization membership port is required")
	}
	return nil
}

func (r *Resources) List(projectID string, req PageRequest) (Page, error) {
	limit := req.Limit
	if limit == 0 {
		limit = DefaultLimit
	}
	if limit < 1 || limit > MaxLimit {
		return Page{}, ErrInvalidLimit
	}
	var boundary *Boundary
	if req.Cursor != "" {
		decoded, err := decodeCursor(req.Cursor)
		if err != nil {
			return Page{}, err
		}
		boundary = &decoded
	}
	var merged []Summary
	for _, kind := range r.available {
		items, err := r.families[kind].List(projectID, boundary, limit+1)
		if err != nil {
			return Page{}, err
		}
		for i := range items {
			items[i].Kind = kind
		}
		merged = append(merged, items...)
	}
	sortSummaries(merged)
	if err := r.applyAttributes(projectID, merged); err != nil {
		return Page{}, err
	}
	page := Page{Resources: merged, AvailableKinds: r.AvailableKinds()}
	if len(page.Resources) > limit {
		page.Resources = page.Resources[:limit]
		page.NextCursor = encodeCursor(page.Resources[len(page.Resources)-1])
	}
	if page.Resources == nil {
		page.Resources = []Summary{}
	}
	return page, nil
}

// Get resolves one current canonical Resource summary through its owning family.
func (r *Resources) Get(projectID string, kind Kind, id string) (Summary, error) {
	family, err := r.family(kind)
	if err != nil {
		return Summary{}, err
	}
	summary, err := family.Get(projectID, id)
	if err != nil {
		return Summary{}, err
	}
	summary.Kind = kind
	if r.attrs != nil {
		attrs, err := r.attrs.ResourceAttributes(projectID, kind, id)
		if err != nil {
			return Summary{}, err
		}
		summary.Pinned = attrs.Pinned
		summary.Access = attrs.Access
	}
	return summary, nil
}

// applyAttributes merges each summary's catalog attributes (pinned) in one
// project-wide read. A nil store leaves everything at its zero value.
func (r *Resources) applyAttributes(projectID string, summaries []Summary) error {
	if r.attrs == nil || len(summaries) == 0 {
		return nil
	}
	byKey, err := r.attrs.ResourceAttributesByProject(projectID)
	if err != nil {
		return err
	}
	for i := range summaries {
		if a, ok := byKey[AttributeKey{Kind: summaries[i].Kind, ID: summaries[i].ID}]; ok {
			summaries[i].Pinned = a.Pinned
			summaries[i].Access = a.Access
		}
	}
	return nil
}

// SetPinned pins or unpins a resource in the catalog. It requires an attribute
// store (configured via NewWithAttributes) and verifies the resource exists in
// its family, so a pin can never be set on a resource in another project.
func (r *Resources) SetPinned(projectID string, kind Kind, id string, pinned bool) error {
	if r.attrs == nil {
		return ErrAttributesUnavailable
	}
	if _, err := r.Get(projectID, kind, id); err != nil {
		return err
	}
	attrs, err := r.attrs.ResourceAttributes(projectID, kind, id)
	if err != nil {
		return err
	}
	attrs.Pinned = pinned
	return r.attrs.SetResourceAttributes(projectID, kind, id, attrs)
}

// UseOrgMembership injects the organization-membership resolver the access-scope
// check consults. It is set once at composition; a nil resolver leaves org-scoped
// access matching nobody but the owner.
func (r *Resources) UseOrgMembership(resolver OrgMembershipResolver) { r.orgs = resolver }

// ResourceAccess returns a resource's stored access scope, defaulting to
// project-wide when none is set. It verifies the resource exists in its family.
func (r *Resources) ResourceAccess(projectID string, kind Kind, id string) (AccessScope, error) {
	summary, err := r.Get(projectID, kind, id)
	if err != nil {
		return AccessScope{}, err
	}
	if summary.Access == nil {
		return DefaultAccessScope(), nil
	}
	return *cloneAccessScope(summary.Access), nil
}

// SetAccess replaces a resource's access scope. Only the resource's owner (its
// family creator) may change it; a scope that admits every member is stored as
// the default (no restriction). Requires an attribute store.
func (r *Resources) SetAccess(callerID string, projectID string, kind Kind, id string, scope AccessScope) error {
	if r.attrs == nil {
		return ErrAttributesUnavailable
	}
	summary, err := r.Get(projectID, kind, id)
	if err != nil {
		return err
	}
	if summary.CreatorID == "" || summary.CreatorID != callerID {
		return ErrNotOwner
	}
	normalized, err := normalizeAccessScope(scope)
	if err != nil {
		return err
	}
	attrs, err := r.attrs.ResourceAttributes(projectID, kind, id)
	if err != nil {
		return err
	}
	attrs.Access = normalized
	return r.attrs.SetResourceAttributes(projectID, kind, id, attrs)
}

// FilterAccessible returns the summaries the caller may see, using each
// summary's already-merged access scope and owner — so it costs one organization
// lookup, not one per resource. It preserves order and never mutates the input.
func (r *Resources) FilterAccessible(callerID string, summaries []Summary) ([]Summary, error) {
	if len(summaries) == 0 {
		return summaries, nil
	}
	restricted := false
	for i := range summaries {
		if summaries[i].Access != nil {
			restricted = true
			break
		}
	}
	if !restricted {
		return summaries, nil
	}
	var callerOrgIDs []string
	if r.orgs != nil && callerID != "" {
		var err error
		if callerOrgIDs, err = r.orgs.UserOrgIDs(callerID); err != nil {
			return nil, err
		}
	}
	out := make([]Summary, 0, len(summaries))
	for i := range summaries {
		if summaries[i].Access.permits(callerID, summaries[i].CreatorID, callerOrgIDs) {
			out = append(out, summaries[i])
		}
	}
	return out, nil
}

// CanAccessResource reports whether callerID — already proven to be a member of
// the Project by the transport gate — additionally passes the resource's access
// scope. It is the single resolver both the catalog reads and the direct
// document-read guard consult. A resource with no scope, or with no attribute
// store configured, is visible to every member. A missing resource surfaces the
// family's not-found error so callers can 404 rather than silently deny.
func (r *Resources) CanAccessResource(callerID string, projectID string, kind Kind, id string) (bool, error) {
	summary, err := r.Get(projectID, kind, id)
	if err != nil {
		return false, err
	}
	if summary.Access == nil {
		return true, nil
	}
	var callerOrgIDs []string
	if r.orgs != nil && callerID != "" {
		callerOrgIDs, err = r.orgs.UserOrgIDs(callerID)
		if err != nil {
			return false, err
		}
	}
	return summary.Access.permits(callerID, summary.CreatorID, callerOrgIDs), nil
}

func (r *Resources) Create(projectID string, actor Actor, kind Kind, name string) (Summary, error) {
	family, err := r.family(kind)
	if err != nil {
		return Summary{}, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return Summary{}, ErrInvalidName
	}
	return family.Create(projectID, actor, name)
}

func (r *Resources) Rename(projectID string, actor Actor, kind Kind, id, name string) (Summary, error) {
	family, err := r.family(kind)
	if err != nil {
		return Summary{}, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return Summary{}, ErrInvalidName
	}
	return family.Rename(projectID, actor, id, name)
}

func (r *Resources) Delete(projectID string, actor Actor, kind Kind, id string) error {
	family, err := r.family(kind)
	if err != nil {
		return err
	}
	return family.Delete(projectID, actor, id)
}

func (r *Resources) family(kind Kind) (Family, error) {
	if !knownKinds[kind] {
		return nil, ErrUnknownKind
	}
	family, ok := r.families[kind]
	if !ok {
		return nil, ErrUnavailableKind
	}
	return family, nil
}

func sortSummaries(summaries []Summary) {
	sort.Slice(summaries, func(i, j int) bool {
		if !summaries[i].UpdatedAt.Equal(summaries[j].UpdatedAt) {
			return summaries[i].UpdatedAt.After(summaries[j].UpdatedAt)
		}
		if summaries[i].Kind != summaries[j].Kind {
			return summaries[i].Kind < summaries[j].Kind
		}
		return summaries[i].ID < summaries[j].ID
	})
}

type cursorPayload struct {
	Version int    `json:"v"`
	At      string `json:"at"`
	Kind    Kind   `json:"kind"`
	ID      string `json:"id"`
}

// Resolve resolves a selector to a stable resource locator. It authorizes
// access before returning the locator. When ID is set, it takes precedence;
// otherwise it resolves by exact name (plus optional kind filter). An
// ambiguous name (more than one visible match) returns ErrNameAmbiguous.
func (r *Resources) Resolve(ctx context.Context, scope ProjectScope, selector ResourceSelector) (ResourceLocator, error) {
	if err := ctx.Err(); err != nil {
		return ResourceLocator{}, err
	}
	if strings.TrimSpace(scope.ProjectID) == "" || strings.TrimSpace(scope.CallerID) == "" {
		return ResourceLocator{}, ErrAccessDenied
	}
	if selector.ID != "" {
		candidates := r.available
		if selector.Kind != "" {
			if !knownKinds[selector.Kind] {
				return ResourceLocator{}, ErrUnknownKind
			}
			candidates = []Kind{selector.Kind}
		}
		for _, kind := range candidates {
			summary, err := r.Get(scope.ProjectID, kind, selector.ID)
			if errors.Is(err, ErrNotFound) {
				continue
			}
			if err != nil {
				return ResourceLocator{}, err
			}
			allowed, err := r.CanAccessResource(scope.CallerID, scope.ProjectID, kind, summary.ID)
			if err != nil {
				return ResourceLocator{}, err
			}
			if !allowed {
				return ResourceLocator{}, ErrNotFound
			}
			return ResourceLocator{ResourceID: summary.ID, Kind: kind}, nil
		}
		return ResourceLocator{}, ErrNotFound
	}

	if selector.Name == "" {
		return ResourceLocator{}, ErrInvalidSelector
	}
	if selector.Kind != "" && !knownKinds[selector.Kind] {
		return ResourceLocator{}, ErrUnknownKind
	}

	// Resolve by exact name over the catalog's caller-filtered view. Going through
	// List is essential: direct Family.List results have not had catalog access
	// attributes merged yet, and would expose private names to a non-member.
	var matches []ResourceLocator
	cursor := ""
	for {
		if err := ctx.Err(); err != nil {
			return ResourceLocator{}, err
		}
		page, err := r.List(scope.ProjectID, PageRequest{Limit: MaxLimit, Cursor: cursor})
		if err != nil {
			return ResourceLocator{}, err
		}
		visible, err := r.FilterAccessible(scope.CallerID, page.Resources)
		if err != nil {
			return ResourceLocator{}, err
		}
		for _, item := range visible {
			if item.Name == selector.Name && (selector.Kind == "" || item.Kind == selector.Kind) {
				matches = append(matches, ResourceLocator{ResourceID: item.ID, Kind: item.Kind})
				if len(matches) > 1 {
					return ResourceLocator{}, ErrNameAmbiguous
				}
			}
		}
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}

	if len(matches) == 0 {
		return ResourceLocator{}, ErrNotFound
	}
	if len(matches) > 1 {
		return ResourceLocator{}, ErrNameAmbiguous
	}
	return matches[0], nil
}

// Read reads the current content of the resource identified by the selector.
// It resolves the resource, authorizes access, opens the projection, and
// returns the bounded content.
func (r *Resources) Read(ctx context.Context, scope ProjectScope, req ExactReadRequest) (ExactReadResult, error) {
	locator, err := r.Resolve(ctx, scope, req.Selector)
	if err != nil {
		return ExactReadResult{}, err
	}

	// Override projection/subpath from the request.
	if req.Projection != "" {
		locator.Projection = req.Projection
	}
	if req.Subpath != "" {
		locator.Subpath = req.Subpath
	}
	if locator.Projection == "" {
		locator.Projection = "text"
	}

	startLine, endLine := req.StartLine, req.EndLine
	expectedVersion := req.ExpectedVersion
	var cursor readCursor
	if req.Cursor != "" {
		if req.StartLine != 0 || req.EndLine != 0 {
			return ExactReadResult{}, ErrReadCursorInvalid
		}
		cursor, err = r.decodeReadCursor(req.Cursor, scope, locator)
		if err != nil {
			return ExactReadResult{}, err
		}
		startLine = cursor.NextLine
		if expectedVersion != "" && expectedVersion != cursor.Version {
			return ExactReadResult{}, ErrVersionChanged
		}
		expectedVersion = cursor.Version
	}

	// Reauthorize immediately before opening origin bytes. A locator is only an
	// identity hint; it never carries authorization across a policy change.
	summary, err := r.Get(scope.ProjectID, locator.Kind, locator.ResourceID)
	if err != nil {
		return ExactReadResult{}, err
	}
	allowed, err := r.CanAccessResource(scope.CallerID, scope.ProjectID, locator.Kind, locator.ResourceID)
	if err != nil {
		return ExactReadResult{}, err
	}
	if !allowed {
		return ExactReadResult{}, ErrNotFound
	}

	readable, ok := r.readableFamilies[locator.Kind]
	if !ok {
		return ExactReadResult{}, ErrProjectionUnsupported
	}

	byteLimit := MaxExactReadBytes
	lineLimit := maxReadLines
	proj, err := readable.OpenProjection(ctx, scope, locator, ProjectionRequest{
		Subpath:         req.Subpath,
		StartLine:       startLine,
		EndLine:         endLine,
		Cursor:          req.Cursor,
		ExpectedVersion: expectedVersion,
		ByteLimit:       byteLimit,
		LineLimit:       lineLimit,
	})
	if err != nil {
		return ExactReadResult{}, err
	}
	defer proj.Text.Close()

	raw, err := readProjection(ctx, proj.Text, MaxExactReadBytes)
	if err != nil {
		return ExactReadResult{}, err
	}
	rawHash := contentHash(raw)
	if proj.ContentHash != "" && proj.ContentHash != rawHash {
		return ExactReadResult{}, ErrVersionChanged
	}
	version := proj.Version
	if version == "" {
		version = rawHash
	}
	if expectedVersion != "" && version != expectedVersion {
		return ExactReadResult{}, ErrVersionChanged
	}
	if req.Cursor != "" && cursor.Version != version {
		return ExactReadResult{}, ErrVersionChanged
	}

	text := NormalizeNewlines(string(raw))
	slicer := DefaultLineSlicer()
	slicer.MaxTotalBytes = MaxExactReadBytes
	if err := ValidateTextProjection(text, slicer.MaxLineBytes); err != nil {
		return ExactReadResult{}, err
	}
	sliced, actualStart, actualEnd, truncated := slicer.Slice(text, startLine, endLine)

	// Build the result.
	result := ExactReadResult{
		Resource: ResourceSummary{
			ID:      locator.ResourceID,
			Kind:    locator.Kind,
			Name:    summary.Name,
			Version: version,
		},
		Locator:     locator,
		Version:     version,
		ContentHash: contentHash([]byte(text)),
		Projection:  locator.Projection,
		StartLine:   actualStart,
		EndLine:     actualEnd,
		Text:        sliced,
		Truncated:   truncated,
		Provenance:  Provenance{Origin: "direct"},
	}
	if truncated && actualEnd < LineCount(text) {
		result.NextCursor, err = r.encodeReadCursor(scope, locator, version, actualEnd+1, slicer)
		if err != nil {
			return ExactReadResult{}, err
		}
	}
	return result, nil
}

// maxReadLines is the default maximum number of lines a single Read may return.
const maxReadLines = 2000

func readProjection(ctx context.Context, reader io.Reader, limit int) ([]byte, error) {
	buf := make([]byte, 32*1024)
	var out bytes.Buffer
	emptyReads := 0
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		n, err := reader.Read(buf)
		if n > 0 {
			emptyReads = 0
			if out.Len()+n > limit {
				return nil, ErrReadLimitExceeded
			}
			_, _ = out.Write(buf[:n])
		}
		if n == 0 && err == nil {
			emptyReads++
			if emptyReads == 100 {
				return nil, io.ErrNoProgress
			}
		}
		if errors.Is(err, io.EOF) {
			return out.Bytes(), nil
		}
		if err != nil {
			return nil, err
		}
	}
}

func contentHash(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

func encodeCursor(summary Summary) string {
	b, _ := json.Marshal(cursorPayload{Version: 1, At: summary.UpdatedAt.UTC().Format(time.RFC3339Nano), Kind: summary.Kind, ID: summary.ID})
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeCursor(cursor string) (Boundary, error) {
	b, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return Boundary{}, ErrInvalidCursor
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	var payload cursorPayload
	if err := dec.Decode(&payload); err != nil {
		return Boundary{}, ErrInvalidCursor
	}
	var extra any
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return Boundary{}, ErrInvalidCursor
	}
	if payload.Version != 1 || payload.ID == "" || !knownKinds[payload.Kind] {
		return Boundary{}, ErrInvalidCursor
	}
	at, err := time.Parse(time.RFC3339Nano, payload.At)
	if err != nil {
		return Boundary{}, ErrInvalidCursor
	}
	return Boundary{UpdatedAt: at.UTC(), Kind: payload.Kind, ID: payload.ID}, nil
}
