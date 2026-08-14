# {{Capability Name}} Overview

Lives at the capability root as `overview.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question. Keep the detail in those documents; keep the orientation here.

## Description

{{Capability Name}} is {{a brief description of the capability}}.

It provides {{key behavior}} so that {{consumers can achieve a specific goal}}.

## Boundary

{{Capability Name}} owns:

- {{state, identifiers, or behavior it is authoritative for}}

Consumers own:

- {{what callers keep, decide, or authorize themselves}}

## File Tree

Show only directories and files that belong to this capability. Omit directories
the capability does not have.

```text
{{capability-name}}/
├── overview.md
├── index.ts
├── errors.ts
├── docs/                    # Omit when no supporting doc exists
├── types/
├── runtime-objects/
├── runtime-api/
├── persistence/             # Omit for stateless capabilities
├── endpoints/               # Omit when the capability registers no endpoint
└── test/
```

## Dependency Ports

List only direct capability dependencies. Platform objects supplied to the
constructor — database, web server, logger — belong in the runtime object's own
document, not here.

| Capability | Usage |
| ---------- | ----- |
| `{{DependencyName}}` | {{What this capability uses it for}} |

## Runtime Objects

One instance per backend runtime, constructed by
[`build-runtime.ts`](../../src/runtime/runtime.md) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `{{RuntimeObjectName}}` | {{yes / internal}} | {{Runtime responsibility}} | [{{object-name}}.md](runtime-objects/{{object-name}}/{{object-name}}.md) |

Exported objects leave the capability through `index.ts`. Internal objects are
constructed for injection inside the capability and have no `runtime-api`
directories.

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `{{methodName}}` | runtime method | `{{RuntimeObjectName}}` | {{Behavior}} | [{{method-name}}.md](runtime-api/{{method-name}}/{{method-name}}.md) |
| `{{METHOD}} {{/path}}` | endpoint-job | — | {{Behavior}} | [{{endpoint-name}}.md](endpoints/{{endpoint-name}}/{{endpoint-name}}.md) |

## Data Ownership

Include only when the capability persists state. The capability owns its tables,
their SQL, and their invariants. Details live in
[`persistence/persistence.md`](persistence/persistence.md).

| Table | Purpose |
| ----- | ------- |
| `{{table_name}}` | {{State stored by the table}} |

## Capability Invariants

Constraints that must hold across every public API. A procedure that cannot
preserve one of these fails instead.

- {{Invariant every procedure must preserve.}}
- {{Data ownership or revision invariant.}}
- {{Idempotency or ordering invariant, when relevant.}}

## Supporting Documents

Include only when `docs/` has entries.

| Document | Subject |
| -------- | ------- |
| [{{doc-name}}.md](docs/{{doc-name}}.md) | {{What it explains and why it belongs to no single directory}} |
