# persona.go

Package `persona`. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package persona owns Project-local, versioned behavior profiles used by
// Quarterback workflows. A Persona shapes how work is performed; it is not an
// authority principal, a provider configuration, or a copy of Task history.
package persona

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	GeneralID          = "general"
	maxNameBytes       = 256
	maxDescription     = 4 * 1024
	maxGuidance        = 16 * 1024
	maxContextRefs     = 64
	maxContextRefBytes = 1024
)

// Scope is trusted application context supplied after Access has selected a
// Project. Persona IDs are only meaningful inside this scope.
type Scope struct {
	ProjectID string
}

// Definition is the immutable behavioral content of one Persona version.
// ContextReferences are identifiers for future context assembly; they do not
// grant access and are not automatically treated as factual evidence.
type Definition struct {
	Focus               string   `json:"focus"`
	BehavioralGuidance  string   `json:"behavioralGuidance"`
	ContextReferences   []string `json:"contextReferences"`
	DefaultVerification string   `json:"defaultVerification"`
	OutputPreferences   string   `json:"outputPreferences"`
}

// Persona is the stable Project-local identity and current-version pointer.
type Persona struct {
	ID             string    `json:"id"`
	ProjectID      string    `json:"projectId"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	CurrentVersion int       `json:"currentVersion"`
	CreatedBy      string    `json:"createdBy"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// Version is one immutable Persona definition. Revising appends a new Version
// and advances Persona.CurrentVersion; it never edits an older definition.
type Version struct {
	PersonaID  string     `json:"personaId"`
	ProjectID  string     `json:"projectId"`
	Version    int        `json:"version"`
	Definition Definition `json:"definition"`
	CreatedBy  string     `json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
}

// Snapshot is copied onto an Agent Task. It contains all behavior needed by a
// later run, so revising the Persona cannot rewrite historical task behavior.
type Snapshot struct {
	ID                  string   `json:"id"`
	Version             int      `json:"version"`
	Name                string   `json:"name"`
	Focus               string   `json:"focus"`
	Instructions        string   `json:"instructions"`
	ContextReferences   []string `json:"contextReferences"`
	DefaultVerification string   `json:"defaultVerification"`
	OutputPreferences   string   `json:"outputPreferences"`
}

// Selection names the exact Persona behavior requested for an Ask, Plan, or
// Action. Version zero means the Persona's current version at resolution time.
type Selection struct {
	ID      string `json:"personaId"`
	Version int    `json:"personaVersion,omitempty"`
}

// Record returns stable Persona metadata together with one exact version.
type Record struct {
	Persona Persona `json:"persona"`
	Version Version `json:"version"`
}

// Default records an explicit per-User/per-Project Persona preference. When a
// row is absent, DefaultForUser returns the Project's General Persona.
type Default struct {
	ProjectID string    `json:"projectId"`
	UserID    string    `json:"userId"`
	PersonaID string    `json:"personaId"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateRequest is the caller-controlled content for a new Persona. IDs,
// versions, Project, creator, and timestamps are service-owned.
type CreateRequest struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Definition  Definition `json:"definition"`
}

// UpdateRequest replaces the current editable metadata and behavioral
// definition while appending a new immutable Version. ExpectedVersion prevents
// one editor from silently overwriting another editor's work.
type UpdateRequest struct {
	ExpectedVersion int        `json:"expectedVersion"`
	Name            string     `json:"name"`
	Description     string     `json:"description"`
	Definition      Definition `json:"definition"`
}

// Store persists stable Personas, immutable versions, and explicit defaults.
// Implementations must append a new version and advance CurrentVersion
// atomically under the expected version.
type Store interface {
	CreatePersona(Persona, Version) error
	UpdatePersonaVersion(Persona, Version, int) error
	DeletePersona(string, string) error
	PersonaByID(string, string) (Persona, error)
	PersonaVersion(string, string, int) (Version, error)
	PersonaVersions(string, string) ([]Version, error)
	PersonasByProject(string) ([]Persona, error)
	DefaultPersona(string, string) (Default, error)
	SetDefaultPersona(Default) error
}

// Options supplies the deployment-owned General Persona template. It is
// materialized lazily in each Project under the stable Project-local ID
// "general".
type Options struct {
	GeneralName        string
	GeneralDescription string
	GeneralDefinition  Definition
}

// Personas is the Project-local Persona service.
type Personas struct {
	store   Store
	general CreateRequest
	now     func() time.Time
}

var (
	ErrNotFound        = errors.New("persona: not found")
	ErrAlreadyExists   = errors.New("persona: already exists")
	ErrInvalid         = errors.New("persona: invalid")
	ErrVersionConflict = errors.New("persona: version conflict")
	ErrProjectScope    = errors.New("persona: outside the current Project")
	ErrManaged         = errors.New("persona: managed by application configuration")
)

// New constructs the capability. A blank General template receives a small
// built-in behavior suitable for focused tests; production supplies it from
// deployment configuration.
func New(store Store, opts Options) (*Personas, error) {
	if store == nil {
		return nil, errors.New("persona: store is required")
	}
	if strings.TrimSpace(opts.GeneralName) == "" {
		opts.GeneralName = "General"
	}
	if strings.TrimSpace(opts.GeneralDescription) == "" {
		opts.GeneralDescription = "General-purpose Project assistant"
	}
	if strings.TrimSpace(opts.GeneralDefinition.BehavioralGuidance) == "" {
		opts.GeneralDefinition.BehavioralGuidance = "Work from Project evidence, report uncertainty, and describe only effects confirmed by tools."
	}
	general := CreateRequest{Name: strings.TrimSpace(opts.GeneralName), Description: strings.TrimSpace(opts.GeneralDescription), Definition: cloneDefinition(opts.GeneralDefinition)}
	if err := validateCreate(general); err != nil {
		return nil, fmt.Errorf("persona: invalid General template: %w", err)
	}
	return &Personas{store: store, general: general, now: time.Now}, nil
}

// EnsureGeneral returns the Project's stable General Persona. It creates the
// first immutable version on first use and appends a system-owned version when
// the backend's frozen General template changes between deployments.
func (p *Personas) EnsureGeneral(scope Scope) (Record, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return Record{}, ErrProjectScope
	}
	for attempt := 0; attempt < 4; attempt++ {
		record, err := p.get(scope, Selection{ID: GeneralID})
		switch {
		case err == nil && p.generalMatches(record):
			return record, nil
		case err == nil:
			now := p.now().UTC()
			updated := record.Persona
			updated.Name = p.general.Name
			updated.Description = p.general.Description
			updated.CurrentVersion++
			updated.UpdatedAt = now
			version := Version{PersonaID: GeneralID, ProjectID: scope.ProjectID, Version: updated.CurrentVersion, Definition: cloneDefinition(p.general.Definition), CreatedBy: "system", CreatedAt: now}
			if err := p.store.UpdatePersonaVersion(updated, version, record.Persona.CurrentVersion); errors.Is(err, ErrVersionConflict) {
				continue
			} else if err != nil {
				return Record{}, err
			}
			return Record{Persona: updated, Version: version}, nil
		case !errors.Is(err, ErrNotFound):
			return Record{}, err
		}

		now := p.now().UTC()
		item := Persona{ID: GeneralID, ProjectID: scope.ProjectID, Name: p.general.Name, Description: p.general.Description, CurrentVersion: 1, CreatedBy: "system", CreatedAt: now, UpdatedAt: now}
		version := Version{PersonaID: item.ID, ProjectID: item.ProjectID, Version: 1, Definition: cloneDefinition(p.general.Definition), CreatedBy: "system", CreatedAt: now}
		if err := p.store.CreatePersona(item, version); errors.Is(err, ErrAlreadyExists) {
			continue
		} else if err != nil {
			return Record{}, err
		}
		return Record{Persona: item, Version: version}, nil
	}
	return Record{}, ErrVersionConflict
}

