# Slide guarantees, constraints, and gaps

## Scope of guarantees

The guarantees below are conditional on the implemented function being called:
wire decoders guarantee admitted DTO shape, the reducer guarantees validated
operation results/inverses, and the SQLite store guarantees its transaction
primitives. There is no end-to-end command, query, Prompt workflow, recovery,
or endpoint guarantee because `slideService.ts` is missing.

## Canonical snapshot invariants

Enforced by [`validateSnapshot`](../domain/validation.ts):

- representation version 1; non-negative revision; non-empty title;
- finite positive canvas within 10,000 points;
- complete default Style map for all Shape kinds; unique Styles; acyclic
  inheritance; valid text/visual properties;
- at least one Slide; unique `slideOrder`; exact order/record parity;
- safe globally unique canonical IDs; map key equals embedded ID;
- valid Rich Text notes/text under configured atom limits;
- each element has exactly one membership, is root-reachable, and participates
  in no Group cycle; Groups are non-empty with unique children;
- element locked/hidden values are boolean and Group depth is bounded;
- each Shape has a resolvable Style, finite positive bounded frame, rotation in
  `[0, 360)`, boolean flips, and valid local presentation.

## Shape-specific invariants

- Prompt Content has a non-empty output and positive applied revision; a live
  output ID cannot be shared by two Prompt Shapes.
- Rounded-rectangle radius is non-negative and no more than half the smaller
  frame dimension.
- Line endpoints lie in the unit square and differ.
- Image refs include file/version/digest/image MIME; crops stay in `[0,1)` and
  leave positive area; decorative alt is empty and non-decorative alt non-empty.
- Table accepted value is tabular; optional positive widths match field count.
- Chart accepted value is list/record/table; axes are finite and min ≤ max;
  colors use canonical lowercase `#rrggbbaa`.
- Accepted Formula wire values have valid rational numbers, matching row/field
  widths, proper list/record cardinality, and bounded node count.

## Reducer and identity invariants

- Operations apply to a clone and validate once after the batch.
- Forward operations are cloned; inverse operations exactly restore order and
  subtree content under the tested domain cases.
- Removing/moving a final Group child prunes empty ancestor Groups; inverse
  `element.restore-subtree` restores the exact chain/order.
- A Group cannot move into itself/descendant; anchors must be immediate members
  of the target container.
- Ordinary batches cannot remove then re-add (or add then remove) the same ID,
  change identity kind, change Shape kind in place, or churn Rich Text identity.
- Touched IDs include synthetic Deck/Slide/Group ordering and metadata
  sentinels, so conservative rebase detects structural conflicts.
- Group transforms never persist group geometry; they expand to descendant
  Shape frame/transform operations. Hidden descendants remain structural.

## Wire invariants

- Inputs are finite acyclic JSON values in plain objects, within byte/node/depth
  limits and without unknown decoded fields.
- Identifiers reject empty/oversized/prototype-reserved keys.
- Generic `deck.submit` rejects `element.restore-subtree`,
  `prompt-content.apply-derived-output`, and any operation that introduces
  Prompt Content.
- History query limit is 1–1,000.

## Store atomicity and persistence invariants

Implemented by `SQLiteSlideStore`:

- table names are isolated by a 16-hex SHA-256 project prefix;
- SQLite uses WAL, foreign keys, 5-second busy timeout, NORMAL sync;
- creation co-commits head, initial identity ledger, Base, submission receipt,
  and accepted-fact outbox;
- mutation updates only an expected head revision and co-commits ChangeSet,
  identity transitions, attempts/settlements, Prompt ownership, receipt, fact;
- revision relationships require one-step head/ChangeSet progression;
- identity tombstones reject reuse, except exact same-kind compensation when
  the commit is explicitly compensating;
- delegated claims and stage receipts reject divergent idempotency reuse;
- Base append is head-fenced; history pruning preserves configured Base/tail and
  active attempts;
- stage claims are retry-safe; interrupted running receipts can be marked
  failed; Prompt creation failure can atomically detach pending ownership.

These primitives trust their caller to construct semantically correct commit
objects. No service currently does so for public commands.

## Concurrency, recovery, and idempotency gaps

The intended queue split (serial mutation/settlement, concurrent compute) is
declared, and store revision CAS/stage claims exist. Yet current code does not
guarantee:

- request receipt replay through a command runtime;
- conservative stale rebase or compensation admission;
- durable attempt transition/dispatch after command commit;
- deterministic external Derived Output idempotency keys;
- stale-target checks before Prompt settlement;
- startup attempt redispatch;
- in-process capacity redrive;
- compaction scheduling.

Those require the missing application service and tests for its interleavings.

## Limits

Hardcoded default domain limits:

| Limit | Value |
| --- | ---: |
| Slides per Deck | 500 |
| Elements per Slide | 1,000 |
| Group nesting | 10 |
| Styles per Deck | 200 |
| Rich Text atoms per content | 10,000 |
| Accepted-value nodes | 25,000 |
| Canvas/frame dimension | 10,000 pt |
| Retained Bases | 5 |
| Retained ChangeSets | 1,000 |
| Retained terminal attempts | 500 |

Wire limits are separate and listed in [Types](types.md). Store list pages
default to 50/cap at 200; maintenance batches default to 100/cap at 1,000.

## Security and observability

- Safe record keys prevent prototype/inherited-property ambiguity in
  `Record`-backed snapshots.
- Wire admission rejects hostile/pathological object structures before domain
  work.
- Project identity is supplied at store construction, not by DTOs.
- Declared endpoint 500 bodies hide internal messages and log error names.
- No application command logging actually occurs because no runtime exists.
- Authentication and authorization are outside this capability.

## Tests

Current tests cover blank/defaults, canonical encoding, grouping/order/inverses,
cycles, Styles, Rich Text, literal values, Prompt boundaries, identity/safe
keys, touched IDs/rebase, geometry, recursive validation, strict wire budgets,
internal-job queue mapping, project-isolated store transactions/CAS, ledger,
claims/stages/recovery primitives, and history pruning.

There are no application tests for create/submit/load/compensate, Prompt
creation/update/refresh, recovery orchestration, or endpoint success behavior.

## Non-goals and currently absent behavior

- **Currently absent, not merely deferred:** `SlideCapability` application
  runtime and therefore operable endpoints/startup construction.
- renderer, render artifacts, export, thumbnails, text measurement;
- live Formula/Structured Data/analysis binding for table/chart values;
- media runtime reads or mutable image linkage;
- Activity publication, detached-output cleanup, Presence/collaboration;
- distributed serialization or multi-process job durability;
- Deck hard-delete command.
