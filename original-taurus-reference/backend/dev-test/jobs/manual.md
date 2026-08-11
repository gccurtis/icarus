# Manual test: background jobs

This is the by-hand version of [`run.sh`](run.sh). It shows the **async
dispatch** path: re-basing a document is background maintenance, so the request
**enqueues a job** and returns `202 Accepted` with a **job id**; a worker runs
the job off the request path, and you **poll** the job id for its status.

The core serves **HTTPS** (self-signed in dev), so `curl` uses `-k`, with the
session cookie in `-b cookies.txt`.

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- Start the core (`go run ./core`), sign in, **select a project** (see the
  [projects manual](../projects/manual.md)), and create a document (see the
  [documents manual](../documents/manual.md)). Call its id `<DOC_ID>`.

## Why re-base is a job

Most endpoints are **synchronous**: a read returns a body now, and an edit
returns its change set (with a server-assigned `seq`, or a `409` on conflict)
now. A **hardcoded operation → synctype map** in the transport layer decides
this per operation. Re-basing — folding pending change sets into a new base and
pruning old history — is deferrable maintenance, so it is mapped **async**: the
request does not wait for it.

## Enqueue a re-base

```bash
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/dev/documents/<DOC_ID>/rebase
```

Response is `202 Accepted` with a job id and its initial status:

```json
{"jobId":"<JOB_ID>","status":"queued"}
```

## Poll the job

```bash
curl -k -b cookies.txt https://127.0.0.1:8080/dev/jobs/<JOB_ID>
```

While it waits or runs you'll see `"status":"queued"` or `"running"`; once a
worker finishes it, `"status":"done"`:

```json
{"id":"<JOB_ID>","type":"document.rebase","status":"done","attempts":1,"maxAttempts":5,"createdAt":"...","updatedAt":"..."}
```

The job's **payload is not exposed** — only its lifecycle fields — so internal
ids never leak through the status endpoint.

## List the queue

Polling needs an id. To see the queue without one — a stuck backlog, or a run of
failures — list it:

```bash
curl -k -b cookies.txt 'https://127.0.0.1:8080/dev/jobs?status=failed&limit=20'
```

```json
{"status":"failed","limit":20,"counts":{"queued":0,"running":0,"done":12,"failed":1},"jobs":[{"id":"...","type":"document.resolve","status":"failed","attempts":5,"maxAttempts":5,"lastError":"...","createdAt":"...","updatedAt":"..."}]}
```

`counts` always carries all four statuses (zeros included), so the summary has a
fixed shape. `status` is optional (omit it for the whole queue) and must be a
real status — a typo returns `400` rather than quietly listing everything. The
page is bounded: `limit` defaults to 50 and is capped at 200.

## Notes

- Jobs live under **`/dev`** because they are **observability, not a product
  surface**: the queue is process-wide (the `jobs` table has no user or project
  column), so nothing about a job is per-caller.
- Both endpoints are **gated**: without a session they return `401`.
- An unknown job id returns `404`.
- A failing job is **retried** with exponential backoff up to `max_attempts`
  (config `jobs.max_attempts`, default 5), then marked `"failed"` with its last
  error.
- Re-base is also enqueued **automatically** once a document accumulates
  `documents.rebase_threshold` pending change sets — the explicit endpoint here
  just lets you trigger and observe the same job on demand.
