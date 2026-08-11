# identity.go

Batch identity resolver: POST /projects/:id/identities/resolve turns a mixed list of typed references (users + AI personas) into public profile cards in one project-authorized call, deduplicated, with deleted/inaccessible references reported in `unavailable`. Composes the access and persona capabilities at the handler layer so they stay independent. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package identity serves a batch, project-authorized identity resolver: it turns
// a mixed list of typed references (users and AI personas) into public profile
// cards, so a client keeps one deduplicated avatar/name cache instead of a
// different shape per feature (presence, comments, history, tasks, activity).
package identity

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// MaxIdentitiesPerRequest bounds one resolve batch.
const MaxIdentitiesPerRequest = 200

// Handlers resolve identity references over the access and persona capabilities.
// The composition lives here, at the handler layer, so the two capabilities stay
// independent of each other.
type Handlers struct {
	access   *access.Access
	personas *persona.Personas
}

// NewHandlers constructs the identity resolver handlers.
func NewHandlers(a *access.Access, p *persona.Personas) Handlers {
	return Handlers{access: a, personas: p}
}

type identityRef struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

// profileJSON is the unified public profile card. Optional fields are nullable so
// every caller tolerates their absence; email/role/avatar/createdAt are populated
// only when the source and policy provide them.
type profileJSON struct {
	ID          string  `json:"id"`
	Kind        string  `json:"kind"`
	Name        string  `json:"name"`
	Email       *string `json:"email"`
	AvatarURL   *string `json:"avatarUrl"`
	Role        *string `json:"role"`
	Description string  `json:"description"`
	CreatedAt   *string `json:"createdAt"`
}

// Resolve turns a batch of typed identity references into public profiles for the
// named project. The caller must be a member; deleted or inaccessible references
// are returned in `unavailable` rather than failing the whole request.
func (h Handlers) Resolve(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if _, err := h.access.MembershipRole(ctx.User.ID, projectID); err != nil {
		if errors.Is(err, access.ErrForbidden) {
			return errResp(http.StatusForbidden, "not a member of that project")
		}
		return errResp(http.StatusInternalServerError, "could not authorize project")
	}

	var in struct {
		Identities []identityRef `json:"identities"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if len(in.Identities) > MaxIdentitiesPerRequest {
		return errResp(http.StatusBadRequest, "too many identities in one request")
	}

	profiles := make([]profileJSON, 0, len(in.Identities))
	unavailable := make([]identityRef, 0)
	seen := make(map[identityRef]bool, len(in.Identities))
	for _, ref := range in.Identities {
		if seen[ref] {
			continue
		}
		seen[ref] = true
		profile, ok := h.resolveOne(projectID, ref)
		if ok {
			profiles = append(profiles, profile)
		} else {
			unavailable = append(unavailable, ref)
		}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"profiles": profiles, "unavailable": unavailable,
	}}
}

// resolveOne resolves a single reference, returning ok=false for an unknown kind
// or an inaccessible/deleted target.
func (h Handlers) resolveOne(projectID string, ref identityRef) (profileJSON, bool) {
	switch ref.Kind {
	case "user":
		pu, err := h.access.PublicUserInProject(projectID, ref.ID)
		if err != nil {
			return profileJSON{}, false
		}
		return userProfile(pu), true
	case "persona":
		if h.personas == nil {
			return profileJSON{}, false
		}
		rec, err := h.personas.Get(persona.Scope{ProjectID: projectID}, persona.Selection{ID: ref.ID})
		if err != nil {
			return profileJSON{}, false
		}
		return personaProfile(rec.Persona), true
	default:
		return profileJSON{}, false
	}
}

func userProfile(pu access.PublicUser) profileJSON {
	p := profileJSON{ID: pu.ID, Kind: "user", Name: pu.Name, Description: pu.Description}
	if pu.Email != "" {
		p.Email = strptr(pu.Email)
	}
	if pu.AvatarURL != "" {
		p.AvatarURL = strptr(pu.AvatarURL)
	}
	if pu.Role != "" {
		p.Role = strptr(pu.Role)
	}
	if !pu.CreatedAt.IsZero() {
		p.CreatedAt = strptr(pu.CreatedAt.UTC().Format(time.RFC3339Nano))
	}
	return p
}

func personaProfile(p persona.Persona) profileJSON {
	prof := profileJSON{ID: p.ID, Kind: "persona", Name: p.Name, Description: p.Description}
	if !p.CreatedAt.IsZero() {
		prof.CreatedAt = strptr(p.CreatedAt.UTC().Format(time.RFC3339Nano))
	}
	return prof
}

func strptr(s string) *string { return &s }

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}
```

### Failures carry their cause

Its one failure response (`could not authorize project`)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
