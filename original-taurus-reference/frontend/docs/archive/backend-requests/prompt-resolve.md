# Backend request — promote prompt-block resolve to a stable route

**Priority:** Medium · **Status:** **Shipped** — Omega now serves
`POST /documents/:documentID/blocks/:blockID/resolve` (no `/dev`); the cockpit calls it
in [`data/documents.ts`](../../src/lib/data/documents.ts).
**Unblocked:** the inspector's prompt-block **Resolve** flow now runs over a production
route (same async 202 + job shape).

## What shipped

The document inspector configures prompt blocks: save an instruction (`set_prompt` op),
then **Resolve** through the stable route:

```http
POST /documents/:documentID/blocks/:blockID/resolve   { "mode": "" | "reload" | "refresh" }
  -> 202 { "jobId", "status": "queued" }  # then GET /jobs/:jobId until done/failed
```

Omega promoted the operation from `/dev` without changing the async 202 + job-polling
shape, so the existing inspector state machine continues to fit the contract.

Nice-to-haves, not blockers: a job `error` message when resolution fails (the UI
surfaces it in a toast today when present), and job progress states if resolution ever
reports stages.

## Front-end follow-up — done

`resolvePromptBlock` in `src/lib/data/documents.ts` calls the stable path. No UI change
was needed because polling and states already matched.
