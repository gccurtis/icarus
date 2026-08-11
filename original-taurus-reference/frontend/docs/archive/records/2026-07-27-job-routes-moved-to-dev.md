# 2026-07-27 — Adopt Omega's job-route move: poll `/dev/jobs/:id`

The second required item in `taurus-omega/docs/frontend-requests/` (found while adopting the CSRF
one): job routes moved under the `/dev` operator prefix, and the old `GET /jobs/:id` is gone.

## What was broken

`getJob` still polled `/jobs/:id`. Its one caller is `resolvePrompt` in `model/actions.ts` — the
prompt-block resolve loop — so resolving a prompt against the current Omega failed on the first
poll (the ApiError surfaces as the "Could not resolve the prompt block" toast). No unit or e2e
coverage exercises the resolve loop against a live model, which is why nothing caught it.

## The change

```diff
-  return api<Job>(`/jobs/${jobId}`);
+  return api<Job>(`/dev/jobs/${jobId}`);
```

Why `/dev` (from Omega's request doc, kept in the code comment): jobs are operator observability,
not a product surface — the jobs table has no owner column, so there is nothing to authorize a
per-user route against. The body is unchanged (lifecycle fields only; the payload is never
serialized). A safe `GET`, so no CSRF header.

## Verified against the live backend

```
list /api/dev/jobs?status=failed → 200 {"counts":{"done":38,"failed":3,…},…}
real id via /api/dev/jobs/:id    → 200
```

`pnpm check` 0/0 · companion updated and fresh.
