---
title: "Work Packet — Ω-006 — Validate Document marks and custom typography"
notion_page_id: "3acb6410e502811e88ddf350c279c873"
notion_url: "https://app.notion.com/3acb6410e502811e88ddf350c279c873"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:54:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-006 — Validate Document marks and custom typography

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

