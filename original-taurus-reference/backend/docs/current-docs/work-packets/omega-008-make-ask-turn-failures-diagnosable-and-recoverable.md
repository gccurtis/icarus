---
title: "Execute Ω-008 — Make Ask-turn failures diagnosable and recoverable"
packet_id: "Ω-008"
status: "ready-for-execution"
wave: "Wave 0 — Stabilize current truth"
depends_on: "Ω-001"
source_mirror: "docs/current-docs/notion/work-packets/omega-008-make-ask-turn-failures-diagnosable-and-recoverable.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-008 — Make Ask-turn failures diagnosable and recoverable

## Mission

An Ask turn will produce a valid answer, a typed insufficient-evidence outcome, or an actionable bounded failure—never an opaque `500 "chat operation failed"` caused by a model obeying the structured schema imperfectly. Operators can distinguish triage, provider, decode, citation, and retrieval failures without exposing prompts or project content in production logs.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001**.

Source dependency statement: Ω-001.

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
- `docs/current-docs/notion/work-packets/omega-008-make-ask-turn-failures-diagnosable-and-recoverable.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/model-chat-capability-and-runtime-contract--3abb6410e502.md`
- `core/capability/agent/ask.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/agent/ask_test.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/chat/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/endpoint/endpoint.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/chat/chat.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/requestlog/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `dev-test/agent*/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-008-make-ask-turn-failures-diagnosable-and-recoverable.md`

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

