# AI-create wired to /resources/generate

Un-mock the "Create with AI" dialog — generating a document from a prompt via Omega's
`POST /resources/generate`. Verified on a fresh Omega build on `:8444`.

## Omega

`POST /resources/generate {kind, prompt, name?}` → `201 {resource: {id, kind, name, …}, taskId}`.
It creates the resource immediately and enqueues a generation task that populates it in the
background. **Documents only** (`400` for other kinds; `501` if generation isn't configured).

## Changes

- `systems/resources/api.ts`: new `generateResource(prompt)` → `POST /resources/generate` (document
  kind), maps the returned `resource` into the store, returns `{ resource, taskId }`.
- `NewTabStage.svelte`: `fromAi` now generates for documents (real; opens the new doc) and falls back
  to a plain create for other kinds (only documents are generatable today).
- `AiCreateDialog.svelte`: dropped the Mock badge + "not wired" copy; new copy explains documents are
  generated and other types start blank.

## Verification

- `:8444`: `POST /resources/generate {kind:'document', prompt}` → `201` with `{resource, taskId}`
  (resource created; the task populates it via the agent/engine — full content generation is
  engine-dependent, verify on `:8443`). `svelte-check` clean; vitest 227/227.

## Note

The resources system has no `.md` companions (established convention), so `api.ts`'s new function
follows suit; the two selective `.svelte.md` companions were updated.