// Create adds a stable Persona and immutable version 1 inside the current
// Project.
func (p *Personas) Create(scope Scope, creatorID string, req CreateRequest) (Record, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return Record{}, ErrProjectScope
	}
	if strings.TrimSpace(creatorID) == "" {
		return Record{}, ErrInvalid
	}
	if err := validateCreate(req); err != nil {
		return Record{}, err
	}
	now := p.now().UTC()
	persona := Persona{ID: newID(), ProjectID: scope.ProjectID, Name: strings.TrimSpace(req.Name), Description: strings.TrimSpace(req.Description), CurrentVersion: 1, CreatedBy: creatorID, CreatedAt: now, UpdatedAt: now}
	version := Version{PersonaID: persona.ID, ProjectID: scope.ProjectID, Version: 1, Definition: cloneDefinition(req.Definition), CreatedBy: creatorID, CreatedAt: now}
	if err := p.store.CreatePersona(persona, version); err != nil {
		return Record{}, err
	}
	return Record{Persona: persona, Version: version}, nil
}

// Revise appends an immutable Persona version when expectedVersion still names
// the aggregate's current version.
func (p *Personas) Revise(scope Scope, creatorID, id string, expectedVersion int, definition Definition) (Record, error) {
	if strings.TrimSpace(creatorID) == "" || expectedVersion < 1 || validateDefinition(definition) != nil || strings.TrimSpace(scope.ProjectID) == "" || strings.TrimSpace(id) == "" {
		return Record{}, ErrInvalid
	}
	if id == GeneralID {
		return Record{}, ErrManaged
	}
	persona, err := p.store.PersonaByID(scope.ProjectID, id)
	if err != nil {
		return Record{}, err
	}
	if persona.ProjectID != scope.ProjectID {
		return Record{}, ErrProjectScope
	}
	if persona.CurrentVersion != expectedVersion {
		return Record{}, ErrVersionConflict
	}
	return p.update(scope, creatorID, persona, UpdateRequest{ExpectedVersion: expectedVersion, Name: persona.Name, Description: persona.Description, Definition: definition})
}

