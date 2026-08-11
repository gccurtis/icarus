# 0035 Promote prompt-block resolve out of /dev

The prompt-block **resolve** operation has been a first-class user action in the
cockpit for a while (the document inspector's Resolve), but it was still served over
a `/dev`-marked route. This increment promotes it to a stable production route. No
behavior changes — same async 202 + job shape, same handler, same authorization.

## `core/transport/transport.go`

### Move resolve to the production document routes

`POST /documents/:documentID/blocks/:blockID/resolve` now sits with the other
production document routes (right after `POST /documents/:documentID/changes`),
dispatched async through the unchanged `documents.resolve` operation and its
`asyncSpec` (`JobTypeResolve`, `canWrite` authorization, `mode` bound from the body).

Document **re-base** stays under `/dev/documents/:documentID/rebase` — it is genuine
background maintenance, not a client action, so it keeps the dev marking. The
`/dev` project-scoped block now holds only rebase and, when configured, the
`/dev/knowledge/*` lattice tooling.

## Docs and dev-tests

### Point every current reference at the stable route

The backend guide's route table and its resolve `curl` example, the
`documents/prompt-blocks.md` architecture note, and the `dev-test/prompt` runner and
manual now use `POST /documents/:id/blocks/:blockID/resolve`. The historical record
`0011-prompt-block.md` is left as-authored (it records the route as it stood then).
The transport companion was updated to keep its verbatim slices and prose in step
with the moved route.

## Verification

`gofmt` clean; `go build` / `go vet` / `go test ./...` green (no transport test
exercised the route path; the async wiring is covered by `operationSync` construction
checks). `dev-test/prompt` requires a live OpenRouter key and is unchanged apart from
the path.
