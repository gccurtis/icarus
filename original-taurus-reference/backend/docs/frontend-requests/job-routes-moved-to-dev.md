# Front-end request: job routes moved under `/dev`

**Status: required if you poll jobs.** If the cockpit never reads job status, no
change is needed.

## What changed

| Before | Now |
|---|---|
| `GET /jobs/:jobID` | `GET /dev/jobs/:jobID` |
| — | `GET /dev/jobs?status=&limit=` *(new)* |

The old path is gone and returns `404`.

## Why

Jobs are **operator observability, not a product surface**. Two facts settled it:

- The whole application is scoped to one `(user, project)` pair, and the `jobs`
  table carries **no owner column at all** — no user id, no project id. There is
  nothing on a job row to authorize against, which is why job status was only ever
  protected by holding the unguessable id.
- Nothing in the product needs to *control* the queue from outside. The only
  legitimate reason to read it is to see what the backend is doing.

Rather than invent an ownership model a single-user cell does not have, the routes
moved to the `/dev` prefix, where the rest of the operator/diagnostic surface
lives. They stay behind sign-in.

## What the client must do

If you poll a job id returned by a `202` response — today that is
`documents.rebase` and `documents.resolve` — change the poll URL:

```diff
- const res = await api.get(`/jobs/${jobId}`);
+ const res = await api.get(`/dev/jobs/${jobId}`);
```

The response body is unchanged: lifecycle fields only (`id`, `type`, `status`,
`attempts`, `maxAttempts`, `lastError?`, `createdAt`, `updatedAt`). The job's
`payload` is never serialized, so internal ids do not leak to the client.

## The new listing (optional)

`GET /dev/jobs` answers `{status, limit, counts, jobs}` — useful in a dev/debug
panel, not in the product UI:

- `?status=queued|running|done|failed` filters; omitted means any.
- `?limit=` is bounded server-side (max 200, default 50).
- `counts` always carries all four statuses, so a chart does not have to fill
  in zeros.

This exists because a `failed` job used to be invisible unless you already held
its id — a run of failures or a stuck queue could not be seen at all.

## How to verify

1. `GET /dev/jobs/<id>` for a job id from a `202` → `200` with the lifecycle body.
2. The old `GET /jobs/<id>` → `404`.
3. `GET /dev/jobs?status=failed` → `200`, `jobs` array possibly empty, `counts`
   present with all four keys.

Note these are mutating-free `GET`s, so they need no CSRF header — but they do
need the session cookie, like everything behind sign-in.
