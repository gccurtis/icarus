# Stage 07A — Bounded analytic compute sandbox

## Outcome

Build the separately promotable Analytic Compute capability: durable runs over
exact read-only data snapshots in a hardened sandbox, typed immutable result
artifacts, usage/provenance, cancellation and explicit promotion through a
canonical owner. This completes the compute surface intentionally deferred by
Stage 07.

## Non-goals

- arbitrary code execution inside the Host or Cell process
- ambient network, Project Database, object-store, credential or filesystem
  access from user code
- treating result artifacts as canonical Resource/Data state
- dynamic package installation or an unrestricted package ecosystem
- scheduled analytics or model training in the initial slice
- Formula semantics implemented by the analytic engine

## Target tree and files

```text
internal/
  capabilities/analytics/          run model, limits, transitions and results
  cell/handlers/analytics/          commands, exact input pinning and promotion
  cell/handlers/analytics/sandbox/  normalized SandboxRunner adapter
  cell/handlers/analytics/mysql/    run/result repository adapter
  platform/jobs/                    fenced durable execution mechanism only
  wiring/{testing,development,production}/analytics.go
migrations/project/*_analytics.sql
configs/analytics/{policy,engines}.schema.json
test/{integration,security,recovery,performance}/analytics/
```

The first engine is selected and recorded at stage start after current support,
license, vulnerability, isolation, determinism and operational review. Engine
SDK/process/container types stay in the sandbox adapter; the capability owns
only normalized language/version/input/output contracts.

## Public types, operations, and schemas

`AnalyticRun` records `RunID`, requested engine/language version, code digest,
exact pinned dataset versions, immutable limit policy, state/generation,
attempts, typed result reference, usage, safe failure and attribution.
`AnalyticResult` is an immutable bounded scalar/table/record artifact with
schema, digest, provenance and warnings. Submitted code or data values are not
copied into general logs, Audit or transport errors.

| Operation | Kind | Contract |
| --- | --- | --- |
| `analytics.start.v1` | Durable command | Validates language/policy, pins authorized inputs and creates one run/job idempotently |
| `analytics.cancel.v1` | Command | Advances generation and requests cancellation; stale completion cannot settle |
| `analytics.get_run.v1` | Query | Returns status, limits, usage, provenance and bounded safe failure/result metadata |
| `analytics.result.get.v1` | Query | Returns a bounded authorized typed result page at exact result version |
| `analytics.materialize.v1` | Command | Sends the exact result through a selected destination owner's ordinary command |

`SandboxRequestV1` carries engine/language version, code by content reference,
pinned read-only datasets by exact digest, declared output schema and hard
limits. `SandboxResultV1` carries normalized typed output, stdout/stderr summary
under strict bounds, usage and engine image/artifact digest. Unknown persisted
or engine versions fail closed.

## Construction and request flow

1. The bound handler authorizes every dataset, obtains an exact immutable
   projection from its owner, and preselects stable `RunID`, `WorkAuthorityID`
   and `JobID`. Under the current session, Control creates one exact bounded
   `DurableWorkAuthority{PendingProjectReceipt}` for those inputs, result
   target, operations, limits, dependency generations and expiry.
2. One Project transaction consumes a fresh **session-sourced** permit and
   commits the run, exact Job, non-authoritative receipt, idempotency, required
   Project Audit, declared fact and closed `durable_job@1` finalization
   record. Trusted acknowledgement of that exact receipt alone activates the
   WorkAuthority. The pending authority and receipt cannot issue an ordinary
   permit.
3. A worker reconstructs the exact active WorkAuthority, matching Job/receipt,
   run generation and current dependencies, stages only pinned inputs, and
   invokes `SandboxRunner` with the immutable policy and deadline.
4. The sandbox starts with no network, secrets, inherited environment,
   Project/object credentials or writable host path; CPU, memory, process,
   syscall, filesystem, wall-time and output limits are enforced externally.
5. The adapter validates typed output and digest, destroys the sandbox, obtains
   a fresh one-use permit sourced by that active WorkAuthority, and commits one
   immutable result/usage/terminal state only if the matching Job/receipt,
   lease, run generation, authority dependencies and budget still match.
6. Materialization is a separate current-session-authority command to a canonical
   Project data asset or Resource family; that owner validates type/version and commits lineage in
   its own transaction.

If the Project transaction in step 2 is absent, the pending Control orphan
expires/revokes without being able to run. If it committed and only
acknowledgement was lost, reconciliation verifies that exact receipt through
the trusted placement and activates the same IDs. It never creates another run.
No permit is held while the sandbox executes.

