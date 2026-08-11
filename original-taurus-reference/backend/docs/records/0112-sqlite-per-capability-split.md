# 0112 — Split `sqlite.go` into per-capability files (ORG-1)

The largest file-organization fix from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)). **No behaviour
changed** — this is a pure move of code between files in the same package.

## Why

`core/platform/storage/sqlite/sqlite.go` was 3915 lines: 35 tables, 184
top-level declarations, ~150 methods on a single `Store`, holding every
capability's persistence. Two costs:

1. **It hid the runtime model.** The `core/capability/` tree makes each domain's
   boundary explicit, but in the storage layer all twenty domains collapsed into
   one blob — the persistence boundaries were invisible in the file tree. The
   directory layout mirrored the runtime spine; the *files* did not.
2. **It drove the companion-doc cost.** Under the old byte-verbatim companion
   rule, `sqlite.go.md` was a 3926-line mirror, so a one-line code change forced
   regenerating ~3900 lines of documentation. This was the single largest source
   of the companion-doc slowness that motivated
   [0108](0108-runtime-model-docs-and-companion-policy.md)'s policy change.

Both are fixed by the same split, which is why 0108 (the freshness rule) landed
first: it makes this decomposition cheap instead of enormous.

## What changed

`sqlite.go` (3915 lines) became **20 files** in the same package — one per
capability, mirroring `core/capability/`:

| File | Lines | File | Lines |
|---|---:|---|---:|
| `sqlite.go` (core) | 120 | `sqlite_persona.go` | 209 |
| `sqlite_migrate.go` | 693 | `sqlite_chat.go` | 169 |
| `sqlite_document.go` | 574 | `sqlite_organization.go` | 140 |
| `sqlite_knowledge.go` | 542 | `sqlite_comment.go` | 134 |
| `sqlite_access.go` | 353 | `sqlite_connector.go` | 128 |
| `sqlite_agent.go` | 216 | `sqlite_sessions.go` | 122 |
| `sqlite_formula_names.go` | 177 | `sqlite_jobs.go` | 120 |
| `sqlite_activity.go` | 83 | `sqlite_context.go` | 119 |
| `sqlite_reference.go` | 76 | `sqlite_resource.go` | 98 |
| `sqlite_file.go` | 75 | `sqlite_workspace.go` | 49 |

The core `sqlite.go` now holds only what is genuinely shared: the package doc,
`Store`, `Open`/`pragmaDSN`/`Close`, the time layouts, the `rowScanner`
interface, `boolToInt`, and the compile-time interface assertions — which now sit
together as a single block that documents, in one place, that one `Store`
implements every persistence port.

Because every file is in `package sqlite` and shares the same `*Store`, the split
required **no interface changes, no new types, and no call-site changes**
anywhere in the codebase. Each file carries a short doc comment stating which
capability's persistence it holds.

## How it was verified as behaviour-preserving

The split was performed as a line-exact move (each source line assigned to
exactly one destination) rather than by hand, then checked three ways:

- **Line count:** 3915 in ⇒ 3915 out.
- **Declaration set:** the sorted list of all 201 top-level `func`/`type`/
  `const`/`var` declarations is **identical** before and after.
- **Code bodies:** diffing all non-comment, non-blank lines before vs. after
  yields **zero deletions**; the only additions are the 130 lines of per-file
  `package sqlite` / `import` scaffolding that `goimports` generated.

Plus `go build ./...`, `go vet`, the full suite (40 packages), and
`go test -race` on the sqlite package — all green, with `sqlite_test.go`
untouched.

## Companion docs

The 3926-line verbatim `sqlite.go.md` is replaced by 20 proportionate companions
written under the new prose policy — each describing its file's responsibility
and blocks, with excerpts only where they clarify an invariant. A change to, say,
the comment store now touches a ~100-line companion instead of a ~3900-line one.

## Also in this change

`core/platform/job/pool.go` was re-formatted with `gofmt` (adding the `lease` and
`reapInterval` fields in [0110](0110-job-crash-recovery-and-reaper-lifecycle.md)
widened the `Pool` struct's alignment column), and its companion's struct excerpt
updated to match.

Three small comment/style fixes surfaced while documenting the new files:

- `sqlite_context.go` — `scanContext`'s doc comment said `rowScanner` was defined
  "in this file". That was true before the split and false after it, so the split
  itself made it stale; it now points at `sqlite.go`.
- `sqlite_formula_names.go` — `PutName`'s doc comment was orphaned above
  `marshalName` (a pre-existing attachment slip, verified identical in the
  pre-split file), leaving `PutName` undocumented and `marshalName` with a
  misleading preamble. The comment moved to the function it describes.
- `sqlite_chat.go` — `scanChatAttachment` declared an inline
  `interface{ Scan(...any) error }` instead of the package's named `rowScanner`;
  they are structurally identical, so this is purely a consistency fix.

A related finding is recorded but **not** fixed here: four files elsewhere in the
tree are not `gofmt`-clean and nothing enforces formatting — logged as `ORG-2` in
the register, with the verification that all four predate this review.
