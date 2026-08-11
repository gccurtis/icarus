# 0170 — Canonical Document style admission

Ω-006 began from clean `main` at
`61cabaaee027fc7d19e81cd3402332c00a76b4ea`. Its hard predecessor Ω-001 is
present as record 0162 and the executable completion baseline. No dependency was
added.

## Outcome

Document admission now owns one closed URL, font-family, font-size, color, and
mark-attribute grammar. It applies before Create or ChangeSet persistence and is
reused by import, resolved duplicate, template materialization, undo, and redo.
Invalid HTTP writes return `400 document.invalid_style` with a stable field,
advance no revision, create no ChangeSet/history/activity fact, and do not run
downstream indexing. Safe strings round-trip unchanged.

SQLite audits document bases, retained ChangeSet operations/inverses, and
idempotency receipts before the Store becomes ready. It removes unsafe legacy
marks, clears unsafe custom-typography properties independently, preserves text,
structure, revisions, and history, and reports counts without payloads. The
bounded pass is resumable and a second run is a no-op.

## Decisions

- URLs are not rewritten. Only hosted HTTP(S), recipient-bearing `mailto`, and
  `/`, `#`, or `?` references are admitted; protocol-relative, control-bearing,
  backslash, malformed, and unknown-scheme strings are denied.
- Font families use a data-only character grammar with Unicode letters/digits.
  Font sizes are positive decimals with `px`, `pt`, `em`, `rem`, or `%`.
- Existing CSS color policy remains deliberately narrow and injection-safe. The
  same validator now owns mark, block, style-definition, and default colors.
- Mark attributes are closed by kind so a current or future renderer cannot
  accidentally spread unreviewed stored attributes.
- Legacy unsafe marks are removed rather than rewritten into invalid marks.
  Unsafe custom properties become absent while safe sibling properties survive.
  A legacy revision whose only content was an unsafe mark may therefore retain
  its immutable history summary while its detailed operation/inverse arrays are
  empty.
- Reads validate resolved bases as a fail-closed second layer. The startup scrub
  is the normal SQLite compatibility path; a non-SQL/custom Store that supplies
  unsafe legacy content cannot serve it.
- Request logs redact style fields in both requests and responses. Typed causes
  retain code, field, and reason only—never the submitted value.

## `core/capability/document/style_validation.go`

### Canonical pure validators and typed errors

Adds `ValidateLinkHref`, `ValidateFontFamily`, `ValidateFontSize`,
`ValidateCSSColor`, `ValidateCustomTypography`, and
`StyleValidationError`. Limits and grammar are inseparable, and error strings
contain no submitted value. `StyleValidationCode` is
`document.invalid_style`.

## `core/capability/document/changeset_validate.go`

### One admission path for every style-bearing payload

Validates marks and custom typography wherever a ChangeOp can carry them,
including nested rows, blocks, list items, style definitions, style references,
headers, and footers. Whole-base validation now checks payloads rather than only
mark kinds/ranges and applies the same checks to recurring regions and default
typography.

### Closed mark attribute vocabulary

Links accept only `href`; fonts accept `family` and/or `size`; foreground and
background marks accept only `value`; boolean/code marks accept no attributes.

## `core/capability/document/style.go`

### Shared custom-typography contract

Replaces length-only custom typography checks with the canonical validators and
extends stored style-system validation to header and footer blocks.

## `core/capability/document/style_scrub.go`

### Render-safe legacy neutralization

Adds pure, payload-free scrub helpers for bases and retained ChangeOps. Unsafe
marks/mark operations are removed; unsafe custom properties and unknown mark
attributes are cleared. Reports contain counts only.

## `core/capability/document/service.go`

### Rejection counter

Adds the per-service `StyleValidationRejections` counter for the one stable
validation code. The counter retains no field value or document content.

## `core/capability/document/service_submit.go`

### Pre-CAS observation

Records typed style rejections at the domain admission boundary before hashing,
ID assignment, replay, CAS append, activity, reference indexing, or job
scheduling.

## `core/capability/document/service_crud.go`

### Canonical create and fail-closed reads

Checks raw Create style payloads before normalization can rewrite them, validates
resolved reads before returning them, and makes Duplicate start from the exact
validated resolved head. Duplicate validates again before persistence.

## `core/capability/document/service_history.go`

### Historical read safety

Validates raw and resolved historical bases so revision reads and diff cannot
serve unsafe content from a custom or unmigrated Store.

## `core/capability/document/history.go`

### Detailed ChangeSet read safety

Validates retained forward and inverse style payloads before returning a
detailed revision, closing the non-SQL/custom-Store fail-closed path.

## `core/capability/document/template.go`

### Template-list read safety

Validates each resolved template before including its full body in the template
listing. Template instantiation continues through validated `Get` and `Create`.

## `core/capability/document/duplicate.go`

### Complete typography copies

Carries document-default typography into duplicates and deep-copies custom style
definitions/references while remapping IDs.

## `core/capability/document/style_validation_test.go`

### Security, allowlist, path, atomicity, and fuzz evidence

