# Capability — Icarus Persona Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502812ba7f3dc13f80699f3).

## Summary / Concept
Persona is the first capability in the **Agentic** build group. It owns deterministic, versioned behavior definitions that tell an Agent how to focus, behave, verify, and present work. A task receives an exact immutable Persona snapshot; later edits cannot change an existing task.
### Prerequisites
- Library Kernel asset, immutable-version, lineage, and materialization coordination.
- Context exact-version reference reader.
- Database, canonical digest utilities, logger, IDs, clock, and the dual-queue runtime.
### Provides downstream
Persona provides immutable definitions, exact snapshots, a revisioned default pointer, and catalog summaries to Agents, Research, Automation, and editor prompt workflows.
### Ownership and placement
Library Kernel owns generic asset identity and version envelopes. Persona owns the typed payload, local copies, default selection, validation, and snapshot construction. Agents owns model calls, task policy, execution, and results.
```plain text
apps/backend/src/
  3-capabilities/
    persona/
      domain/
      application/
      ports/
      persistence/
      projections/
      index.ts
  4-job-wiring/
    persona/
      registerPersonaEndpointMappings.ts
      createPersonaJobs.ts
```
## Types & Interfaces
```typescript
export interface ContextVersionRef {
  contextId: string;
  version: number;
  digest: string;
}

export interface PersonaDefinition {
  focus: string;
  behavioralGuidance: string;
  outputPreferences: string;
  defaultVerification: string;
  contextReferences: ContextVersionRef[];
}

export interface PersonaSnapshot {
  sourceKind: "library" | "local";
  sourceId: string;
  sourceVersion: number;
  name: string;
  definition: PersonaDefinition;
  definitionDigest: string;
}

export interface LocalPersona {
  id: string;
  name: string;
  lifecycle: "active" | "trashed";
  revision: number;
  headVersion: number;
  source?: { assetId: string; version: number; digest: string };
  createdAt: string;
  updatedAt: string;
}

export interface PersonaDefault {
  revision: number;
  source: {
    kind: "library" | "local";
    id: string;
    version: number;
    digest: string;
  };
  updatedAt: string;
}

export interface PersonaCommands {
  publish(command: PublishPersonaCommand): Promise<PersonaVersionRef>;
  revise(command: RevisePersonaCommand): Promise<PersonaVersionRef>;
  materialize(command: MaterializePersonaCommand): Promise<LocalPersona>;
  applyLocal(command: ApplyLocalPersonaChangesCommand): Promise<LocalPersona>;
  setDefault(command: SetPersonaDefaultCommand): Promise<PersonaDefault>;
}

export interface PersonaReader {
  get(ref: ExactPersonaRef): Promise<PersonaDefinition>;
  list(input: PersonaListInput): Promise<PersonaSummary[]>;
  snapshot(ref?: ExactPersonaRef): Promise<PersonaSnapshot>;
}
```
Every Context reference names an exact immutable version and digest. Snapshot construction verifies the Persona digest and every Context reference before returning.
## Runtime Objects
```typescript
export interface PersonaRuntime {
  commands: PersonaCommands;
  reader: PersonaReader;
  projections: PersonaProjectionReader;
}

export function createPersonaRuntime(deps: {
  repository: PersonaRepository;
  library: LibraryKernelPort;
  contexts: ContextVersionReader;
  digests: CanonicalDigest;
  actor: ActorAttribution;
  clock: Clock;
  logger: Logger;
}): PersonaRuntime {
  const service = new PersonaService(deps);
  return {
    commands: service,
    reader: service,
    projections: new PersonaProjectionService(deps)
  };
}
```
- `PersonaService` validates and normalizes definitions, coordinates Library publication, manages local versions, and moves the default pointer.
- `PersonaSnapshotReader` returns one exact digest-checked value for task construction.
- `PersonaProjectionService` builds bounded catalog and usage summaries.
- Local copies remain independent after exact source lineage is recorded.
## Change Operations
```typescript
export type PersonaChangeOperation =
  | { type: "publish_library_version"; assetId: string; definition: PersonaDefinition }
  | { type: "materialize_local"; source: ExactPersonaRef; localPersonaId: string }
  | { type: "publish_local_version"; personaId: string; definition: PersonaDefinition }
  | { type: "rename_local"; personaId: string; name: string }
  | { type: "trash_local"; personaId: string }
  | { type: "restore_local"; personaId: string }
  | { type: "set_default"; source: ExactPersonaRef };
```
Library and local definitions are immutable after publication. Local metadata and the default pointer use expected-revision compare-and-swap. Every command stores a client request ID and request digest; replay with another digest is `idempotency_mismatch`.
## Endpoints
- `POST /personas` — create a Library Persona and first immutable version.
- `POST /personas/:assetId/versions` — publish the next Library version.
- `GET /personas` — list catalog summaries.
- `GET /personas/:assetId` — get the head summary.
- `GET /personas/:assetId/versions/:version` — get an exact definition.
- `POST /personas/:assetId/versions/:version/materialize` — create an independent local copy.
- `PATCH /personas/local/:personaId` — rename, trash, or restore local metadata.
- `POST /personas/local/:personaId/versions` — publish the next local version.
- `PUT /personas/default` — move the revisioned default pointer.
- `GET /internal/personas/snapshot` — resolve an exact task-ready snapshot.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response</td>
<td>Calls / emits</td>
</tr>
<tr>
<td>Create or revise Library Persona</td>
<td>\<code\>PublishPersonaJob\</code\></td>
<td>Serial</td>
<td>Inline</td>
<td>Publishes Library envelope and typed payload atomically</td>
</tr>
<tr>
<td>Materialize or mutate local Persona</td>
<td>\<code\>ApplyLocalPersonaJob\</code\></td>
<td>Serial</td>
<td>Inline</td>
<td>Emits local Persona operations under CAS</td>
</tr>
<tr>
<td>Set default</td>
<td>\<code\>SetPersonaDefaultJob\</code\></td>
<td>Serial</td>
<td>Inline</td>
<td>Validates exact source and appends default change</td>
</tr>
<tr>
<td>Get, list, or exact version</td>
<td>\<code\>ReadPersonaJob\</code\></td>
<td>Concurrent</td>
<td>Inline</td>
<td>Calls \<code\>PersonaReader\</code\></td>
</tr>
<tr>
<td>Resolve task snapshot</td>
<td>\<code\>ResolvePersonaSnapshotJob\</code\></td>
<td>Concurrent</td>
<td>Internal inline</td>
<td>Verifies Persona and Context digests</td>
</tr>
</table>
## SQL Tables
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE persona_version_payloads (
  asset_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  focus TEXT NOT NULL,
  behavioral_guidance TEXT NOT NULL,
  output_preferences TEXT NOT NULL,
  default_verification TEXT NOT NULL,
  context_references_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(context_references_json)),
  definition_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, version),
  FOREIGN KEY (asset_id, version)
    REFERENCES library_asset_versions(asset_id, version)
) STRICT;

