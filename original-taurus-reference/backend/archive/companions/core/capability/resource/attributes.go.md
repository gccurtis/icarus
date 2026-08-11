# attributes.go

Resource catalog attributes: the Attributes value (today a pin flag) and the AttributeStore port that persists them per (project, kind, resource), independent of the family that owns the resource's content. See repo conventions (AGENTS.md).

## Code breakdown

```go
package resource

// Attributes are catalog-level, cross-kind metadata a project keeps on a
// resource, independent of the family that owns the resource's content: the pin
// flag and an optional per-resource access scope. A nil Access is the default
// (project-wide); see AccessScope.
type Attributes struct {
	Pinned bool
	Access *AccessScope
}

// IsZero reports whether the attributes hold nothing worth storing, so a store
// can drop the row instead of keeping an all-default record.
func (a Attributes) IsZero() bool {
	return !a.Pinned && a.Access == nil
}

// AttributeStore persists a project's per-resource Attributes, keyed by
// (project, kind, resource id). Content stays with the family owner; only these
// catalog flags live here.
type AttributeStore interface {
	// ResourceAttributes returns a resource's attributes, or the zero value when
	// none are set.
	ResourceAttributes(projectID string, kind Kind, id string) (Attributes, error)
	// SetResourceAttributes replaces a resource's attributes.
	SetResourceAttributes(projectID string, kind Kind, id string, attrs Attributes) error
	// ResourceAttributesByProject returns every set attribute in a project, keyed
	// by kind and id, so a listing merges them in one read.
	ResourceAttributesByProject(projectID string) (map[AttributeKey]Attributes, error)
}

// AttributeKey identifies a resource within a project for the attribute map.
type AttributeKey struct {
	Kind Kind
	ID   string
}
```
