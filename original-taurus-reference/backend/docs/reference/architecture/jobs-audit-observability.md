# Jobs, changes, audit, and observability

These records have different authority and retention. They must remain
separate even when one command produces several of them.

| Record | Purpose | Canonical? | Transaction |
| --- | --- | --- | --- |
| Capability change/history | Reconstruct and version domain state | Yes, when the capability defines it so | Owning domain |
| Idempotency | Bind request identity/input to one effect/result | Yes for replay correctness | Same as effect |
| Required Audit | Security attribution: who was allowed to do what, where, and why | Yes | Same as effect |
| Durable job | Restartable intent and execution state | Yes for asynchronous work | Same as triggering intent where possible |
| Work-authority receipt | Non-authoritative Project binding to exact Control durable-work authority | Yes for effect authorization checks | Same as triggering job intent |
| Finalization record | Closed permission to terminalize one already-admitted record; never a Product-effect grant | Yes for recovery | Same as admitted record |
| Semantic fact | Bounded retained input for Activity/search projection | Yes for its declared rebuild horizon | Same as owning effect |
| Activity | Human-readable semantic projection | Rebuildable within retained fact horizon | Asynchronous projection |
| Working Context | Bounded current material relevant to a User/task | Product state, but not Audit | Owning Project domain |
| Memory | Governed durable preference, convention, procedure, or outcome heuristic with provenance | Product state | Owning domain |
| Telemetry | Operational metrics/traces | No | Outside product transaction |
| Logs | Diagnostic event text/fields | No | Outside product transaction |
| Realtime notification | Hint that canonical state changed | No | Derived from committed fact |

## Change records

Change representation is capability-specific. Documents own Document
ChangeSets; other families may own revisions, operation histories, proposals,
or state transitions. A cross-product `ChangeSummary` may normalize bounded
metadata for Activity/search, but cannot replace the family's canonical
representation.

Every user-visible mutation identifies actor, delegation, Project, operation,
idempotency, canonical before/after version or state, and a bounded summary.
Agent-proposed changes remain distinguishable from accepted effects.

## Required Audit

Required Audit is immutable, append-only, minimally sufficient, privacy
bounded, and atomic with the protected effect. It records trusted actor/session,
delegation, action, target, authority/policy generations, decision, timestamp,
correlation, and safe outcome metadata. It does not store Resource bodies,
secrets, raw tokens, provider payloads, prompt content by default, or arbitrary
error strings.

Audit write failure aborts the effect. A search/index copy is always a
projection of transaction-local records.

Effectful durable jobs require an active exact Control durable-work authority
or Task sponsorship and a matching Project receipt for each fresh effect
permit. A job/lease/process is not authority. After revocation, a precommitted
finalization record may append only the required Audit and declared terminal
fact for an allowlisted settle/cancel/fail transition on that same record; it
cannot create a new effect or provider/tool call.

## Activity

Activity explains meaningful product events to Users: Resource created or
edited, import completed, prompt resolved, source stale, agent task waiting for
review, Project shared, or export produced. It links to canonical objects and
versions and applies current authorization when read. It is not a security log.

The transaction owner writes a bounded `SemanticFact` beside the canonical
effect. A fact contains only a registered safe event kind, actor/delegation
references, target references, before/after version or state, safe summary,
occurred-at time, and stable projection identity. It excludes Resource bodies,
prompts, provider payloads, secrets, arbitrary errors, and Audit-only fields.
An idempotent projector consumes facts and builds Activity records.

Project-local facts and Control-owned Project-audience facts have separate
typed sources. A Product Activity projector reads Control only through a paged
`control.semantic_facts.read_project_page.v1` contract using a projector
credential bound to one exact Project. Control enforces that Project filter
before returning data and exposes only registered safe fact fields, immutable
per-Project ordinals, continuity digests, opaque next cursors, and the retention
floor. The credential cannot enumerate Projects or read Control Audit, identity,
session, credential, or policy tables. A separate least-privilege Project
projection role reads Project-local facts and writes only Activity rows,
source-specific checkpoints/coverage, and rebuild-generation state.

Each Project transaction applies one page idempotently by stable
`(source_domain, fact_id, schema_version)` identity and advances the matching
cursor/digest atomically. There is no transaction spanning Control and Project.
Crash before the Project commit repeats the page; crash after commit resumes
from the stored checkpoint. An invalid/expired cursor, missing ordinal, digest
mismatch, or retention-floor overrun stops normal projection. Rebuild replays
both retained sources into a new generation and promotes atomically; history
outside retained facts is reported as unavailable rather than fabricated.

Semantic facts are not a universal event runtime. Capabilities do not consume
them to authorize, order commands, reconstruct canonical state, or coordinate
work. They are retained projection inputs. The retention policy must preserve
facts for at least the product's advertised Activity rebuild horizon. Outside
that horizon, the product must not claim Activity is rebuildable unless the
needed facts remain retained. Rebuild reads facts under trusted Project scope,
replays them by stable projection identity, and re-applies authorization when
the resulting Activity is queried.

The projector is a bounded scheduled/durable Project job. Polling is sufficient;
realtime may only hint that a poll is useful. Neither the page cursor nor its
ordinal is a Product command-ordering mechanism, synchronization protocol, or
message-bus offset.

## Working Context and Memory

Working Context is bounded, task-oriented current material and may expire or be
replaced. Memory is an explicitly governed durable preference, convention,
procedure, or outcome heuristic with provenance, confidence, scope,
review/edit/delete controls, and policy. It is not source-backed fact or
Knowledge evidence. Neither Context nor Memory is inferred from logs, and
neither may silently widen access to source content.

## Logging and telemetry

Structured logs use stable event names, safe IDs, result categories, durations,
and correlation—not arbitrary object dumps. Metrics are bounded-cardinality.
Traces propagate across Host, Cell, nested operations, providers, database, and
jobs while redacting input/output content by default.

Security rules:

- secrets and credential-shaped values use non-printable wrapper types;
- no SQL text with values, cookies, tokens, authorization headers, PKCE
  verifiers, presigned URLs, provider content, or Resource bodies;
- User/Project/Resource IDs are included only under explicit classification;
- error causes are classified before logging; and
- panic and provider failures are redacted at the boundary.

## Realtime

Realtime carries small versioned invalidation/status hints. A message includes
trusted target scope, kind, canonical object reference/version, and cursor only
within that notification stream if required for resubscription. It never
contains the complete Resource or grants authority. Gaps trigger authorized
snapshot/resync through Product queries.

## Proof obligations

- effect and required Audit are atomic;
- Activity/search may be dropped and rebuilt within the retained semantic-fact
  horizon; realtime may be dropped without content loss;
- Control fact projection proves exact Project filtering, least-privilege source
  and destination roles, idempotent page/checkpoint commits, continuity-gap
  detection, and truthful retention-floor/rebuild coverage;
- job replay cannot duplicate a protected effect;
- durable-work receipts cannot grant authority, and finalizers cannot escape
  their exact monotonic terminal transition;
- secret scanners and explicit negative fixtures cover logs, JSON, errors, and
  telemetry attributes;
- metrics cardinality stays bounded under hostile identifiers;
- authorization is re-evaluated when reading projections; and
- retention/deletion cannot corrupt canonical reconstruction.
