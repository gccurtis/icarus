# 0116 — Splitting the four remaining God files (ORG-1)

Completes `ORG-1` from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)). With
[0112](0112-sqlite-per-capability-split.md) having done `sqlite.go`, this
finishes the job. **No behaviour changed** — all four are pure moves of code
between files in the same package.

## Why these four

The directory layout already mirrored the runtime spine; the problem was at the
*file* grain. Four files were large enough that the seams inside them were
invisible from the file tree:

- `transport.go` hid the route table, three dispatch modes, the Echo adapters and
  the middleware in one place, so the request lifecycle could not be read from
  the layout.
- `wiring.go` mixed the boot DAG with eight cross-capability adapters, so the
  wiring graph — who adapts what to what — was buried inside a 930-line function.
- `document/service.go` carried 37 methods spanning CRUD, trash lifecycle,
  anchors, history/undo/redo and the submission write path.
- `knowledge/knowledge.go` mixed the build/ingest path with the retrieval path,
  the two halves of the lattice.

## The result

| File | Before | After | Split into |
|---|---:|---:|---|
| `core/transport/transport.go` | 822 | **133** | `routes.go` 386, `dispatch.go` 180, `response.go` 103, `middleware.go` 85 (`gate.go` already separate) |
| `core/wiring/wiring.go` | 930 | **428** | `document_prompt.go` 122, `chat_engine.go` 113, `config.go` 107, `reference_document.go` 91, `intelligence.go` 69, `comment_document.go` 42, `resource_generator.go` 36, `tls.go` 35 |
| `core/capability/document/service.go` | 1161 | **246** | `service_submit.go` 335, `service_crud.go` 214, `service_anchors.go` 174, `service_history.go` 154, `service_lifecycle.go` 79 |
| `core/capability/knowledge/knowledge.go` | 1066 | **369** | `retrieve.go` 354, `build.go` 205, `descent.go` 167 |

`core/wiring` now completes a convention it was already half-way toward: the
composition root holds `Run` and the boot constants, and every cross-capability
adapter lives in a sibling named for the boundary it bridges. The wiring graph is
legible from the file listing.

In `knowledge`, the split found a third seam beyond build/retrieve: `descend`
plus its hand-rolled max-heap is a self-contained concern with its own data
structure, so it became `descent.go` rather than making `retrieve.go` ~500 lines
that mixed "rank candidates" with "walk the DAG".

## How each split was proved behaviour-preserving

Each was performed as a **line-exact move** — every source line assigned to
exactly one destination, cut by line range, never retyped — then `goimports`
computed each new file's imports. Three obligations were checked on all four:

1. **Line accounting** — lines in equals lines out.
2. **Declaration set identical** — the sorted list of every top-level
   `func`/`type`/`const`/`var` line is byte-identical before and after
   (`transport` 21, `wiring` 38, `knowledge` 48 declarations).
3. **Zero deleted code lines** — diffing all non-comment, non-blank lines yields
   **zero deletions**; the only additions are per-file `package`/`import`
   scaffolding.

Plus `go build ./...`, the full suite, `check-companions.sh` and
`check-format.sh` on every one.

## Companion docs

Every new file got a prose companion, and the four oversized originals had theirs
rewritten (`wiring.go.md` went from 934 lines to 129, describing the boot DAG and
lifecycle only). This is the payoff of
[0108](0108-runtime-model-docs-and-companion-policy.md)'s freshness rule: under
the old byte-verbatim rule these splits would have generated thousands of lines of
mirrored churn, which is precisely why the policy change was sequenced first.

## Incidental finding

The `wiring.go` split surfaced an orphaned doc comment: `documentPromptModel`'s
documentation had drifted onto `chatEngine`. It was moved back onto the type it
describes — comment-only, no code effect. This is the second such case a split has
flushed out (0112 found `PutName`'s comment orphaned above `marshalName`).
Isolating code into cohesive files makes misattached documentation visible in a
way that scanning a 900-line file does not.
