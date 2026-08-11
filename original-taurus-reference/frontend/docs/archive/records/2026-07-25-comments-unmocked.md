# Anchored comments un-mocked (B3)

Replace the mock Comments panel with real Omega anchored comments. Verified end-to-end against a
fresh Omega build on `:8444`.

## Omega (reverses the old "blocked" status)

`GET/POST /documents/:id/comments`, `PATCH/DELETE /comments/:id`, `POST /comments/:id/replies`
(gated on `opts.Comments`). Comments pin to a document anchor — create takes an inline
`anchor: {rowId, blockId, atomId, start, end}` (or an existing `anchorId`).

## Changes

- New `systems/documents/comments.ts`: `loadComments`, `createComment` (inline anchor),
  `replyToComment`, `patchComment` (resolve/edit), `deleteComment`, + `DocumentComment`/`CommentReply`
  types.
- `CommentsPanel.svelte`: real list (open/all filter), a composer that anchors a new comment to the
  current editor selection's block, per-thread replies, and Resolve/Reopen. Loading/error/empty
  states; Mock badge gone; orphaned-anchor notice.
- `DetailsPanel.svelte`: "Add comment" now jumps to the Comments panel (`setPanel('context',
  {section:'comments'})`) — which anchors to the inspected block — instead of a mock toast.
- Removed `DocumentComment` + `mockDocumentComments` from `context.ts` (the real client owns the type
  now); updated the module doc comment (only the reference graph remains mock, until B5).

## Verification

- `:8444` (`opts.Comments` enabled): create anchored to a block → `201`; reply → `201`; resolve
  (patch) → `200`; list → the thread with body/resolved/replies/authorName correct.
- `svelte-check` clean; vitest 227/227; touched companions reproduce.

## Follow-up

"Go to comment" (scroll the editor to a comment's anchor) — not wired yet; the anchor id is available
for it. Verify against live `:8443` (`opts.Comments` must be enabled there).
