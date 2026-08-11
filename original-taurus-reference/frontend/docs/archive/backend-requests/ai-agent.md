# Backend request — AI Agent conversations, actions, plans, and context

**Priority:** High · **Status:** Open
**Unblocks:** the persistent AI Agent composer and inspector. Alpha currently
models Ask, Action, Plan, chats, context sources, file/folder attachment, and
plan detail as an explicitly badged frontend mock.

Omega already exposes low-level `/intelligence/reason`, `/intelligence/infer`, and
`/intelligence/embed` calls plus document prompt-block resolution. Those are useful
execution primitives, but they do not provide the persistent chats, scoped runs,
review state, plans, attachments, or task handoff described here, so this product
capability remains Open.

## What the front-end needs

The AI Agent is one resource-aware workflow, not a detached chat product:

- **Ask** answers from the current resource and enabled working context.
- **Action** applies a simple change directly when safe, or hands larger work to
  the existing task system with a stable task link.
- **Plan** creates a reviewable plan that can be opened in the inspector and
  continued from the composer.
- A submission creates a chat when none is selected and appends to the selected
  chat otherwise. Chats expose `chat | running | done` independently of the
  Ask/Action/Plan intent used by an individual message.
- Plan and task artifacts belong to a chat. Accepting a plan starts work in that
  chat; messages sent while work is running must reach the backing task.
- Context sources can include the current document, current selection, all project
  knowledge, linked sources, web access, uploaded files, and directory uploads.
  The user can inspect the resolved item list and remove individual items.

The server must return explicit execution state and traceability for material
actions: what context was used, what changed, whether the work was applied or
task-routed, and how to inspect or recover it.

## Proposed API (Omega owns the final shape)

```http
GET  /projects/:projectId/agent/chats?resourceId=:resourceId
  -> 200 { "chats": [{ "id", "title", "status", "updatedAt", "preview" }] }

POST /projects/:projectId/agent/chats
  { "resourceId", "mode" }
  -> 201 { "id", "title", "mode", "createdAt" }

GET  /projects/:projectId/agent/chats/:chatId
  -> 200 { "chat", "messages", "references", "plans" }

POST /projects/:projectId/agent/chats/:chatId/messages
  { "mode": "ask" | "action" | "plan", "prompt", "context" }
  -> 202 {
       "runId",
       "status": "resolving",
       "resultTarget": "reply" | "resource" | "task" | "plan"
     }

GET  /projects/:projectId/agent/runs/:runId
  -> 200 {
       "status": "resolving" | "needs_review" | "applied" | "failed",
       "message"?, "changeSetId"?, "taskId"?, "planId"?, "trace"?
     }

GET  /projects/:projectId/agent/plans/:planId
  -> 200 { "id", "title", "status", "steps", "chatId", "resourceId" }

POST /projects/:projectId/agent/plans/:planId/accept
  -> 202 { "runId", "taskId", "chatId", "status": "running" }

POST /projects/:projectId/agent/attachments
  multipart { "file" | "directoryManifest", "chatId" }
  -> 201 { "attachmentId", "name", "kind", "status" }
```

A streamed message/run transport is preferred, but polling is sufficient for the
first integration. Directory upload may be represented as a browser-provided
relative-path manifest plus files; Omega should define limits, scanning, and
retention.

## Front-end follow-up when this lands

Replace `src/lib/data/ai-agent.ts` mock state with a client boundary that maps
Omega sessions and runs into the current UI vocabulary. Wire Ask results, direct
Action change sets, task handoff links, Plan detail, chat persistence, references,
and attachments. Remove Mock badges capability by capability rather than treating
the surface as all-or-nothing.
