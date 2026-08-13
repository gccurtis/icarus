# {{Capability Name}} Overview

## Description

{{Capability Name}} is {{a brief description of the capability}}.

It provides {{key behavior or functionality}} so that {{users or other capabilities can achieve a specific goal}}.

## File Tree

Show only files that belong to this capability or directly define its public integration surface.

```text
{{capability-name}}/
├── overview.md
├── index.ts
├── runtime.ts
├── types.ts
├── schema.sql               # Omit for stateless capabilities
├── runtime-constructors/    # Omit when the capability has no runtime object
│   └── {{runtime-object-name}}.ts
├── {{procedure-name}}.ts
└── helpers/               # Omit until needed
```

## Dependency Ports

List only direct capability dependencies. Platform objects such as the database, web server, and job system belong under Runtime Objects or Constructor Parameters rather than in this table.

| Capability | Usage |
| ---------- | ----- |
| `{{DependencyName}}` | {{What this capability uses the dependency for}} |


## Runtime Objects

These are objects with one instance per backend runtime, constructed by
[`main.ts`](../../src/main.ts) during startup. They own the capability's state
and behavior, and they coordinate with other capabilities through their public
APIs.

| Object | Description | File |
| ------ | ----------- | ---- |
| `{{RuntimeObjectName}}` | {{Runtime responsibility}} | [{{runtime.ts}}]({{relative path}}) |


## Public API

| API           | Kind                                             | Owner / Transport       | Description                           | File                                       |
| ------------- | ------------------------------------------------ | ----------------------- | ------------------------------------- | ------------------------------------------ |
| `{{apiName}}` | {{runtime method / HTTP endpoint / job handler}} | `{{RuntimeObjectName}}` | {{Brief description of the behavior}} | [{{procedure-name}}.ts]({{relative path}}) |


## Data Ownership

Include this section only when the capability persists state. The capability owns its tables, migrations, SQL, records, and data invariants.

| Table            | Purpose                       |
| ---------------- | ----------------------------- |
| `{{table_name}}` | {{State stored by the table}} |


## Runtime Object Details

### Runtime Object: `{{RuntimeObjectName}}`

{{Describe what the object owns, what it coordinates, how other capabilities use it, and what it deliberately does not own.}}

#### Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `{{fieldName}}` | `{{FieldType}}` | {{Purpose of the field}} |


#### Constructor Parameters

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `{{parameterName}}` | `{{ParameterType}}` | {{Dependency or configuration supplied to the constructor}} |


#### Construction Steps

```md
1. {{Receive required ports and configuration.}}
2. {{Create controlled runtime state or registries.}}
3. {{Register internal handlers when applicable.}}
    3.a.1 || {{Initialization condition fails}} → {{Return or throw the defined initialization error.}}
5. {{Return the initialized runtime object.}}
```

## API Details

Create one subsection for every public API listed in the Public API table.

### API: `{{apiName}}`

{{Describe the purpose of the API, who calls it, and when it should be used.}}

#### API Classification

- **Kind:** {{runtime method / HTTP endpoint / job handler}}
- **Owner:** `{{RuntimeObjectName}}`
- **Execution:** {{mutator / accessor}}
- **Transaction:** {{none / PG transaction}}

#### Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `{{inputName}}` | `{{InputType}}` | {{Meaning of the input}} |


#### Output

`{{OutputType}}`

{{Describe only what the caller receives, including important success and failure variants.}}

#### Effects

- {{Canonical state mutation, if any.}}
- {{Revision created, if any.}}
- {{Activity or project change fact published, if any.}}
- {{Job submitted, if any.}}
- {{External provider call, if any.}}
- {{State “None” when the procedure is read-only and has no external effects.}}

#### Procedure Tree

Use `||` for conditional branches. Link important internal procedures to their files when that materially helps implementation.

```text
receive {{input}}
  1. {{first procedural operation}}
  2. {{next procedural operation}}
  || {{condition}}
     2.a.1. {{conditional behavior}}
  || {{alternative condition}}
     2.b.1. {{alternative behavior}}
  3. {{commit or finalize}}
  4. return {{output}}
```

#### Supporting Functions

Include only internal functions that materially explain the public procedure. Do not turn this section into an index of every helper.

| Function | Purpose | File |
| -------- | ------- | ---- |
| `{{functionSignature}}` | {{Internal responsibility}} | [{{function-file}}.ts]({{relative path}}) |

## Capability Invariants

- {{Invariant every procedure must preserve.}}
- {{Data ownership or revision invariant.}}
- {{Project-isolation invariant.}}
- {{Idempotency or job-ordering invariant, when relevant.}}
- {{Any constraint that must remain true across all public APIs.}}

## Types

Define types here as needed to support with implementation.

### Type: `{{TypeName}}`

```ts
export type {{TypeName}} = {
  {{fieldName}}: {{FieldType}};
};
```
