# Capability — Icarus Comments Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502814da1a0d341d7264359).

## Summary / Concept
Comments is the third capability in the **Collaboration** build group. It owns durable threads, comment revisions, resolution state, and stable anchors to typed project targets. The capability referenced by an anchor owns the target content and decides whether that anchor is current, moved, orphaned, or removed.
### Prerequisites
- Project target-address contract.
- Stable target identity, revision, anchor-resolution, and safe-summary ports from every commentable capability.
- Database, IDs, clock, digest, logger, actor attribution, and the dual-queue runtime.
### Ownership
Comments owns thread and comment state, immutable comment body revisions, anchor observations, and comment ChangeSets. It does not copy or mutate target content. Reattachment is an explicit command.
### Runtime placement
```plain text
apps/backend/src/
  3-capabilities/
    comments/
      domain/
      application/
      ports/
      persistence/
      projections/
      index.ts
  4-job-wiring/
    comments/
      registerCommentEndpointMappings.ts
      createCommentJobs.ts
```
## Types & Interfaces
```typescript
import type { ProjectTargetRef } from "../project/public";

export interface CommentAnchor {
  target: ProjectTargetRef;
  observedTargetRevision: number;
  selectionHash?: string;
  state: "current" | "moved" | "orphaned" | "removed";
}

export interface CommentThread {
  id: string;
  revision: number;
  anchor: CommentAnchor;
  state: "open" | "resolved" | "archived";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  threadId: string;
  revision: number;
  authorId: string;
  body: string;
  mentions: string[];
  state: "active" | "deleted";
  createdAt: string;
  updatedAt: string;
}

export interface TargetAnchorResolver {
  resolve(anchor: CommentAnchor): Promise<CommentAnchor>;
}

export interface CommentsCommands {
  createThread(command: CreateThreadCommand): Promise<CommentThread>;
  addComment(command: AddCommentCommand): Promise<Comment>;
  apply(command: ApplyCommentChangesCommand): Promise<CommentThread>;
}

export interface CommentsReader {
  getThread(threadId: string): Promise<CommentThreadWithComments>;
  listByTarget(target: ProjectTargetRef): Promise<CommentThreadSummary[]>;
}
```
Stable IDs are authoritative. Visible position and selected text are descriptive evidence used by the target adapter.
## Runtime Objects
```typescript
export interface CommentsRuntime {
  commands: CommentsCommands;
  reader: CommentsReader;
  anchorScanner: CommentAnchorScanner;
}

export function createCommentsRuntime(deps: {
  repository: CommentsRepository;
  resolvers: TargetAnchorResolverRegistry;
  clock: Clock;
  ids: IdGenerator;
  actor: ActorAttribution;
  logger: Logger;
}): CommentsRuntime {
  const service = new CommentsService(deps);
  return {
    commands: service,
    reader: service,
    anchorScanner: new CommentAnchorScanner(deps)
  };
}
```
Thread mutations run in immediate transactions with revision compare-and-swap. A broad anchor recheck freezes a bounded target set, computes resolutions concurrently, and settles the results serially.
## Change Operations
```typescript
export type CommentChangeOperation =
  | { type: "add_comment"; comment: Comment }
  | { type: "edit_comment"; commentId: string; body: string; mentions: string[] }
  | { type: "delete_comment"; commentId: string }
  | { type: "resolve_thread" }
  | { type: "reopen_thread" }
  | { type: "archive_thread" }
  | { type: "set_anchor_state"; anchor: CommentAnchor }
  | { type: "reattach"; anchor: CommentAnchor };
```
Each accepted aggregate mutation stores forward and inverse operations and advances the thread revision exactly once. Comment edits append immutable body revisions. Deletion leaves a tombstone. Reattachment requires an explicit operator-confirmed operation.
## Endpoints
- `POST /comments/threads` — create a thread anchored to a typed target.
- `GET /comments/threads/:threadId` — get the thread and comments.
- `GET /comments/targets/:targetKind/:targetId` — list threads for a target.
- `POST /comments/threads/:threadId/comments` — add a comment.
- `PATCH /comments/threads/:threadId/comments/:commentId` — edit a comment.
- `DELETE /comments/threads/:threadId/comments/:commentId` — tombstone a comment.
- `POST /comments/threads/:threadId/resolve` — resolve.
- `POST /comments/threads/:threadId/reopen` — reopen.
- `POST /comments/threads/:threadId/reattach` — confirm a new anchor.
- `POST /internal/comments/anchors/recheck` — begin a bounded anchor recheck.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response</td>
<td>Calls / emits</td>
</tr>
<tr>
<td>Create thread or mutate thread/comment</td>
<td>\<code\>ApplyCommentCommandJob\</code\></td>
<td>Serial</td>
<td>Inline</td>
<td>Emits one or more \<code\>CommentChangeOperation\</code\> values</td>
</tr>
<tr>
<td>Get or list</td>
<td>\<code\>ReadCommentsJob\</code\></td>
<td>Concurrent</td>
<td>Inline</td>
<td>Calls \<code\>CommentsReader\</code\></td>
</tr>
<tr>
<td>\<code\>comments.anchors.recheck\</code\></td>
<td>\<code\>RequestAnchorRecheckJob\</code\></td>
<td>Serial</td>
<td>Deferred receipt</td>
<td>Freezes targets and emits scan intent</td>
</tr>
<tr>
<td>\<code\>comments.anchors.scan\</code\></td>
<td>\<code\>ScanCommentAnchorsJob\</code\></td>
<td>Concurrent</td>
<td>Internal result</td>
<td>Calls target resolvers and emits settlement intent</td>
</tr>
<tr>
<td>\<code\>comments.anchors.settle\</code\></td>
<td>\<code\>SettleCommentAnchorsJob\</code\></td>
<td>Serial</td>
<td>Internal result</td>
<td>Revalidates revision and emits \<code\>set_anchor_state\</code\></td>
</tr>
</table>
Every stage is keyed by thread, stage key, and request digest. A replay returns the stored result; a changed digest is `idempotency_mismatch`.
## SQL Tables
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE comment_threads (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_subpath_json TEXT CHECK (target_subpath_json IS NULL OR json_valid(target_subpath_json)),
  observed_target_revision INTEGER NOT NULL CHECK (observed_target_revision >= 1),
  selection_hash TEXT,
  anchor_state TEXT NOT NULL CHECK (anchor_state IN ('current', 'moved', 'orphaned', 'removed')),
  state TEXT NOT NULL CHECK (state IN ('open', 'resolved', 'archived')),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  CHECK (
    (state = 'resolved' AND resolved_at IS NOT NULL) OR
    (state != 'resolved')
  )
) STRICT;

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'deleted')),
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (
    (state = 'deleted' AND deleted_at IS NOT NULL) OR
    (state = 'active' AND deleted_at IS NULL)
  )
) STRICT;

