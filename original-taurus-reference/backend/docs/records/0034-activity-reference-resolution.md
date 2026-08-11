# 0034 Activity reference resolution

This increment supplies the bounded, current-state lookups that Taurus Alpha's
real Activity feed needs, while leaving Activity as a historical projection and
Documents as the canonical owner of document changes.

## `core/capability/access/access.go` and `core/handlers/user/user.go`

### Expose a safe current-peer profile

`PublicUserInProject` first proves that the target is still a member of the
selected Project, then projects only `id` and `name`. The new handler maps it to
`GET /users/:userID`; it cannot disclose email, session, password, provider, or
role data. Former, foreign, and missing users are intentionally indistinguishable
at the point-read boundary (404), so Activity clients retain their stored actor
snapshot.

## `core/capability/document/document.go`, `core/capability/resource/resource.go`, and `core/wiring/resource_document.go`

### Resolve canonical Resource metadata through its owner

The Resource family contract gains a metadata-only `Get`, backed for Documents
by a project-scoped `Summary` that does not load content or replay changes.
`Resources.Get` keeps kind validation and family dispatch in the unified catalog
without adding a duplicate Resource store.

## `core/handlers/resource/resource.go` and `core/transport/transport.go`

### Serve selected-Project resource point reads

`GET /resources/:kind/:resourceID` returns a current common summary through the
same synchronous dispatch table as the catalog. It preserves the catalog's error
contract: unknown kind 400, recognized unavailable kind 409, and absent or
foreign target 404. The selected-Project transport group also owns the safe user
route, ensuring both caller and target are scoped before a client resolves a
reference.

## Tests and verification

### Cover current, renamed, inaccessible, and deleted states

Capability and transport tests prove membership-bounded user projection and the
new resource read across normal, renamed, read-member, deleted, unavailable, and
unknown-kind paths. The focused Go suite is run through the Nix development
environment.

## Companion and interface documentation

### Record the snapshot-plus-resolution boundary

Go companions, backend guide, capability documentation, and resource dev tests
now explain the deliberate split: `GET /activity` renders from immutable
snapshots in one bounded page; a client resolves current User or Resource state
only after the user selects the reference.