// Update replaces a custom Persona's name, description, and behavioral
// definition. The definition is preserved as a new immutable version while the
// stable Persona identity keeps its original creator and creation time.
func (p *Personas) Update(scope Scope, creatorID, id string, req UpdateRequest) (Record, error) {
	if strings.TrimSpace(creatorID) == "" || strings.TrimSpace(scope.ProjectID) == "" || strings.TrimSpace(id) == "" || req.ExpectedVersion < 1 {
		return Record{}, ErrInvalid
	}
	if id == GeneralID {
		return Record{}, ErrManaged
	}
	if err := validateCreate(CreateRequest{Name: req.Name, Description: req.Description, Definition: req.Definition}); err != nil {
		return Record{}, err
	}
	persona, err := p.store.PersonaByID(scope.ProjectID, id)
	if err != nil {
		return Record{}, err
	}
	if persona.ProjectID != scope.ProjectID {
		return Record{}, ErrProjectScope
	}
	if persona.CurrentVersion != req.ExpectedVersion {
		return Record{}, ErrVersionConflict
	}
	return p.update(scope, creatorID, persona, req)
}

func (p *Personas) update(scope Scope, creatorID string, persona Persona, req UpdateRequest) (Record, error) {
	now := p.now().UTC()
	version := Version{PersonaID: persona.ID, ProjectID: scope.ProjectID, Version: req.ExpectedVersion + 1, Definition: cloneDefinition(req.Definition), CreatedBy: creatorID, CreatedAt: now}
	persona.Name = strings.TrimSpace(req.Name)
	persona.Description = strings.TrimSpace(req.Description)
	persona.CurrentVersion, persona.UpdatedAt = version.Version, now
	if err := p.store.UpdatePersonaVersion(persona, version, req.ExpectedVersion); err != nil {
		return Record{}, err
	}
	return Record{Persona: persona, Version: version}, nil
}

// Delete removes a custom Persona and its version definitions. Store
// implementations also clear defaults that point to it. Agent Tasks retain
// their copied snapshots, so historical attribution survives the deletion.
func (p *Personas) Delete(scope Scope, id string) error {
	if strings.TrimSpace(scope.ProjectID) == "" || strings.TrimSpace(id) == "" {
		return ErrInvalid
	}
	if id == GeneralID {
		return ErrManaged
	}
	return p.store.DeletePersona(scope.ProjectID, id)
}

// Get resolves one exact version. Version zero selects the current pointer.
func (p *Personas) Get(scope Scope, selection Selection) (Record, error) {
	if strings.TrimSpace(scope.ProjectID) == "" || strings.TrimSpace(selection.ID) == "" || selection.Version < 0 {
		return Record{}, ErrInvalid
	}
	if selection.ID == GeneralID {
		if _, err := p.EnsureGeneral(scope); err != nil {
			return Record{}, err
		}
	}
	return p.get(scope, selection)
}

func (p *Personas) get(scope Scope, selection Selection) (Record, error) {
	persona, err := p.store.PersonaByID(scope.ProjectID, selection.ID)
	if err != nil {
		return Record{}, err
	}
	if persona.ProjectID != scope.ProjectID {
		return Record{}, ErrProjectScope
	}
	versionNumber := selection.Version
	if versionNumber == 0 {
		versionNumber = persona.CurrentVersion
	}
	version, err := p.store.PersonaVersion(scope.ProjectID, persona.ID, versionNumber)
	if err != nil {
		return Record{}, err
	}
	return Record{Persona: persona, Version: version}, nil
}

