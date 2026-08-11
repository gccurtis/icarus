---
title: "Work Packet — Ω-008 — Make Ask-turn failures diagnosable and recoverable"
notion_page_id: "3acb6410e5028193843bd6a0fd035b44"
notion_url: "https://app.notion.com/3acb6410e5028193843bd6a0fd035b44"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:54:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-008 — Make Ask-turn failures diagnosable and recoverable

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🧾" color="orange_bg">
	**Frozen-baseline addendum.** Ask and tool failures must preserve typed Resource-read, Knowledge evidence-change/corruption, embedding partial-usage, and limit errors. If embedding chunk N fails after paid chunks 1..N−1, record the completed-input count and usage before returning; never flatten it into a generic provider failure.
</callout>
## Outcome
An Ask turn will produce a valid answer, a typed insufficient-evidence outcome,
or an actionable bounded failure—never an opaque `500 "chat operation failed"`
caused by a model obeying the structured schema imperfectly. Operators can
distinguish triage, provider, decode, citation, and retrieval failures without
exposing prompts or project content in production logs.
## As-built evidence
The latest baseline already includes an important part of Alpha's request:
`endpoint.Fail` now attaches causes across handler packages, and the response
writer already passes those causes to the request logger. Do not rebuild or
duplicate that mechanism.
The remaining defect is inside Ask output handling. `decodeAnswer` requires
non-empty prose before honoring the structural `insufficientEvidence` signal.
Missing, invalid, and unknown citations can still collapse into a user-visible
failure after a paid model call. Alpha measured failures under terse custom
personas while default-persona turns with the same prompt succeeded.
## Scope
- Accept an empty answer when `insufficientEvidence=true`.
- Classify Ask failures with stable internal codes and safe public outcomes.
- Add one bounded schema-repair attempt for otherwise usable model output.
- Define the response when grounding validation fails after repair.
- Record retrieval-triage decisions, provider/request correlation, usage, and
	validation category.
- Build deterministic failure fixtures and a small live-provider reliability
	suite.
## Non-goals
- No automatic Document ingestion; Ω-016 owns evidence publication.
- No per-turn context transport or task steering; Ω-019 owns them.
- No relaxed citation truthfulness.
- No unlimited retries, silent fallback to a different embedding model, or
	client-side retry policy.
- No raw prompt/model-output logging in production.
## Invariants
1. `insufficientEvidence` is a complete structured outcome and does not require
	decorative prose.
2. Grounded answers still cite only retrieved, caller-visible evidence.
3. A repair attempt has a strict count, timeout, token budget, and usage record.
4. Caller cancellation stops work; provider timeout and rate limiting keep their
	existing typed behavior.
5. User and agent turns remain transactionally coherent—no orphan user turn on
	a failed response unless the public contract explicitly marks it failed.
6. Persona choice may affect wording, not validation semantics.
## Likely paths
- `core/capability/agent/ask.go`
- `core/capability/agent/ask_test.go`
- `core/capability/chat/`
- `core/handlers/chat/chat.go`
- `core/endpoint/endpoint.go`
- `core/transport/requestlog/`
- `dev-test/agent*/`
## Representative model
```go
type AskFailureCode string

const (
    AskInvalidOutput    AskFailureCode = "ask.invalid_output"
    AskMissingCitation  AskFailureCode = "ask.missing_citation"
    AskUnknownCitation  AskFailureCode = "ask.unknown_citation"
    AskProviderFailure  AskFailureCode = "ask.provider_failure"
)

type AskOutcome struct {
    Answer               string
    InsufficientEvidence bool
    Citations            []Citation
    Usage                Usage
}
```
Recovery policy:
```plain text
decode valid + insufficientEvidence -> succeed
decode/citation failure             -> one contract-repair call
repair succeeds                     -> validate and persist
repair still fails                  -> typed, non-opaque terminal turn outcome
provider/system failure             -> 5xx with attached cause, no blind retry
```
Whether the terminal validation outcome is `422` or a successful agent turn with
an explicit unable-to-answer state must be decided once and documented. Prefer a
successful typed turn when the provider completed normally but evidence was
insufficient; reserve 5xx for server/provider failures.
## Ordered implementation
1. Add deterministic tests reproducing empty-answer/insufficient-evidence,
	missing citation, unknown citation, invalid JSON, terse persona, and provider
	failure.
2. Reorder `decodeAnswer` validation so the structural flag wins before prose
	validation.
3. Introduce typed validation errors while preserving `errors.Is` compatibility.
4. Add one bounded repair prompt that includes the schema and validation reason,
	not hidden project data beyond the original authorized context.
5. Persist a clear terminal state for unrepaired model output. Ensure chat reads
	can distinguish failed, insufficient, and answered turns.
6. Emit structured diagnostics: project/chat/turn identifiers, persona id/version,
	triage decision, retrieved region count, validation code, provider request id,
	latency, and usage. Raw rejected output is allowed only behind an explicit
	development setting, truncated and request-log redacted.
7. Add a live suite that repeats the terse-persona case and prints cost.
8. Update API docs, Alpha request disposition, completion matrix, companions,
	and record.
## Security, concurrency, persistence, and observability
Validation and persistence must remain serialized at the chat/turn boundary so
two concurrent turns cannot attach answers to the wrong user turn. Usage from a
repair call is additive and never hidden. Logs must not contain retrieved text,
prompt content, attachment content, email, or raw model output in production.
Metrics should separate “insufficient evidence” from “model contract failure”;
the former is a normal product outcome.
## Tests and gates
- Pure decoder and citation-validator unit tests.
- Chat store transaction tests for success/failure state.
- Concurrency test posting two turns to one chat.
- Thirty deterministic fake-provider terse-persona runs with zero generic 500s.
- Live-provider 30-run sample where credentials exist, with usage and estimated
	cost printed.
- Request-log test proving cause code is present and content is absent.
- Standard repository gates.
## Completion evidence
- Alpha's exact reproduction no longer returns an opaque 500.
- Each failure family has a distinct operator code.
- Empty structured insufficient-evidence output succeeds.
- Default-persona behavior and citation enforcement remain unchanged.
## Dependencies
Depends on Ω-001. It can run in parallel with Ω-006. Ω-016 improves evidence
availability but is not required for the reliability fix. Ω-019 consumes the
final turn contract.
## Sources
- [Alpha Ask failure request](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/ask-turn-500s.md)
- [Omega failure normalization commit](https://github.com/gccurtis/taurus-omega/commit/b8ba4aa05974ff21746f14b71acaf09117d38dcf)
- [Model — Chat](https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc)
---

