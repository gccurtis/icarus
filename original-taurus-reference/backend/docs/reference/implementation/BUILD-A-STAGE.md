# Reusable implementation prompt

Use this prompt in a fresh coding task after naming the stage to build. Replace
`<STAGE>` with a file from this directory.

```text
Build Taurus Omega implementation stage <STAGE> in the gccurtis/taurus-omega
repository.

This is a greenfield rebuild. Do not import, copy wholesale, migrate, preserve,
or create compatibility with Taurus Nova. You may inspect the original Taurus
Notion construction specifications and the pinned Nova evidence linked in
docs/reference/ for product behavior, fixtures, failure cases, and proven
implementation lessons. Current Omega decisions and architecture always win.

Before changing code:

1. Read AGENTS.md, docs/decisions/README.md, the named stage, every capability
   page it references, and the relevant architecture/flow pages.
   If the stage names a decision gate (for example Q006 for Stage 05A), verify
   that the decision is answered and recorded before implementing provider- or
   policy-specific code.
2. Inspect the current tree and report any contradiction between the stage and
   already implemented public contracts. Resolve harmless local details; stop
   only for a consequential unresolved product/security/data/public-contract
   decision.
3. Restate the intended outcome, non-goals, target directories, key interfaces,
   transaction/concurrency/security model, and proof plan.

Implement the complete named stage. Use production-grade supported libraries
where a protocol or format warrants them; re-check official current release and
security guidance before selecting versions. Keep capabilities independent Go
libraries. Put authorization/loading/persistence/provider/job/Audit behavior in
handlers and adapters. Preserve immutable (UserID, ProjectID) Cell scope. Fail
closed in production when any required real adapter, secret, schema, authority,
or evidence boundary is absent.

Build tests with the implementation, not afterward. Run all existing gates plus
the stage's pure, race, live integration, security, concurrency, crash/retry,
recovery, and headless acceptance proofs. Do not weaken a gate or call an
environment failure a code failure. If a required external credential or tool
is unavailable, complete every deterministic substitute proof, clearly record
the missing live evidence, and keep the affected production feature disabled.

Use a small number of non-overlapping reviews for architecture/dependency,
security/authority/isolation, persistence/concurrency/recovery, and product
contract correctness. Fix findings and rerun affected and broad gates.

Do not begin a later stage. Do not push or merge unless I explicitly ask.

Return one self-contained report containing:

- stage and delivered outcome/non-goals;
- base/head/branch/commit ledger and clean/dirty status;
- before/after directory tree and every new/changed file by responsibility;
- key types/interfaces/functions/schemas and exact request/call graph;
- how each feature in the relevant capability page is supported or explicitly
  deferred by this stage;
- authority, persistence, concurrency, failure, recovery, and rollback model;
- exact test commands/results/durations and production versus local evidence;
- review findings and repairs;
- consequential decisions with grounding, direction, alternatives, and revisit
  trigger;
- remaining boundaries; and
- the recommended next implementation stage.
```

The prompt is deliberately stage-oriented rather than packet/status-oriented.
Git commits are rollback/review units; documentation stages are construction
outcomes; neither recreates the old migration system.
