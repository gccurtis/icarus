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
├── index.server.ts
├── index.ts                 # Omit when no view reaches this capability yet
├── errors.ts
├── docs/                    # Omit when no supporting doc exists
├── types/
├── api/
├── persistence/             # Omit for stateless capabilities
└── test/
```

## Dependency Ports

List only direct capability dependencies. Infrastructure from `$runtime/server` —
the database registry, the logger, configuration — is imported rather than
injected and is not a port.

| Capability | Usage |
| ---------- | ----- |
| `${{dependency-name}}` | {{What this capability uses it for}} |

## Public API

Every function `index.server.ts` exports. The **Browser** column is the audit
list this table exists for: a `yes` means the function is directly reachable by
an untrusted client, and admission is `'unchecked'`, so that function is the only
thing standing between a hostile payload and the database.

| Function | Browser | Effect | Description | Document |
| -------- | ------- | ------ | ----------- | -------- |
| `{{functionName}}` | {{yes / no}} | {{mutator / accessor}} | {{Behavior}} | [{{function-name}}.md](api/{{function-name}}/{{function-name}}.md) |

## Scope

Every function takes `Scope` as its first parameter. State what this capability
does with each field, and say explicitly if it ignores one.

| Field | Use here |
| ----- | -------- |
| `projectId` | {{Usually: selects the database. Say so, or say why not}} |
| `userId` | {{What it scopes, or "unused — this capability's data is project-wide"}} |

No input type on any function carries these fields. They are derived server-side,
so a client cannot name a project it does not belong to.

## Data Ownership

Include only when the capability persists state. The capability owns its tables,
their SQL, and their invariants. Details live in
[`persistence/persistence.md`](persistence/persistence.md).

| Table | Purpose |
| ----- | ------- |
| `{{table_name}}` | {{State stored by the table}} |

A project is its own database, so no table here carries a `project_id` column.

## Capability Invariants

Constraints that must hold across every public function. A procedure that cannot
preserve one of these fails instead.

- {{Invariant every procedure must preserve.}}
- {{Data ownership or revision invariant.}}
- {{Idempotency or ordering invariant, when relevant.}}

## Supporting Documents

Include only when `docs/` has entries.

| Document | Subject |
| -------- | ------- |
| [{{doc-name}}.md](docs/{{doc-name}}.md) | {{What it explains and why it belongs to no single directory}} |