CREATE TABLE local_personas (
  persona_id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'trashed')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  head_version INTEGER NOT NULL DEFAULT 1 CHECK (head_version > 0),
  source_asset_id TEXT,
  source_version INTEGER CHECK (source_version IS NULL OR source_version > 0),
  source_digest TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  trashed_at TEXT,
  CHECK ((source_asset_id IS NULL AND source_version IS NULL AND source_digest IS NULL) OR
         (source_asset_id IS NOT NULL AND source_version IS NOT NULL AND source_digest IS NOT NULL)),
  CHECK ((lifecycle = 'trashed' AND trashed_at IS NOT NULL) OR
         (lifecycle = 'active' AND trashed_at IS NULL))
) STRICT;

CREATE TABLE local_persona_versions (
  persona_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  focus TEXT NOT NULL,
  behavioral_guidance TEXT NOT NULL,
  output_preferences TEXT NOT NULL,
  default_verification TEXT NOT NULL,
  context_references_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(context_references_json)),
  definition_digest TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (persona_id, version),
  UNIQUE (persona_id, client_request_id),
  FOREIGN KEY (persona_id) REFERENCES local_personas(persona_id)
) STRICT;

CREATE TABLE persona_defaults (
  singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('library', 'local')),
  source_id TEXT NOT NULL,
  source_version INTEGER NOT NULL CHECK (source_version > 0),
  source_digest TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE persona_default_changes (
  singleton_key INTEGER NOT NULL DEFAULT 1 CHECK (singleton_key = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  from_revision INTEGER NOT NULL CHECK (from_revision >= 0),
  to_revision INTEGER NOT NULL CHECK (to_revision > 0),
  client_request_id TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL,
  forward_operation_json TEXT NOT NULL CHECK (json_valid(forward_operation_json)),
  inverse_operation_json TEXT NOT NULL CHECK (json_valid(inverse_operation_json)),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (singleton_key, revision),
  FOREIGN KEY (singleton_key) REFERENCES persona_defaults(singleton_key),
  CHECK (to_revision = revision AND to_revision = from_revision + 1)
) STRICT;

CREATE INDEX persona_versions_digest
  ON persona_version_payloads(definition_digest, asset_id, version);
CREATE INDEX local_personas_updated
  ON local_personas(lifecycle, updated_at DESC, persona_id);
CREATE INDEX local_personas_source
  ON local_personas(source_asset_id, source_version, source_digest);
CREATE INDEX local_persona_versions_head
  ON local_persona_versions(persona_id, version DESC);
CREATE INDEX local_persona_versions_digest
  ON local_persona_versions(definition_digest, persona_id, version);
CREATE INDEX persona_default_changes_recent
  ON persona_default_changes(singleton_key, revision DESC);
```
Library payload insertion participates in the Library publication transaction. Local version publication increments `head_version` with compare-and-swap. Default mutation appends its forward and inverse operation before advancing the singleton revision.
## Runtime Laws, Projections & Acceptance
- `persona_catalog_summary` combines safe Library metadata with bounded focus and output summaries.
- `persona_task_usage` groups Agent-owned task snapshots by exact Persona source and version; Agents remains authoritative.
- Every Library payload belongs to an asset of kind `persona`.
- Published Library and local versions are immutable and content-addressed.
- Every default points to an existing exact version with the same digest.
- Every local copy is independent and preserves exact source lineage.
- Task snapshots are immutable.
- Logs carry safe identities, versions, and digests rather than behavioral text.
- Stale head or default revisions leave canonical state unchanged.
- Materialization produces local version 1 with lineage.
