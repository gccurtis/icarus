# Document AI Tasks panel un-mocked — real agent tasks from Omega

Goal 3.5 from the integration plan — replace the mock `mockDocumentAiTasks` array with real,
document-scoped Omega agent tasks. Verified live against a fresh build of Omega `main` on `:8444`.

## Not blocked — Omega filters tasks by document

The plan flagged a possible `BR-AI-TASK-DOCSCOPE` gap. Confirmed unnecessary: `GET /agent/tasks`
accepts a `?documentId=` query and the handler routes it to `TasksByDocument(projectID, documentID)`
(`Task.targetDocumentId` scopes each task). A task created against one document does not appear
under another.

## New `$systems/documents/ai-tasks.ts` client

- Mirrors the Omega `Task` record (`mode` plan/action, seven-value `state`, `objective`,
  `targetDocumentId`, `persona`, `plans`, `runs`) and flattens it into a display `DocumentAiTask`.
- `loadDocumentAiTasks(documentId)` → `GET /agent/tasks?documentId=` (server-side projection).
- `createDocumentAiTask(...)` → `POST /agent/plans` (review) or `POST /agent/actions` (apply),
  scoping the task to the document and running it under a persona.
- Maps each state to a display label + an `active` (non-terminal) flag, and composes a detail line
  from the richest field available (run failure → plan summary → mode/step fallback).

## AiTasksPanel now real

`AiTasksPanel.svelte` drops the mock array, the `MockBadge`, and the "· Mock" modal titles. It
loads the open document's tasks (via the editor-session `docId`, reloading on document change) with
loading/error/empty states, and its "New AI task" modal creates a real Plan or Action task under
the project's default persona (loaded from `$systems/personas`), then reloads. Relative times come
from the task `updatedAt`.

## Verification

- Live on `:8444`: `POST /agent/actions {objective, persona:{personaId}, targetDocumentId}` → `201`
  (task `queued`, persona resolved, target set); `GET /agent/tasks?documentId=<doc>` returns that
  task; a different document id returns `0` (scoping holds).
- `svelte-check` clean (0 errors).

## Still mocked / out of scope

Task *execution* depends on Omega's AI engine being configured; creating a task always succeeds
(queued), but whether it completes/edits the document is the engine's concern, exercised more fully
by the AI dock (Goal 3.3). Accepting a plan (`…/plans/:planID/accept`) is wired at the client layer
via the dock, not this read-focused panel.
