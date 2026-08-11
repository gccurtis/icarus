# PERSONA — versioned Project behavior profiles

PERSONA owns **Project-local, versioned behavior profiles** that shape *how* the
[agent](agents/README.md) capability performs work. A persona is a stable,
Project-scoped identity — a name, a description, and a pointer to a current
definition version — that the Quarterback Plan/Action workflows resolve and
snapshot onto each task they run.

A persona is deliberately **not** several things it could be mistaken for: it is
not an authority principal (it grants no access — Access still decides who may do
what), not a provider/model configuration (that is a [cast](intelligence.md)),
and not a copy of task history (the [agent](agents/README.md) `Task` remains the
canonical record). It is only a reusable description of working style.

- **Domain and persistence contract** —
  [`core/capability/persona`](../../../core/capability/persona/persona.go). The
  `Personas` service holds the identity, versioning, default, and General-template
  logic, and defines the `Store` interface it depends on. It has no knowledge of
  HTTP.
- **Application handlers** —
  [`core/handlers/persona`](../../../core/handlers/persona/persona.go). Thin
  endpoints that translate scoped requests into `Personas` calls and map the
  service's sentinel errors onto HTTP status codes.

## The model

```go
type Definition struct {                 // the immutable payload of one version
	Focus               string
	BehavioralGuidance  string
	ContextReferences   []string          // identifiers for future context assembly; grant no access
	DefaultVerification string
	OutputPreferences   string
}

type Persona struct {                    // stable identity + current-version pointer
	ID, ProjectID, Name, Description string
	CurrentVersion                   int
	CreatedBy                        string
	CreatedAt, UpdatedAt             time.Time
}

type Version struct {                    // one immutable definition, keyed by version number
	PersonaID, ProjectID string
	Version              int
	Definition           Definition
	CreatedBy            string
	CreatedAt            time.Time
}
```

Most reads return a `Record` (`{persona, version}`) — the persona paired with its
resolved `Definition`. A `Snapshot` is the self-contained copy the agent stamps
onto a task, so revising a persona can never rewrite the behavior of work already
run. A `Default` (`{projectId, userId, personaId, updatedAt}`) records which
persona a given user gets in a given project.

## Versioning is append-only

Editing never mutates an existing definition. `Create` writes version 1;
`Revise` (new definition, same name/description) and `Update` (new
name/description/definition) both append a **new immutable `Version =
ExpectedVersion + 1`** and advance `CurrentVersion`. Callers pass the
`ExpectedVersion` they observed; a mismatch is `ErrVersionConflict` (→ `409`), so
concurrent edits are caught rather than silently clobbered. Older versions stay
readable forever through `GET /personas/:id/versions/:version`.

## The General persona and per-user defaults

Every Project has a **General** persona — a deployment-owned template
materialized lazily under the fixed ID `"general"` the first time a project needs
it (`EnsureGeneral`). Its content comes from configuration
(`agents.default_persona`, see [configuration](../configuration.md)); if the
deployment template changes between releases, `EnsureGeneral` appends a new
`system`-authored version. Because it is managed, `Revise`/`Update`/`Delete` on
`"general"` are refused with `ErrManaged` (→ `403`).

A user's **default** persona (`DefaultForUser`) is the stored per-user, per-project
preference, falling back to General when none is set. `PUT /personas/default`
lets any project member — including a read-only one — set their *own* default; it
is intentionally not behind the write-role gate that the create/edit/delete
routes use.

## Project scoping

`Scope{ProjectID}` is trusted context established after [access](access.md)
resolves the selected project. Every read and write re-checks that the target
persona's `ProjectID` matches the scope and returns `ErrProjectScope` (→ `404`)
otherwise, so a persona ID is only meaningful inside its own project.

## HTTP surface

All routes are **project-scoped** (a project must be selected) and register only
when both a persona service and the agent task store are wired
(`opts.Personas != nil && opts.AgentTasks != nil`). Writes require role owner or
edit; reads are open to any member. Error mapping: not-found / wrong-scope →
`404`, invalid input → `400`, already-exists / version-conflict → `409`, a
managed-persona edit → `403`.

| Method & path | Handler | Purpose |
|---|---|---|
| `GET /personas` | `List` | List current records (ensures General exists first). |
| `POST /personas` | `Create` | Create a persona at version 1 (write). Body `{name, description, definition{...}}`. |
| `GET /personas/default` | `Default` | The caller's default record, or General. |
| `PUT /personas/default` | `SetDefault` | Set the caller's own default: `{personaId}` (any member). |
| `GET /personas/:personaID` | `Get` | The persona at its current version. |
| `PUT /personas/:personaID` | `Update` | Replace name/description/definition → new version (write). Body `{expectedVersion, name, description, definition}`. |
| `DELETE /personas/:personaID` | `Delete` | Delete a custom persona (write); General is `403`. |
| `POST /personas/:personaID/revisions` | `Revise` | Append a new definition version, keeping name/description (write). Body `{expectedVersion, definition}`. |
| `GET /personas/:personaID/versions` | `Versions` | The immutable version history. |
| `GET /personas/:personaID/versions/:version` | `GetVersion` | One exact version (`version ≥ 1`). |
| `GET /personas/:personaID/tasks` | `Tasks` | The [agent](agents/README.md) tasks attributed to this persona. |

The last route is the read side of the agent relationship: the handler holds the
agent `*Tasks` store and returns `ListByPersona`, so task history stays owned by
the agent capability with no second copy kept here. The write side is the
reverse — the agent workflows call `Personas.Resolve` to snapshot a persona onto
each task at creation.

## Persistence

Backed by the one SQLite [store](../persistence.md) (`persona.Store`), across
three tables plus a column on the agent tasks:

- **`personas`** — `(project_id, id)` primary key; name, description,
  `current_version`, creator, timestamps.
- **`persona_versions`** — `(project_id, persona_id, version)` primary key;
  `definition` stored as JSON; foreign key to `personas`.
- **`persona_defaults`** — `(project_id, user_id)` primary key; written by upsert.
- **`agent_tasks.persona_id`** carries task attribution (indexed by
  `(project_id, persona_id, created_at)`); the full persona `Snapshot` is also
  embedded in each task's content JSON.

A `MemoryStore` provides the same contract for unit tests.

## Status

**Fully wired and reachable over HTTP today.** The service is constructed in
[`wiring`](../../../core/wiring/wiring.go) from `cfg.Agents.DefaultPersona`,
handed to the transport and to the agent workflows, and all eleven routes
register behind project scope.

## Related

- [Agents](agents/README.md) — the consumer: personas are resolved and snapshotted onto tasks.
- [Configuration](../configuration.md) — the `agents.default_persona` General template.
- [Access](access.md) — establishes the project scope and roles personas rely on.
- [Persistence](../persistence.md) — the SQLite schema behind `persona.Store`.
