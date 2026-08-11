# Resource access scoping (Alpha gap G4b, sub-phase 4b)

A resource's owner can narrow who sees it: private (owner only), the whole
Project, specific people, an organization's members, or any **combination** of
those. This is **narrowing-only and the Project-scope invariant is absolute** —
to touch any resource you must be a Project member, always; a scope can only
*restrict within* that Project's members and can never grant access to a
non-member. Organizations never bypass Project membership; the `organization`
slice of a scope just selects the members who are also in that org.

## Model (`core/capability/resource`)

- **`AccessScope{ ProjectWide bool; OrgIDs, UserIDs []string }`** — a
  compositional allow-set. A Project member sees the resource when ANY holds:
  `ProjectWide`, the caller is the owner (always), the caller is in one of
  `OrgIDs`, or the caller is in `UserIDs`. `ProjectWide=false` with empty lists =
  **private** (owner only). A **nil** `*AccessScope` is the project-wide default,
  so an un-scoped resource behaves exactly as before.
- **Owner = the family creator.** `Summary` gains `CreatorID`, projected from the
  owning family (`document.Summary.CreatorID`). It is the identity that always
  retains access and the only one permitted to change the scope.
- `Attributes` (record 0071) gains `Access *AccessScope`; `IsZero` now means "no
  pin and no scope", so the attribute row is dropped when a resource is
  unrestricted — the table only ever holds real restrictions.
- **`OrgMembershipResolver{ UserOrgIDs(userID) ([]string, error) }`** — the narrow
  port the resolver needs from the organization capability (record 0074), injected
  via `UseOrgMembership`. Nil means org-scoped access matches nobody but the owner.
- One resolver, consulted everywhere: **`CanAccessResource(callerID, projectID,
  kind, id)`** — fetches the owner + stored scope + the caller's org ids and
  decides. `FilterAccessible(callerID, summaries)` filters a listing with a single
  org lookup (using each summary's already-merged scope). `SetAccess(callerID, …,
  scope)` is **owner-only** and normalizes a scope that admits everyone back to the
  default (clearing the row). `ResourceAccess` returns the effective scope.

## Enforcement — one check, two surfaces

Per the design decision, enforcement is **one extra check layered on the existing
Project gate**, and the catalog and the direct document routes share the SAME
resolver (the "direct path underneath"), so a restricted document cannot be seen
in the catalog *or* opened by URL:

- **Resource catalog** (`core/handlers/resource`): `GET /resources/:kind/:id`
  calls `CanAccessResource` → `403` when denied; `GET /resources` filters the page
  through `FilterAccessible`. NextCursor is keyed to the raw page boundary, so
  filtering never terminates pagination early.
- **Direct document routes** (`core/transport`): a `documentAccessGuard`
  middleware on the `scoped` group runs after `requireProject` and, for any route
  that names a `:documentID`, calls `CanAccessResource(user, project, document,
  id)` → `403` when denied. It self-skips routes without a `:documentID` and
  passes resolver errors through so the handler still produces the real response
  (e.g. `404` for a missing document). **Comments and agent-tool paths are a
  documented follow-up.**

Every capability's own `Scope` check is unchanged; this is purely additive.

## Endpoint

`PATCH /resources/:kind/:resourceID/access { access }` (owner only) → the updated
summary, whose JSON now carries `creatorId` and the effective `access`.
Registered as sync operation `resources.patch_access`.

## Persistence

`resource_attributes` gains an `access TEXT` column holding the scope as JSON (empty
for the default). Read/write go through `encodeAccessScope`/`decodeAccessScope`;
a row is deleted when `Attributes.IsZero()`.

## Tests

- Unit (`core/capability/resource`): default admits every member; owner-only
  `SetAccess`; private admits only the owner; specific-people; organization scope
  via membership; the union of orgs+users+owner; opening back to everyone clears
  the stored scope; `FilterAccessible` hides a restricted resource from a
  non-permitted member.
- Dev-test (`dev-test/resource-access`, free): two Project members — the owner
  restricts a document to themselves, the other member loses it from the catalog
  AND is `403`'d on the direct route, the owner keeps full access, re-opening to
  the Project restores the member, and a non-owner is `403`'d on `PATCH …/access`.

## Settled

- Compositional allow-set; narrowing-only; Project invariant absolute. ✓
- Owner = family creator; owner-only scope changes. ✓
- One `CanAccessResource` resolver; catalog + direct doc-read enforcement. ✓
- Org membership narrows, never grants, Project access. ✓
- pdf/docx and comment/agent-tool enforcement remain out of scope / follow-up. ✓
