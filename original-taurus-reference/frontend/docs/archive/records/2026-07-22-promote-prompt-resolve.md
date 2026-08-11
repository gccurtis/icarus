# 2026-07-22 — Prompt resolve on a stable route

Omega promoted the prompt-block **resolve** operation out of `/dev` to a production
route, so the cockpit now calls the stable path. Pure path change — the async
202 + job-polling flow, the `Resolving…` state, and the inspector UI are unchanged.

## What changed and why

### `src/lib/data/documents.ts`

`resolvePromptBlock` now posts to `POST /documents/:id/blocks/:blockID/resolve`
(previously `/dev/documents/:id/blocks/:blockID/resolve`). Its doc-comment drops the
"currently a `/dev/` route — see the request to promote it" note, since it's promoted.

## Docs

- [discrepancies/documents.md](../../discrepancies/documents.md): the prompt-block bullet
  now cites the stable resolve route instead of the `/dev` one.
- [backend-requests/prompt-resolve.md](../backend-requests/prompt-resolve.md) marked
  **Shipped**; the status index in
  [backend-requests/README.md](../../backend-requests/README.md) updated to match.
- `documents.ts` companion updated to stay verbatim.

## Verification

`pnpm check` 0/0 and `pnpm build` green. The Omega side (the route move, guide,
dev-test, and record 0035) landed in the same push cycle.