// Resolve converts an authorized selection into the immutable Task/runner
// snapshot used by Ask, Plan, or Action.
func (p *Personas) Resolve(scope Scope, selection Selection) (Snapshot, error) {
	record, err := p.Get(scope, selection)
	if err != nil {
		return Snapshot{}, err
	}
	return snapshot(record), nil
}

func (p *Personas) generalMatches(record Record) bool {
	want := p.general.Definition
	got := record.Version.Definition
	return record.Persona.Name == p.general.Name && record.Persona.Description == p.general.Description &&
		got.Focus == want.Focus && got.BehavioralGuidance == want.BehavioralGuidance &&
		got.DefaultVerification == want.DefaultVerification && got.OutputPreferences == want.OutputPreferences &&
		slices.Equal(got.ContextReferences, want.ContextReferences)
}

// List returns current Persona records in stable name/ID order. It guarantees
// the Project's General Persona exists first.
func (p *Personas) List(scope Scope) ([]Record, error) {
	if _, err := p.EnsureGeneral(scope); err != nil {
		return nil, err
	}
	personas, err := p.store.PersonasByProject(scope.ProjectID)
	if err != nil {
		return nil, err
	}
	sort.Slice(personas, func(i, j int) bool {
		if personas[i].Name == personas[j].Name {
			return personas[i].ID < personas[j].ID
		}
		return personas[i].Name < personas[j].Name
	})
	records := make([]Record, 0, len(personas))
	for _, item := range personas {
		version, err := p.store.PersonaVersion(scope.ProjectID, item.ID, item.CurrentVersion)
		if err != nil {
			return nil, err
		}
		records = append(records, Record{Persona: item, Version: version})
	}
	return records, nil
}

// Versions returns the immutable history for one Persona after proving the
// stable identity exists in the current Project.
func (p *Personas) Versions(scope Scope, id string) ([]Version, error) {
	if _, err := p.Get(scope, Selection{ID: id}); err != nil {
		return nil, err
	}
	return p.store.PersonaVersions(scope.ProjectID, id)
}

// SetDefault persists one exact Persona identity as the User's default within
// this Project. New versions become current for later front-end selections;
// existing Tasks retain their snapshots.
func (p *Personas) SetDefault(scope Scope, userID, personaID string) (Record, error) {
	if strings.TrimSpace(userID) == "" {
		return Record{}, ErrInvalid
	}
	record, err := p.Get(scope, Selection{ID: personaID})
	if err != nil {
		return Record{}, err
	}
	if err := p.store.SetDefaultPersona(Default{ProjectID: scope.ProjectID, UserID: userID, PersonaID: personaID, UpdatedAt: p.now().UTC()}); err != nil {
		return Record{}, err
	}
	return record, nil
}

// DefaultForUser returns the explicit per-User default or the Project's stable
// General Persona when no override has been stored. It does not choose a
// Persona during Task creation; the caller must pass the returned selection.
func (p *Personas) DefaultForUser(scope Scope, userID string) (Record, error) {
	if strings.TrimSpace(userID) == "" {
		return Record{}, ErrInvalid
	}
	selected, err := p.store.DefaultPersona(scope.ProjectID, userID)
	if errors.Is(err, ErrNotFound) {
		return p.EnsureGeneral(scope)
	}
	if err != nil {
		return Record{}, err
	}
	return p.Get(scope, Selection{ID: selected.PersonaID})
}

func snapshot(record Record) Snapshot {
	definition := record.Version.Definition
	return Snapshot{ID: record.Persona.ID, Version: record.Version.Version, Name: record.Persona.Name, Focus: definition.Focus, Instructions: definition.BehavioralGuidance, ContextReferences: append([]string(nil), definition.ContextReferences...), DefaultVerification: definition.DefaultVerification, OutputPreferences: definition.OutputPreferences}
}

func validateCreate(req CreateRequest) error {
	if strings.TrimSpace(req.Name) == "" || len(req.Name) > maxNameBytes || len(req.Description) > maxDescription {
		return ErrInvalid
	}
	return validateDefinition(req.Definition)
}

func validateDefinition(definition Definition) error {
	if strings.TrimSpace(definition.BehavioralGuidance) == "" || len(definition.Focus) > maxGuidance || len(definition.BehavioralGuidance) > maxGuidance || len(definition.DefaultVerification) > maxGuidance || len(definition.OutputPreferences) > maxGuidance || len(definition.ContextReferences) > maxContextRefs {
		return ErrInvalid
	}
	for _, ref := range definition.ContextReferences {
		if strings.TrimSpace(ref) == "" || len(ref) > maxContextRefBytes {
			return ErrInvalid
		}
	}
	return nil
}