CREATE TABLE comment_revisions (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  body TEXT NOT NULL,
  mentions_json TEXT NOT NULL CHECK (json_valid(mentions_json)),
  editor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (comment_id, revision)
) STRICT;

CREATE TABLE comment_changesets (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  revision_from INTEGER NOT NULL CHECK (revision_from >= 1),
  revision_to INTEGER NOT NULL CHECK (revision_to = revision_from + 1),
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  operations_json TEXT NOT NULL CHECK (json_valid(operations_json)),
  inverse_operations_json TEXT NOT NULL CHECK (json_valid(inverse_operations_json)),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (thread_id, revision_to),
  UNIQUE (thread_id, client_request_id)
) STRICT;

CREATE TABLE comment_thread_creation_receipts (
  client_request_id TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  thread_id TEXT NOT NULL UNIQUE REFERENCES comment_threads(id) ON DELETE CASCADE,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE comment_stage_receipts (
  thread_id TEXT NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'succeeded', 'failed')),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (thread_id, stage_key)
) STRICT;

CREATE INDEX comment_threads_target_state
  ON comment_threads (target_kind, target_id, state, updated_at DESC);
CREATE INDEX comment_threads_state_updated
  ON comment_threads (state, updated_at DESC);
CREATE INDEX comments_thread_created
  ON comments (thread_id, created_at);
CREATE INDEX comment_revisions_tail
  ON comment_revisions (comment_id, revision DESC);
CREATE INDEX comment_changesets_tail
  ON comment_changesets (thread_id, revision_to DESC);
CREATE INDEX comment_thread_creation_receipts_thread
  ON comment_thread_creation_receipts (thread_id);
CREATE INDEX comment_stages_pending
  ON comment_stage_receipts (state, updated_at)
  WHERE state IN ('pending', 'running');
```
Thread mutation, immutable comment revision insertion, receipt recording, and head compare-and-swap commit together.
## Invariants & Acceptance
- Every thread names one typed target and observed target revision.
- Every accepted command is digest-backed and idempotent.
- Comment edits preserve all earlier bodies.
- Target mutations remain with the target capability.
- Orphaned anchors stay visible until explicitly reattached or archived.
- Concurrent scans settle through a separate serial Job.
