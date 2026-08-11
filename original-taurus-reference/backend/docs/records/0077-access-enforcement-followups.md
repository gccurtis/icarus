# Access-scope enforcement follow-ups: agent tools and by-id comments

Record 0075 enforced a resource's access scope on the catalog and every direct
`/documents/:documentID` route, and named two deferred surfaces: the agent's
document tools and the by-id comment routes. This closes both, reusing the same
`CanAccessResource` resolver so there is still exactly one access decision.

## Agent document tools

An agent runs a task on behalf of its requester (`Task.RequesterID`). Its
`document.get` / `document.edit` tools now consult a narrow **`DocumentAuthorizer`**
port on `Workflows` before reading or writing, so a task run for a user who has
been scoped out of a document cannot reach it through the agent either:

```go
// core/capability/agent/workflow.go
type DocumentAuthorizer interface {
    CanAccessDocument(userID, projectID, documentID string) (bool, error)
}
```

Wiring injects a `documentAuthorizer` adapter over the resource resolver
(`CanAccessResource(..., resource.KindDocument, id)`), so the agent capability
never imports the resource capability. A denial surfaces as a
`ToolError{Code: "access_denied"}` — a clean signal the model can act on rather
than an opaque failure. A nil authorizer (access scoping not configured) leaves
the tools Project-gated only. `resources` is now constructed before the agent
workflows in the composition root so the adapter can be injected.

## By-id comment routes

The document-scoped comment routes (`GET`/`POST /documents/:documentID/comments`)
were already covered by the transport's `documentAccessGuard` (they carry a
`:documentID`). The by-id routes (`PATCH`/`DELETE /comments/:commentID`) do not,
so they slipped past it. The comment handler now resolves the comment's parent
document (`comments.Get` exposes `DocumentID`) and checks `CanAccessResource`
before a patch or delete; a caller scoped out of the document gets `403`. The
resolver is injected into the comment handler (nil disables the check).

## Tests

- Unit (`core/capability/agent`): a denying authorizer makes `document.get` and
  `document.edit` return an `access_denied` ToolError; a permitted user still
  reads.
- Dev-test (`dev-test/resource-access`, free): extended so the owner leaves a
  comment, and once the document is restricted the scoped-out member is `403`'d on
  `PATCH` and `DELETE /comments/:id`, then can patch again after the owner
  re-opens the document.

## Settled

- One `CanAccessResource` resolver still makes every access decision. ✓
- Agent tools honor the requester's document access; denial is a clean ToolError. ✓
- By-id comment mutations are gated by the parent document's access scope. ✓
- Capabilities still don't import each other; wiring injects the adapters. ✓
