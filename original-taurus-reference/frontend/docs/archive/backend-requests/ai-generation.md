# Backend request — AI resource generation

**Priority:** Medium · **Status:** ✅ **Shipped** — `POST /resources/generate`; Alpha calls it from the new-tab launcher via `generateResource`.
**Unblocked:** the **Create with AI** flow on the new-tab launcher.

## What the front-end needs

From the new-tab launcher, a user can describe what they want ("a slide deck pitching
our Q3 launch") and pick a resource type, then hit **Generate**. The front-end needs an
endpoint that takes that prompt + kind and returns a **new resource** (ideally with
generated starting content once resource content is modeled).

The [Resource catalog](resources.md) dependency has shipped. Generating real *content*
still needs this endpoint plus a supported per-kind content model. Omega's low-level
Intelligence casts and ordinary Resource creation are available building blocks, but
there is no generation workflow that joins them, reports progress, and returns the
created Resource.

## Proposed API (Omega owns the final shape)

```http
POST /resources/generate   { "prompt", "kind" }
  -> 202 { "jobId" }                      # generation is likely async
GET  /jobs/:jobId
  -> 200 { "status": "running" | "done" | "error", "resource"? }

# or, if generation is fast/synchronous:
POST /resources/generate   { "prompt", "kind" }
  -> 201 { "id", "name", "kind", "createdAt", "updatedAt" }
```

Notes / open questions for Omega:

- **Async vs sync**: generation may take seconds — an async job (202 + poll, or a
  stream) is expected, but a synchronous create is fine to start. Tell us which and
  we'll model the UI (a "generating…" state on the tab).
- **Type inference**: the UI currently makes the user pick the kind. If the model can
  infer the best kind from the prompt, we can make the picker optional.
- **Relationship to AI Agent**: the floating AI Agent bar coordinates the *current*
  resource; this request is specifically *create a new resource*. Current-resource
  Ask/Action/Plan work is tracked separately in [ai-agent.md](ai-agent.md).
- **Templates**: the launcher's "Templates" are client-side presets today. If Omega
  wants to own a template catalog (server-defined starters), that's a small related
  endpoint (`GET /templates`) — optional.

## Front-end follow-up when this lands

Wire `src/lib/features/stages/new-tab/AiCreateDialog.svelte` (and its `oncreate` in
`NewTabStage.svelte`) to call the endpoint instead of creating an empty resource; add
a "generating…" state while the job runs. Drop the **Mock** badge on the dialog.