Covers the Alpha exploit payloads and documented allowlist; typed errors and the
rejection counter; unchanged revision/ChangeSets/activity/base; Create and
Markdown import rejection; safe duplicate/template round trips; URL-control and
font-grammar fuzz seeds.

Existing custom-typography undo/redo tests continue to cover compensation under
the new grammar.

## `core/handlers/document/document.go`

### Stable HTTP error body

Maps typed domain errors to
`{"code":"document.invalid_style","field":"…","error":"document style value is invalid"}`
and attaches the bounded cause for operator logs.

## `core/handlers/document/importexport.go`

### Import error mapping

Maps an unsafe Markdown link rejected by Create to the same typed 400 contract
instead of treating client content as an internal failure.

## `core/transport/requestlog/requestlog.go`

### Unsafe-value log redaction

Redacts link/font/color fields inside Document mark and custom-typography
containers. Generic non-style `value`/`size` fields remain observable.

## `core/transport/requestlog/requestlog_test.go`

### Nested style redaction evidence

Proves exploit strings do not survive request-log body redaction.

## `core/transport/transport_test.go`

### Typed and atomic black-box route evidence

Posts JavaScript/control/font injection payloads through the real transport,
asserts typed 400 fields, unchanged revision and empty history, then admits a
safe HTTPS link.

## `core/platform/storage/sqlite/sqlite_document_style_migrate.go`

### Bounded resumable startup audit

Walks `documents`, `change_sets`, and `document_submissions` in batches of 100,
repairs rows independently, and logs aggregate code/table/value/mark/operation
counts only.

## `core/platform/storage/sqlite/sqlite_migrate.go`

### Pre-ready migration order

Runs the Document style scrub during Store migration before returning a ready
adapter.

## `core/platform/storage/sqlite/sqlite.go`

### Migration report evidence seam

Retains the most recent synthetic scrub report on the Store for package-level
migration verification.

## `core/platform/storage/sqlite/document_style_migrate_test.go`

### Legacy fixture and second-run no-op

Builds a database containing unsafe base marks/defaults/block typography,
ChangeSet ops/inverses, and a submission receipt. Reopen removes every exploit
string while safe values/text remain readable; the next reopen reports zero
changes.

## `dev-test/typography/run.sh`

### Credential-free live backend certification

Posts the exact Alpha exploit and allowlist payloads to a real TLS server,
confirms typed failures and unchanged revision, and keeps the existing safe
custom/default/inline typography round trip. This suite makes no model call and
costs $0.

## `docs/backend-guide.md`

### Client and worker contract

Publishes exact limits, character/unit/scheme grammars, closed mark attributes,
typed error fields, atomic behavior, log policy, and startup compatibility
behavior for Alpha and conversion workers.

## `docs/completion/omega-completion-matrix.md`

### Ω-006 shipped evidence

Moves Ω-006 from partial to shipped and points at its validators, typed route,
scrub, tests, live suite, guide, and this record.

## Security, privacy, and operations

- Controls are rejected before URL parsing; unknown schemes fail closed.
- No unsafe raw value appears in domain errors, migration reports, or request
  logs. Document/project authorization behavior is unchanged.
- Migration changes are intentionally one-way: unsafe style strings are not
  retained. Roll back the binary normally (no schema changed); restore a
  pre-rollout database backup only if the original malicious bytes are required
  for external forensic work. Restoring that backup behind an old binary also
  restores the vulnerability and is not a safe production rollback.
- Startup cost is bounded in 100-row batches and entirely local—no provider,
  network, or monetary cost. A crash after any row update is safe; reopening
  audits remaining rows.
- A restricted functional-color string can still be semantically invalid CSS
  (for example an unknown channel name), but cannot carry CSS declaration
  punctuation. Strict semantic color parsing remains outside this packet and is
  not needed for injection safety.

## Acceptance mapping

- Canonical URL/color/font family/font size validators: pure validator tables
  and fuzz seeds in `style_validation_test.go`.
- Inline, block, style-definition, and default typography: domain tests plus
  existing typography cascade/undo/redo coverage.
- Atomic stable 400 before projections: memory-store atomicity test and
  `TestDocumentStyleValidationTransportIsTypedAndAtomic`.
- Create/import/duplicate/template/undo/redo: whole-base path test, existing
  custom typography compensation test, and credential-free live suite.
- Unsafe legacy content never served: startup fixture scrub, resolved-read
  validation, raw SQL exploit-string assertions, and second-run no-op.
- Exact backend contract: `docs/backend-guide.md`.
- Observability without payload retention: per-service counter, synthetic
  migration report, typed operator cause, and request-log redaction test.

## Verification

Completed during implementation:

- `go test ./core/capability/document ./core/platform/storage/sqlite ./core/handlers/document ./core/transport/requestlog ./core/transport`
- `./dev-test/typography/run.sh` — all checks passed; no provider calls, 0 tokens,
  $0.
- `./scripts/check-format.sh`
- `go build ./...`
- `go test ./...`
- `./scripts/acceptance/omega-baseline.sh`

All passed. No credentialed/provider-backed test was required or skipped; the
packet's backend-live certification is the credential-free typography suite.
