# Document-scoped agent tasks (BR-AI-TASK-DOCSCOPE)

A document view needs to show the agent tasks that concern it — the plans and
actions spawned against that document. This scopes a task to an optional target
document and adds a document filter to the task list.

## Domain: `core/capability/agent`

- **`Task.TargetDocumentID`** — the document a task is pinned to; empty means the
  task is not tied to a specific document.
- `Tasks.Create`, `Workflows.CreatePlan`, and `Workflows.CreateAction` take a
  `targetDocumentID` and stamp it on the task.
- **`Tasks.ListByDocument(scope, documentID)`** returns the project's tasks whose
  `TargetDocumentID` matches, in creation order; tasks with no target are
  excluded. Backed by a new `TaskStore.TasksByDocument`.
- Chat-driven Plan/Action turns pass the chat's `resourceId` as the target, so a
  document-pinned chat's tasks surface under that document.

## Persistence

The whole task already round-trips as JSON `content`, so `TargetDocumentID`
persists automatically. Added a denormalized `target_document_id` column (with a
`(project_id, target_document_id, created_at)` index) populated on insert, so the
filter is an indexed query rather than a JSON scan. `TargetDocumentID` is
immutable, so `UpdateTask` need not touch the column.

## Route

- `GET /agent/tasks?documentId=<id>` filters to that document's tasks (still
  project-scoped); no `documentId` lists the whole project as before.

## Tests

- **Unit** (`agent_test.go` `TestAgentListByDocument`): the handler returns only
  the matching document's task, empty for a document with none, and all tasks
  unfiltered.
- **Integration** (`dev-test/task-scope/run.sh`, no model, always runs): create
  Actions scoped to two documents plus one unscoped; each document filter returns
  exactly its task, the unfiltered list returns all three, and a document with no
  tasks is empty. (Queued runs fail without a provider — the filter is
  state-independent.)
