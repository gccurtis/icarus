---
title: "Execute Ω-006 — Validate Document marks and custom typography"
packet_id: "Ω-006"
status: "ready-for-execution"
wave: "Wave 0 — Stabilize current truth"
depends_on: "Ω-001"
source_mirror: "docs/current-docs/notion/work-packets/omega-006-validate-document-marks-and-custom-typography.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-006 — Validate Document marks and custom typography

## Mission

Close the stored-content injection class in Document admission. Omega will accept only canonical, render-safe link and typography payloads, reject unsafe changes atomically, and never serve a legacy unsafe value without neutralizing it. Alpha's client-side sanitizers remain defense in depth; the backend becomes the authoritative contract every current and future client mirrors.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001**.

Source dependency statement: Ω-001

No later-packet integration gate was detected in the source dependency statement.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-006-validate-document-marks-and-custom-typography.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/document/changeset_validate.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/clone.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/import.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/style.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/template.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_migrate.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-006-validate-document-marks-and-custom-typography.md`

## Outcome
Close the stored-content injection class in Document admission. Omega will
accept only canonical, render-safe link and typography payloads, reject unsafe
changes atomically, and never serve a legacy unsafe value without neutralizing
it. Alpha's client-side sanitizers remain defense in depth; the backend becomes
the authoritative contract every current and future client mirrors.
## As-built evidence
Document changes are revisioned and admitted through the Document capability.
Color marks already pass `validCSSColor`, but link validation only requires a
non-empty `href`; font family and size are length-bounded but not
grammar-bounded. `CustomTypography` is also primarily length-bounded, including
foreground/background fields that do not consistently use the mark color
validator. `sanitizeBlockMarks` protects mark ranges, not mark payloads.
Alpha has compensating render-boundary validators in
`src/lib/systems/documents/sanitize.ts`, and its current backend request includes
concrete exploit and allowlist cases. Those client checks must not be removed.
## Scope
- Define one canonical validator set for URLs, colors, font families, and font
	sizes.
- Apply it to inline marks, block custom typography, and default typography.
- Reject invalid operations with a stable `400` code before any revision,
	change set, activity event, or downstream Knowledge publication is written.
- Ensure import/template/duplicate paths cannot bypass the same invariant.
- Audit existing persisted bases and change sets; establish a pre-release scrub
	or fail-closed read policy.
- Publish exact validation rules in the backend guide for Alpha and conversion
	workers.
## Non-goals
- No font downloading, font licensing/catalog service, or editor font picker.
- No HTML/CSS renderer.
- No widening to arbitrary CSS functions.
- No removal of Alpha's sanitization.
- No Office/PDF conversion behavior.
## Invariants
1. Validation occurs at the domain admission boundary, not only in handlers.
2. Rejection is atomic: document revision and all projections remain unchanged.
3. Allowed relative links stay relative; the backend does not rewrite user
	content.
4. Control characters are rejected before URL parsing.
5. A URL scheme not explicitly allowed is denied.
6. Font strings are data, never a CSS declaration fragment.
7. Every path that constructs or restores a Document reaches the same validator.
## Likely paths
- `core/capability/document/changeset_validate.go`
- `core/capability/document/style.go`
- `core/capability/document/clone.go`
- `core/capability/document/import.go`
- `core/capability/document/template.go`
- `core/handlers/document/`
- `core/platform/storage/sqlite/sqlite_migrate.go`
Verify exact filenames at Ω-001's baseline.
## Representative interfaces
```go
type StyleValidationError struct {
    Code  string
    Field string
    Value string // never include this verbatim in production logs
}

func ValidateLinkHref(raw string) error
func ValidateFontFamily(raw string) error
func ValidateFontSize(raw string) error
func ValidateCSSColor(raw string) error
func ValidateCustomTypography(t CustomTypography) error
```
Recommended URL policy:
```plain text
allow: http, https, mailto, /relative, #fragment, ?query
deny:  javascript, data, vbscript, protocol-relative, controls, malformed schemes
```
Recommended font policy:
```plain text
family: letters, digits, spaces, quotes, comma, hyphen, period, underscore
size:   positive decimal + px|pt|em|rem|%
```
## Ordered implementation
1. Add failing domain tests for all Alpha exploit/allow cases, including literal
	tabs in `java\tscript:`, custom-typography colors, and mutation atomicity.
2. Extract canonical pure validators in the Document capability. Keep limits
	and grammar together so callers cannot apply one without the other.
3. Invoke validators from mark and typography operation admission.
4. Route create/import/duplicate/template restore through a whole-base
	validation pass.
5. Return typed `400` bodies such as
	`{"code":"document.invalid_style","field":"font.family","error":"..."}`.
	Attach the underlying cause to operator logs without logging the unsafe raw
	value.
6. Add a resumable migration/audit for existing content. Because the product is
	pre-release, scrub unsafe mark/style fields to a neutral absent value while
	preserving text and structure; report synthetic counts. Never re-emit the
	unsafe string.
7. Update companion docs, backend guide, completion matrix, and record.
## Security, concurrency, persistence, and observability
Validation runs before the document CAS append, so concurrent invalid changes
cannot advance revision or win a race. A migration must be idempotent and run
before serving content. Logs carry code, field, document/project identifiers,
and counts—not the payload. Add a counter per validation code so attempted
unsafe writes are visible without retaining exploit strings.
## Tests and gates
- Unit table for every allowed and denied grammar.
- Submit-change test proving `400` and unchanged revision/base/history/activity.
- Import, duplicate, template, undo, and redo regression tests.
- Migration fixture containing legacy unsafe values; second migration run is a
	no-op.
- Fuzz tests for URL controls and font grammar.
- Backend live test posting the exact Alpha payloads.
- Standard build/test/format/companion gates.
## Completion evidence
- No unsafe payload is accepted or served.
- Alpha can mirror one documented contract exactly.
- Existing safe typography and links round-trip unchanged.
- Security-negative tests and migration report are attached to the packet.
## Dependencies
Depends on Ω-001. Blocks Ω-016, Office import packets, and any new resource
editor that reuses Document style values.
## Sources
- [Alpha mark-validation request](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/document-mark-payload-validation.md)
- [Alpha defensive validators](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/src/lib/systems/documents/sanitize.ts)
- [Omega Document capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/document)
---

