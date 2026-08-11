# Anchored comments (BR-COMMENTS)

Reviewers need to pin discussion to a specific place in a document and resolve it
when handled. This adds a project-scoped comment capability: a comment is bound
to a document anchor and carries an ordered thread of replies.

## New capability: `core/capability/comment`

- **`Comment`** `{id, documentId, anchorId, author, body, resolved,
  anchorOrphaned, replies}` and **`Reply`** `{id, commentId, author, body}`.
- **`Comments`** service:
  - `Create(scope, documentID, author, body, AnchorSelector)` — pins the comment
    to an existing anchor (by id) or an **inline target** the service
    materializes into one; refuses a comment with no anchor.
  - `List(scope, documentID, resolved *bool)` — comments in creation order,
    each with its replies loaded and its **`anchorOrphaned`** flag resolved from
    the current anchor state; optional open/resolved filter.
  - `Get`, `Patch` (body and/or resolved), `Delete` (cascades replies), `Reply`.
  - Every by-id op re-checks project scope: another project's comment reads as
    **not found**.
- **Ports:** `Store` and an injected **`AnchorReader`**
  (`AnchorInProject`, `CreateAnchor`) — so comment reaches document anchors
  without importing document.
- `MemoryStore`.

## Persistence: `document_comments` + `comment_replies`

Comments keyed by `(project_id, document_id)`; replies by `comment_id`.
`DeleteComment` removes a comment and its replies in one transaction.

## Wiring

`commentAnchors` adapts the document service to the `AnchorReader` port: it
validates an anchor via `ListAnchors` (reporting `orphaned` from the anchor's
state) and creates inline anchors via `CreateAnchor`.

## Routes

- `GET/POST /documents/:documentID/comments` (list, with `?resolved=`; create)
- `PATCH/DELETE /comments/:commentID`
- `POST /comments/:commentID/replies`

Writes require edit access; the by-id routes re-check project ownership.

## Tests

- **Unit** (`comment_test.go`): create against existing and inline anchors,
  no-anchor rejection, open/resolved filter, reply threading, delete cascade,
  cross-project isolation (get/patch/reply/delete), orphaned-anchor flag, scope
  required.
- **Integration** (`dev-test/comments/run.sh`, no model, always runs): inline
  anchor → open comment on a live anchor; bogus anchor rejected (404); reply
  thread ordered; resolve + open/resolved filters; delete cascades.
