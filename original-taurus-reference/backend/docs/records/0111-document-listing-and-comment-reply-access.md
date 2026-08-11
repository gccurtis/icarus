# 0111 — Access scope on document listing (PRIV-1) & comment replies (PRIV-2)

Two intra-project privacy fixes from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)), both test-first.

## Why

A document can be restricted within its project to its owner + specific
users/orgs (a resource access scope). That scope was enforced on the `:documentID`
routes (via `documentAccessGuard`) and by the unified `/resources` catalog (via
`FilterAccessible`), but two paths leaked around it:

- **PRIV-1.** `GET /documents` returned every document in the project — id, name,
  creator, timestamps — with no access filter, so a member excluded from a
  restricted document could still enumerate its existence, name, and author. It
  also diverged from `/resources`, which does filter.
- **PRIV-2.** `comment.Reply` skipped the parent-document access check that
  `Patch` and `Delete` already applied, so an excluded member could reply on a
  comment attached to a document restricted from them.

Both are intra-project metadata/interaction leaks, not cross-project (the project
boundary held); this closes the narrowing gap.

## The shape of the fix

Rather than hand either HTTP handler the whole `resource.Resources` service to
make one boolean check, both now take an injected

```go
canAccess func(callerID, projectID, documentID string) (bool, error)
```

wired in transport from `resource.CanAccessResource(..., resource.KindDocument, ...)`
— the same resolver the catalog and the `:documentID` guard use. This keeps the
handlers decoupled from the resource capability (the comment handler dropped its
`resource` import entirely) and makes the access rule trivially testable with a
fake.

## `core/handlers/document/document.go`

`Handlers` gained the `canAccess` field; `NewHandlers` takes it; `List` filters
the returned summaries through it before responding (a nil check lists everything,
for configurations without access scoping). Filtering runs per document — an
acceptable cost for a single-cell project and the same per-document check the
`:documentID` guard already makes; batching it is noted as a follow-up under
PERF.

## `core/handlers/comment/comment.go`

`authorizeComment` (already used by `Patch`/`Delete`) now consults the injected
`canAccess` instead of a concrete `*resource.Resources`, and `Reply` calls it
after its write-role check — so all three by-id comment mutations enforce the same
parent-document access scope.

## `core/transport/transport.go`

Builds one `docAccess` closure from `opts.Resources.CanAccessResource` (nil when
access scoping is not configured) and passes it to both the document and comment
handler constructors.

## Tests (written first, red before the fix)

- `core/handlers/document/list_access_test.go` —
  `TestListHidesInaccessibleDocuments`: a member sees only the unrestricted
  document, not the one restricted from them.
- `core/handlers/comment/reply_access_test.go` —
  `TestReplyDeniedWithoutDocumentAccess` (403 when the caller cannot access the
  comment's document) and `TestReplyAllowedWithDocumentAccess` (the control:
  access → the reply proceeds).
