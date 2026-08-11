# 0108 — Runtime-model documentation & companion-doc policy

A whole-codebase architecture review produced two new authoritative documents and
changed how companion docs are kept. This record covers the documentation and
process change; the code remediation it recommends (the rebase-CAS fix, the
missing index, the job reaper, the God-file splits, etc.) lands in later records.

## Why

The owner asked for a coherent, written runtime model — one canonical description
of how the running system is put together, how the file layout supports it, and a
full register of the issues, gaps, and improvements found along the way. A
six-agent read of the codebase confirmed the runtime model is coherent, found no
cross-project data leak, and surfaced a set of concrete defects and drift. Two
things needed writing down, and one practice needed changing.

## `docs/architecture/runtime-model.md` (new)

The canonical, as-built architecture and runtime model. Describes the six-phase
request spine (config → composition → control gate → dispatch → capabilities →
persistence), each layer in depth, the capability meta-model (common shape,
the three stateful services, ports/adapters, and the corrected decoupling
invariant), how the directory layout mirrors the runtime layers, and an
end-to-end walk of one request through the files. It supersedes the old
`overview.md` and is the doc the rest of `docs/architecture/` now defers to.

Two framings are corrected here because the imprecise versions were load-bearing:
"two job queues" is really **three execution modes** (concurrent inline, serial
per-document lock, deferred job pool), and "capabilities never import each other"
is really "**leaf** capabilities never import each other; `agent` is the
composition tier."

## `docs/architecture/issues-and-gaps.md` (new)

The living companion register: 19 findings across correctness, privacy,
defence-in-depth, efficiency, the job system, coherence, file organization, and
documentation drift — each severity-rated with a location and a fix, plus a
summary table and a suggested remediation order. It is where the review's output
lives so it can be worked down over time rather than lost in a conversation.

## `docs/architecture/overview.md` → `docs/archive/architecture/overview.md`

Archived. It was fully superseded by `runtime-model.md` and its capability/route
inventories had drifted (it claimed ten capabilities against the real twenty).
Its ~10 inbound links across the deep-dives, capability docs, and orientation were
repointed to `runtime-model.md`, which now fills the "where X sits in the core"
role. The three remaining deep-dives (`configuration.md`, `transport.md`,
`persistence.md`) are kept — their mechanics are accurate; only their inventories
are stale, and those will be patched (tracked as `DOC-1`).

## `AGENTS.md` — companion-doc policy

The paired-companion practice changed from **byte-verbatim** reproduction to a
**freshness** rule. Companions now describe each source file in prose (excerpts
only where they clarify) instead of mirroring it line for line. The binding
invariant is that whenever a `.go` file changes, its `.go.md` changes in the same
change, so the doc can never silently fall behind.

The motivation is cost: because a verbatim companion reproduces the whole file,
doc churn scaled with file *size*, not edit size — a one-line change to the
3894-line `sqlite.go` forced regenerating its 3905-line twin. That coupling made
the large files painful to touch and is the reason companion updates felt slow. It
also blocks the planned God-file splits, which under the old rule would generate a
wall of verbatim churn. The freshness rule keeps the discipline (docs never lag
code) at a fraction of the cost and lets the companion *describe* rather than
*duplicate*.

## `scripts/check-companions.sh` (new)

Enforces the freshness invariant. It fails if any non-test `core/*.go` lacks a
companion, or if — in the change set between a base ref and the working tree — a
touched `.go` leaves its `.go.md` untouched. The freshness check is **diff-based**,
not filesystem-mtime and not last-commit-time: mtimes are uniform after a fresh
clone, and a last-commit-time comparison wrongly flags a doc+code change split
across two commits (docs committed a minute before code). The diff-based rule —
"a change that touches `FILE.go` must also touch `FILE.go.md`" — is exactly the
"you changed the code, update the doc" ping without those artifacts. Default base
is `HEAD` (a pre-commit gate); pass a merge base for CI over a branch
(`./scripts/check-companions.sh origin/main`).
