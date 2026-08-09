# Knowledge Derived

## Summary / Concept

<aside>
🧭

**Authority:** This page is an addendum to Platform — Icarus Knowledge Runtime Model. Knowledge owns Derived Outputs, their grounding, revisions, dependency manifests, freshness, and refresh lifecycle.

</aside>

A Derived Output is reusable content produced from an instruction, Context-scoped Knowledge retrieval, and optional structured Data inputs. Document, Slides, and Spreadsheet store only a `DerivedOutputRef` that identifies which immutable output revision the resource currently presents.

Knowledge owns what was requested, retrieved, generated, and refreshed. Each resource capability owns where an output appears and when its reference advances to a newer revision through that resource's ChangeSet.

Derived Output revisions are excluded from lattice ingestion until an explicit canonicalization operation publishes one as an ordinary Source version.

## Types & Interfaces

```tsx
type FormulaWireValue = import("#formula").FormulaWireValue;
type ContextEntry = import("#context").ContextEntry;
type RichContent = import("#platform/rich-text").RichContent;

type DerivedOutputKind = "rich-text" | "value" | "cell-matrix";

interface DerivedOutput {
  id: string;
  kind: DerivedOutputKind;
  definition: DerivedOutputDefinition;
  headRevision: number;
  freshness: DerivedOutputFreshness;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface DerivedOutputDefinition {
  instruction: string;
  context: ContextEntry[];
  inputs: DerivedInputRef[];
  outputContract: DerivedOutputContract;
  definitionRevision: number;
}

type DerivedInputRef =
  | { kind: "resource"; resourceKind: string; resourceId: string; revision?: number }
  | { kind: "data"; entryId: string; revision?: number }
  | { kind: "value"; value: FormulaWireValue };

type DerivedOutputContract =
  | { kind: "rich-text" }
  | { kind: "value"; expectedKind?: string }
  | {
      kind: "cell-matrix";
      expectedColumns?: number;
      expectedRows?: number;
    };

interface DerivedOutputRevision {
  outputId: string;
  revision: number;
  definitionRevision: number;
  content: DerivedOutputContent;
  grounding: DerivedGroundingManifest;
  dependencies: DerivedDependencyManifest;
  contentDigest: string;
  createdAt: string;
}

type DerivedOutputContent =
  | { kind: "rich-text"; content: RichContent }
  | { kind: "value"; value: FormulaWireValue }
  | { kind: "cell-matrix"; cells: FormulaWireValue[][] };

interface DerivedGroundingManifest {
  scope: KnowledgeScopeManifest | null;
  regions: DerivedGroundingRegion[];
  dataInputs: DerivedDataInputSnapshot[];
  groundingDigest: string;
}

interface DerivedGroundingRegion {
  sourceId: string;
  sourceRevision?: number;
  start: number;
  end: number;
  textDigest: string;
}

interface DerivedDataInputSnapshot {
  entryId: string;
  revision: number;
  valueDigest: string;
}

interface DerivedDependencyManifest {
  sources: Array<{ sourceId: string; revision?: number; digest: string }>;
  dataEntries: Array<{ entryId: string; revision: number; valueDigest: string }>;
  dependencyDigest: string;
}

interface DerivedOutputFreshness {
  state: "current" | "stale" | "refreshing" | "failed";
  lastCheckedAt: string | null;
  staleSince?: string;
  diagnostic?: { code: string; message: string };
}

interface DerivedOutputRef {
  outputId: string;
  appliedRevision: number;
}

interface DerivedOutputReader {
  get(outputId: string): Promise<DerivedOutput | null>;
  getRevision(outputId: string, revision: number): Promise<DerivedOutputRevision | null>;
  refresh(outputId: string): Promise<DerivedRefreshResult>;
}
```

The domain uses `id` for the durable Derived Output identity and `revision` for immutable accepted content versions. Job submission and provider-request identifiers remain runtime metadata and do not appear in `DerivedOutputRef` or resource content. Revision `createdAt` records when that revision became canonical; a separate `generatedAt` field is unnecessary.

## Runtime Objects

```tsx
interface DerivedOutputService {
  declare(request: DeclareDerivedOutput): Promise<DerivedOutput>;
  get(id: string): Promise<DerivedOutput | null>;
  getRevision(id: string, revision: number): Promise<DerivedOutputRevision | null>;
  updateDefinition(request: UpdateDerivedOutputDefinition): Promise<DerivedOutput>;
  refresh(id: string): Promise<DerivedRefreshResult>;
  delete(id: string): Promise<void>;
}

interface DerivedOutputGenerator {
  generate(input: FrozenDerivedGenerationInput): Promise<DerivedOutputCandidate>;
}

interface DerivedFreshnessChecker {
  check(output: DerivedOutput, head: DerivedOutputRevision): Promise<DerivedFreshnessResult>;
}

interface FrozenDerivedGenerationInput {
  outputId: string;
  definitionRevision: number;
  priorHeadRevision: number;
  definition: DerivedOutputDefinition;
  scope: KnowledgeScopeManifest | null;
  resourceInputs: FrozenResourceInput[];
  dataInputs: DerivedDataInputSnapshot[];
  generationToken: string;
}
```