## Persistence, concurrency, failure, and recovery

Runs and Attempts are immutable except conditional state/generation pointers.
Start is idempotent by canonical input digest. One lease holder may execute a
generation; stale lease/canceled generation output is destroyed and cannot
become current. Retries create Attempts but at most one result settles.

Stable failures distinguish unsupported engine/language, invalid program,
input/version loss, policy violation, CPU/memory/time/output limit, engine
crash, cancellation, stale generation and unavailable sandbox. A Host crash
leaves a reconstructible job; an abandoned sandbox is reaped by the platform
runner and the lease retry starts cleanly. Result corruption fails integrity
checks and requires rerun; it is never silently regenerated under the same
Result ID.

## Authority and security

Input reads and result reads authorize exact Project references. A fresh
session-sourced permit is consumed for run admission, and a fresh work-sourced
permit is consumed for the canonical result commit. Later materialization uses
its own current-session permit; the result artifact or Job is not authority.
Required Project Audit records safe identities, versions, engine/policy digest
and outcome, never source code or data content by default.
Analytics cannot invoke Product operations, nested capabilities or providers
from inside the sandbox. Materialization occurs only after sandbox completion
through ordinary dispatch.

Current-family sign-out preserves an explicitly admitted run. Sign out
everywhere, User disable/removal, Project-grant/policy/entitlement loss,
cancellation, expiry or explicit revoke denies new work-sourced permits and
fences any issued ones. The separately typed `durable_job@1` finalizer may only
terminalize that exact pre-admitted Job bookkeeping; success requires prebound
proof that the ordinary result effect already settled. It cannot change Run or
usage state, execute code, publish an `AnalyticResult`, materialize Data/
Resource state, enqueue work or widen authority. Capability state must commit
under a fresh permit before revocation or remain nonterminal.

## Production and test composition

Production enables an engine only with an immutable verified runtime artifact,
an external isolation boundary, hard resource controls, no-network proof,
reaper, capacity admission and current vulnerability policy. An in-process
evaluator or command-shell fake is forbidden in production. Tests use a
deterministic fake runner for state-machine cases and the real sandbox artifact
for escape, limit, crash, race and performance evidence.

## Proof matrix

- capability transition/property/fuzz tests and operation/schema drift;
- exact input pinning, cross-Project denial and inaccessible-input hiding;
- no network/secret/environment/host-filesystem/Project-store access;
- syscall, child-process, CPU, memory, time, disk and output-size escape cases;
- cancel/lease-loss/crash at each boundary with at-most-one settled result;
- pending→Project receipt→ack activation with stable Run/Work/Job identities,
  lost-ack reconciliation, orphan expiry and denial of pending/bare-receipt
  permits;
- current-family sign-out survival and User-wide/grant/policy/entitlement/
  cancel/expiry revocation fencing before result commit;
- `durable_job@1` confinement after authority loss, including no Run-state
  change, code execution, result publication or materialization;
- deterministic supported programs and explicit engine-version differences;
- typed output validation, digest/integrity and paged result bounds;
- code/data/log/error/Audit redaction and hostile diagnostics;
- capacity/fairness under simultaneous Cells and safe overload refusal;
- restart, reaper and backup/restore behavior; and
- headless start → status → typed result → explicit Data materialization with
  exact provenance.

## Completion evidence and remaining boundary

Source tests alone do not promote analytic compute. Completion requires the
named engine/runtime artifact and live isolation, crash, resource-limit and
load evidence. Additional engines, scheduled runs, rich charts and training
remain separately disabled until they pass the same boundary.

## Consequential decisions and source grounding

- **Sandbox execution is out of process.** Direction: a hardened external
  isolation boundary with immutable runtime artifact. Alternative: in-process
  interpreter, rejected for production because capability bugs share Host
  authority. Revisit only with equivalent measured isolation evidence.
- **Results are artifacts, not canonical Resources.** Direction: explicit
  owner-side materialization. Alternative: analytic jobs write Data/Workbook
  tables directly, rejected because it bypasses owner validation/concurrency.
- **One reviewed engine first.** Direction: make engine choice during this
  stage and keep all others unavailable. Alternative: a broad unproved engine
  matrix. Revisit after the first runtime is operationally characterized.

Grounding: [Formula and Data](../capabilities/formula-and-data.md),
[Stage 07](07-formula-data.md), [capability model](../architecture/capability-model.md),
and [jobs/Audit/observability](../architecture/jobs-audit-observability.md).
