# Enforce ports-and-adapters boundaries

Ω-004 starts from `b15f8001c9f55139acd8383a4e2e05b9753af393` on `main`.
Ω-001 is present as record 0162 and its executable baseline; the coordinated
Ω-002 and Ω-003 corrections are also present as records 0163 and 0165. Exact
Resource reading is therefore already Resource-owned, and Knowledge capacity is
already bounded before this increment freezes their dependency direction.

## `core/architecture/`

### Check the real Go graph, not a curated package list

`policy.go` defines direct import edges and deny rules for cross-capability,
capability-to-adapter, handler-to-store/provider, shared-platform-to-product,
composition-root, concrete Connector provider, and archived/experimental
dependencies.

`policy_test.go` runs `go list -json ./core/...`, applies the policy to the actual
repository, and loads reviewed exceptions from completion evidence. It includes
the three required adversarial fixtures: leaf-to-leaf, handler-to-store, and
capability-to-wiring. Exact exceptions must be complete and used; a removed edge
makes its row stale. The ceiling is 18, so the budget may shrink but cannot grow
without a later reviewed packet changing executable policy.

The standard library is sufficient; no dependency or license inventory changed.

## `docs/completion/architecture-exceptions.tsv`

### Make every current departure owned and expiring

The eight capability-type/composition edges, six process-mechanism edges, and
four concrete Connector filesystem/HTTP edges are individually recorded with
owner, rationale, removal condition, and expiry packet. There are no wildcard
or inline suppressions. Ω-014 owns durable job-envelope replacement; Ω-015 owns
the remaining application DTO/tool/provider moves.

## Startup registries and bound ports

### `core/platform/job`

`Registry.Register` now rejects blank types, nil handlers, and duplicates rather
than silently replacing an earlier handler. `Validate` fails if any required
producer type lacks a handler. Wiring registers and validates the four current
types before constructing the pool.

### `core/capability/resource`

`ValidateFamilies` closes the production family registry over Document,
Connector, and File while leaving `New` usable for focused partial tests.
Duplicate, invalid, and missing families are distinct failures.

### `core/capability/intelligence`

Provider construction rejects blank keys, nil or unnamed providers, duplicate
provider identities, and (as before) routes to absent keys. `ToolSet` already
rejected malformed definitions, nil handlers, and duplicate keys;
`ValidateRequired` adds the profile-specific missing-tool check.

### Required late-bound ports

Resource, Connector, Contexts, Documents, Chat, and Knowledge expose
`ValidateBoundPorts` for the ports production requires after the deliberate
construction back-patches. `core/wiring/readiness.go` runs those checks plus the
required Resource family set after job registration and before the job pool,
background workers, or transport listener starts. Focused tests can still omit
optional deployment features without manufacturing global services.

This is an explicit two-phase composition: incomplete construction is useful
inside tests, but never counts as process readiness.

## `scripts/`

### Put architecture in the baseline gate

`scripts/check-architecture.sh` is the focused CI entry point. The Ω baseline
invokes it, retains the exhaustive eight-edge capability import snapshot, and
derives the required four-job and three-family sets from the real production
composition.

`dev-test/resources/run.sh` now expects that real three-family registry. Its
two-family assertion predated Ω-002's File family and was the only failure in
the credential-free aggregate.

## Architecture and completion documentation

### Freeze ownership, cells, transactions, and topology

`docs/architecture/ports-and-adapters.md` defines domain types, inbound/outbound
ports, adapters, the sole composition root, exception governance, and fail-fast
startup. It also freezes the logical
`UserCell(UserID) -> ProjectSubcell(UserID, ProjectID)` contract: cells receive a
complete typed port bundle and retain only disposable scoped coordination state.
They never own canonical Resources, Workspace, jobs, revisions, or outbox rows.

The same document defines the unit-of-work boundary: aggregate state, revision
or ChangeSet, idempotency, Activity, and required Project publication commit in
one transaction; post-commit wake-ups are hints over the durable cursor.
Ω-013 remains the owner of registry leasing/eviction and Ω-014 the owner of the
outbox schema and replica catch-up. This packet does not pre-empt either with a
service locator or pretend process-global services are cells.

The runtime model, issues register, architecture index, startup inventory, and
completion matrix now describe the enforced state. Ω-004 is marked shipped.

## Data, compatibility, rollout, and rollback

There is no schema, route, wire, configuration, or migration change. Existing
valid job registrations keep working; a duplicate or incomplete startup that
previously degraded silently now stops before readiness. Rollout is an ordinary
single-binary replacement. Reverting this commit restores permissive startup but
does not require data rollback.

## Security, privacy, and operations

The import gate prevents capabilities and handlers from reaching concrete
adapters that could bypass owned authorization/store boundaries. Exact exceptions
are reviewable and non-growing. Required Resource organization membership and
Knowledge locator ports now fail closed at startup instead of allowing an
accidentally incomplete production graph.

No secret-bearing configuration is read or emitted by the checker. No paid
provider call is made. Operators may see an immediate, named composition error
for a missing port/registration rather than a later request failure.

## Acceptance evidence

- Import policy: real graph test plus all three adversarial fixtures.
- Exceptions: exact metadata, stale-row rejection, and an 18-row non-growing
  ceiling.
- Registries: duplicate/missing family, tool, job, provider, and required-port
  tests.
- Capability isolation: unit tests continue to construct services over fakes;
  SQLite satisfies capability Store interfaces through compile-time assertions.
- Logical scopes: Workspace tests prove Alice and Bob remain distinct in the
  same Project and a fresh service incarnation rehydrates both through the
  canonical Store port; no sticky routing or singleton cell is involved.
- Exact Resource read: Ω-002 Resource/Knowledge locator and family tests remain
  in the full suite.
- Cell and outbox implementation scope: the typed/disposable cell and atomic
  transaction contracts are frozen here; Ω-013/Ω-014 remain the explicit
  implementation owners rather than hidden residual work in Ω-004.

## Verification

- `./scripts/check-architecture.sh`
- `./scripts/acceptance/omega-baseline.sh --inventory-only`
- focused Architecture, Job, Resource, Intelligence, Connector, Context,
  Document, Chat, Knowledge, Workspace, and Wiring tests
- `./scripts/check-format.sh`
- `go build ./...`
- `go test ./...`
- `./scripts/acceptance/omega-baseline.sh`
- `./dev-test/run.sh free`

The baseline includes `go test -race ./...`. The first credential-free aggregate
identified the stale two-family Resource assertion; after correcting it, the
full group passed. Neither command makes a paid provider call.