The configuration-scoped Knowledge runtime constructs the service, store, generator, freshness checker, Context resolver, Data reader, and Intelligence adapter. Resource capabilities receive only the `DerivedOutputReader` port.

## Change Operations

```tsx
type DerivedOutputChangeOperation =
  | { type: "declare"; output: DerivedOutput }
  | { type: "update-definition"; outputId: string; definition: DerivedOutputDefinition }
  | { type: "begin-refresh"; outputId: string; priorHeadRevision: number; definitionRevision: number }
  | { type: "publish-revision"; outputId: string; revision: DerivedOutputRevision }
  | { type: "mark-current"; outputId: string; checkedAt: string }
  | { type: "mark-stale"; outputId: string; checkedAt: string; reason: string }
  | { type: "mark-failed"; outputId: string; checkedAt: string; diagnostic: { code: string; message: string } }
  | { type: "delete"; outputId: string };
```

Definition and revision updates use revision compare-and-swap. Publishing a revision requires the frozen definition revision and prior head revision to remain current. A changed definition or newer published revision makes the candidate stale and leaves the head unchanged.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | <code>/knowledge/derived-outputs</code> | Declare an output definition and start its first refresh. |
| GET | <code>/knowledge/derived-outputs?id=</code> | Read output metadata and current freshness. |
| GET | <code>/knowledge/derived-output-revisions?outputId=&revision=</code> | Read one immutable revision. |
| PATCH | <code>/knowledge/derived-output-definition</code> | Update instruction, Context, inputs, or output contract. |
| POST | <code>/knowledge/derived-output-refresh</code> | Check dependencies and publish a newer revision when required. |
| DELETE | <code>/knowledge/derived-outputs</code> | Soft-delete an output identity. |

A resource refresh first calls Knowledge refresh, then compares the returned head revision with its `appliedRevision`. When newer, the resource appends its own `apply-derived-output` ChangeSet that advances the reference.

## Jobs

| Job | Queue path | Effect |
| --- | --- | --- |
| <code>knowledge.derived-output.declare</code> | serial → concurrent → serial | Persist identity and definition, generate the first candidate, publish revision 1 when preconditions remain current. |
| <code>knowledge.derived-output.read</code> | concurrent | Read metadata or one immutable revision without mutation. |
| <code>knowledge.derived-output.update-definition</code> | serial | Apply compare-and-swap and mark the current head stale. |
| <code>knowledge.derived-output.refresh</code> | serial → concurrent → serial | Freeze inputs, check dependencies, retrieve and generate when required, then publish conditionally. |
| <code>knowledge.derived-output.delete</code> | serial | Soft-delete the output identity. |

The scheduler's Job ID provides idempotency and tracing for one execution. It is runtime metadata rather than a field in editor content.

## SQL Tables

```sql
CREATE TABLE knowledge_derived_outputs (
  id                  TEXT PRIMARY KEY,
  kind                TEXT NOT NULL,
  definition          BLOB NOT NULL,
  definition_revision INTEGER NOT NULL,
  head_revision       INTEGER NOT NULL DEFAULT 0,
  freshness_state     TEXT NOT NULL,
  last_checked_at     TEXT,
  stale_since         TEXT,
  diagnostic          BLOB,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);

CREATE TABLE knowledge_derived_output_revisions (
  output_id           TEXT NOT NULL,
  revision            INTEGER NOT NULL,
  definition_revision INTEGER NOT NULL,
  content             BLOB NOT NULL,
  grounding_manifest  BLOB NOT NULL,
  dependency_manifest BLOB NOT NULL,
  content_digest      TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  PRIMARY KEY (output_id, revision),
  FOREIGN KEY (output_id)
    REFERENCES knowledge_derived_outputs(id)
);

CREATE INDEX knowledge_derived_outputs_freshness
  ON knowledge_derived_outputs(freshness_state, updated_at, id);

CREATE INDEX knowledge_derived_output_revisions_recent
  ON knowledge_derived_output_revisions(output_id, revision DESC);
```

Dependencies remain in the immutable revision manifest. A rebuildable reverse dependency index may be derived from the head manifests for freshness scans and Activity integration.

## Refresh and Resource Adoption

```
resource load or refresh
  → read DerivedOutputRef(outputId, appliedRevision)
  → Knowledge.refresh(outputId)
  → receive current head revision
  → unchanged: keep resource state
  → newer: resource appends apply-derived-output ChangeSet
  → resource now points to outputId@newRevision
```

Knowledge can refresh independently of any one resource. Each resource decides when to adopt a newer revision, preserving exact snapshots, collaboration history, export determinism, undo, and redo.