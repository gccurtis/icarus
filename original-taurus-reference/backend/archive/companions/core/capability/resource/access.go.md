# access.go

Per-resource access scope: the compositional, NARROWING-ONLY allow-set (AccessScope{ProjectWide, OrgIDs, UserIDs}) layered on the absolute Project gate. Owner always retains access; false+empty = private. normalize (dedupe/cap, everyone→nil) and permits (the membership decision) helpers. See repo conventions (AGENTS.md).

## Code breakdown

```go
package resource

import "sort"

const (
	maxAccessOrgs  = 64
	maxAccessUsers = 256
)

// AccessScope narrows who, among a Project's members, may see a resource. It is
// a NARROWING-ONLY filter layered on top of the absolute Project gate: the
// effective audience is always a subset of the Project's members. It never
// grants access to a non-member, and an organization is only ever used to select
// a subset of members (members who are also in that org).
//
// The scope is a compositional allow-set. A caller who is a Project member may
// see the resource when ANY of the following holds:
//   - ProjectWide is true (every member), OR
//   - the caller is the resource's owner (always), OR
//   - the caller belongs to one of OrgIDs, OR
//   - the caller's id is in UserIDs.
//
// ProjectWide=false with empty OrgIDs and UserIDs means private — only the
// owner. A nil *AccessScope means the default, project-wide, so a resource with
// no scope set behaves exactly as before this capability existed.
type AccessScope struct {
	ProjectWide bool     `json:"projectWide"`
	OrgIDs      []string `json:"orgIds,omitempty"`
	UserIDs     []string `json:"userIds,omitempty"`
}

// DefaultAccessScope is the project-wide scope a resource has when none is set.
func DefaultAccessScope() AccessScope { return AccessScope{ProjectWide: true} }

// isEveryone reports whether the scope grants every Project member — the default.
// Such a scope is stored as "no scope" (nil) so the table only holds restrictions.
func (a AccessScope) isEveryone() bool {
	return a.ProjectWide && len(a.OrgIDs) == 0 && len(a.UserIDs) == 0
}

// normalizeAccessScope trims, de-duplicates, and sorts the id lists and caps
// their sizes. It returns a nil *AccessScope when the scope is the project-wide
// default, so an owner who "restricts" back to everyone clears the restriction.
func normalizeAccessScope(scope AccessScope) (*AccessScope, error) {
	orgs := dedupeSorted(scope.OrgIDs)
	users := dedupeSorted(scope.UserIDs)
	if len(orgs) > maxAccessOrgs || len(users) > maxAccessUsers {
		return nil, ErrInvalidAccessScope
	}
	out := AccessScope{ProjectWide: scope.ProjectWide, OrgIDs: orgs, UserIDs: users}
	if out.isEveryone() {
		return nil, nil
	}
	return &out, nil
}

// permits reports whether callerID (already known to be a Project member) passes
// the scope, given the owner and the caller's organization memberships. A nil
// scope (the default) always permits a member.
func (a *AccessScope) permits(callerID, ownerID string, callerOrgIDs []string) bool {
	if a == nil || a.ProjectWide {
		return true
	}
	if callerID != "" && callerID == ownerID {
		return true
	}
	for _, id := range a.UserIDs {
		if id == callerID {
			return true
		}
	}
	if len(a.OrgIDs) == 0 || len(callerOrgIDs) == 0 {
		return false
	}
	allowed := make(map[string]bool, len(a.OrgIDs))
	for _, id := range a.OrgIDs {
		allowed[id] = true
	}
	for _, id := range callerOrgIDs {
		if allowed[id] {
			return true
		}
	}
	return false
}

func cloneAccessScope(a *AccessScope) *AccessScope {
	if a == nil {
		return nil
	}
	out := AccessScope{
		ProjectWide: a.ProjectWide,
		OrgIDs:      append([]string(nil), a.OrgIDs...),
		UserIDs:     append([]string(nil), a.UserIDs...),
	}
	return &out
}

func dedupeSorted(ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(ids))
	var out []string
	for _, id := range ids {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}
```
