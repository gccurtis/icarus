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
├── schema.ts                # Omit when the capability stores nothing
├── errors.ts                # Omit when it states no refusals
├── docs/                    # Omit when no supporting doc exists
├── types/
├── api/
└── test/
```

Its registrations live at `src/convex/capabilities/{{capabilityName}}.ts` — outside
the capability, because a Convex module's path is its public name.

## Dependency Ports

List only direct capability dependencies.

| Capability | Usage |
| ---------- | ----- |
| `${{dependency-name}}` | {{What this capability uses it for}} |

## Public API

Every function the deployment door registers. **This table is the audit list:
everything in it is reachable by anything holding the deployment URL.** There is
no unexposed public function.

| Function | Kind | Description | Document |
| -------- | ---- | ----------- | -------- |
| `{{functionName}}` | {{query / mutation}} | {{Behavior}} | [{{function-name}}.md](api/{{function-name}}/{{function-name}}.md) |

## Scope

Every handler receives `ctx.scope`, produced by `projectQuery`/`projectMutation`
before it runs. State what this capability does with each field, and say
explicitly if it ignores one.

| Field | Use here |
| ----- | -------- |
| `projectId` | {{Usually: the value every index leads with. Say so, or say why not}} |
| `userId` | {{What it scopes, or "unused — this capability's data is project-wide"}} |

No input type carries these fields. A caller sends a project *token*, resolved
against their own memberships, so a client cannot name authority it does not
have.

**A capability registering unscoped functions says why here.** That is a rare
exception and should read as one.

## Data Ownership

Include only when the capability persists state. The capability owns what it
stores, every read and write against it, and its invariants.

| Stored | Purpose |
| ------ | ------- |
| `{{table_name}}` | {{State stored}} |

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