func cloneDefinition(definition Definition) Definition {
	definition.Focus = strings.TrimSpace(definition.Focus)
	definition.BehavioralGuidance = strings.TrimSpace(definition.BehavioralGuidance)
	definition.DefaultVerification = strings.TrimSpace(definition.DefaultVerification)
	definition.OutputPreferences = strings.TrimSpace(definition.OutputPreferences)
	definition.ContextReferences = append([]string(nil), definition.ContextReferences...)
	return definition
}

func newID() string {
	bytes := make([]byte, 16)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// MemoryStore is a concurrency-safe Persona Store for deterministic tests.
type MemoryStore struct {
	mu       sync.Mutex
	personas map[string]Persona
	versions map[string]map[int]Version
	defaults map[string]Default
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{personas: map[string]Persona{}, versions: map[string]map[int]Version{}, defaults: map[string]Default{}}
}

func (s *MemoryStore) CreatePersona(persona Persona, version Version) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := personaKey(persona.ProjectID, persona.ID)
	if _, exists := s.personas[key]; exists {
		return ErrAlreadyExists
	}
	s.personas[key], s.versions[key] = clonePersona(persona), map[int]Version{version.Version: cloneVersion(version)}
	return nil
}

func (s *MemoryStore) UpdatePersonaVersion(persona Persona, version Version, expectedVersion int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := personaKey(persona.ProjectID, persona.ID)
	current, exists := s.personas[key]
	if !exists {
		return ErrNotFound
	}
	if current.CurrentVersion != expectedVersion {
		return ErrVersionConflict
	}
	if _, exists := s.versions[key][version.Version]; exists {
		return ErrAlreadyExists
	}
	s.versions[key][version.Version], s.personas[key] = cloneVersion(version), clonePersona(persona)
	return nil
}

func (s *MemoryStore) DeletePersona(projectID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := personaKey(projectID, id)
	if _, exists := s.personas[key]; !exists {
		return ErrNotFound
	}
	delete(s.personas, key)
	delete(s.versions, key)
	for key, item := range s.defaults {
		if item.ProjectID == projectID && item.PersonaID == id {
			delete(s.defaults, key)
		}
	}
	return nil
}

func (s *MemoryStore) PersonaByID(projectID, id string) (Persona, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	persona, ok := s.personas[personaKey(projectID, id)]
	if !ok {
		return Persona{}, ErrNotFound
	}
	return clonePersona(persona), nil
}

func (s *MemoryStore) PersonaVersion(projectID, id string, version int) (Version, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.versions[personaKey(projectID, id)][version]
	if !ok {
		return Version{}, ErrNotFound
	}
	return cloneVersion(item), nil
}

func (s *MemoryStore) PersonaVersions(projectID, id string) ([]Version, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	items, ok := s.versions[personaKey(projectID, id)]
	if !ok {
		return nil, ErrNotFound
	}
	versions := make([]Version, 0, len(items))
	for _, item := range items {
		versions = append(versions, cloneVersion(item))
	}
	sort.Slice(versions, func(i, j int) bool { return versions[i].Version < versions[j].Version })
	return versions, nil
}

func (s *MemoryStore) PersonasByProject(projectID string) ([]Persona, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var personas []Persona
	for _, item := range s.personas {
		if item.ProjectID == projectID {
			personas = append(personas, clonePersona(item))
		}
	}
	return personas, nil
}

func (s *MemoryStore) DefaultPersona(projectID, userID string) (Default, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.defaults[defaultKey(projectID, userID)]
	if !ok {
		return Default{}, ErrNotFound
	}
	return item, nil
}

func (s *MemoryStore) SetDefaultPersona(item Default) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.personas[personaKey(item.ProjectID, item.PersonaID)]; !ok {
		return ErrNotFound
	}
	s.defaults[defaultKey(item.ProjectID, item.UserID)] = item
	return nil
}

func personaKey(projectID, id string) string     { return projectID + "\x00" + id }
func defaultKey(projectID, userID string) string { return projectID + "\x00" + userID }

func clonePersona(item Persona) Persona {
	raw, _ := json.Marshal(item)
	var clone Persona
	_ = json.Unmarshal(raw, &clone)
	return clone
}

func cloneVersion(item Version) Version {
	raw, _ := json.Marshal(item)
	var clone Version
	_ = json.Unmarshal(raw, &clone)
	return clone
}
```
