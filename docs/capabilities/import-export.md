# Import and Export Capability Reference

## Purpose

Import/Export is the translation capability between immutable Source versions, native Resource snapshots, and external file formats. It uses isolated, resource-limited format workers and versioned JSON contracts, then calls Sources and native Resource capabilities through public ports. Workers are isolated subprocesses controlled by the backend.

## Bottom line

Import and export are deliberately asymmetric:

- **Import:** exact uploaded Source version → isolated parser → validated Icarus draft → native Resource create command.
- **Export:** exact native Resource revision → immutable export snapshot → isolated renderer → downloadable artifact plus fidelity diagnostics.

Import creates new native Resources through validated semantic drafts. Export targets high fidelity from exact native Resource revisions. Unsupported features are dropped or materialized with explicit diagnostics, and canonical Icarus models contain typed semantic state.

General uploaded files are Sources. Document, Slides, and Spreadsheet are native Resources. Import/Export translates between these distinct authorities.

## Runtime placement

The capability runs in the existing backend and bounded concurrent queue. Format libraries execute in isolated subprocesses with CPU, memory, time, file-count, and output-size limits.

```plain text
apps/backend/src/
  3-capabilities/
    import-export/
      domain/
        translation.ts
        diagnostics.ts
        workerContracts.ts
        events.ts
      application/
        importService.ts
        exportService.ts
        workerRunner.ts
        artifactService.ts
      adapters/
        docx/
        pptx/
        xlsx/
        pdf/
      ports/
        sourceReader.ts
        resourceReaders.ts
        resourceCommandContracts.ts
        repository.ts
      persistence/
        migrations.ts
        sqliteTranslationRepository.ts
      projections/
        statusProjection.ts
        fidelitySummary.ts
      index.ts
  4-job-wiring/
    internal/
      InternalJobDispatcher.ts
    import-export/
      registerImportExportEndpointMappings.ts
      createImportJobs.ts
      createExportJobs.ts

apps/backend/workers/import-export/
  office-ts/                         DOCX import/export, PPTX export
  office-python/                     PPTX import, XLSX export, PDF
  office-go/                         XLSX import
  schemas/                           versioned JSON/NDJSON contracts
```

The worker directories are deployment artifacts owned by this capability. The parent process supplies bounded input files and reads bounded output files through versioned DTOs. Multi-stage orchestration belongs to `4-job-wiring/internal/InternalJobDispatcher`; Import/Export returns typed stage intents.

## Format adapter decisions

| Translation path | Worker | Core contract |
|---|---|---|
| DOCX → Document | TypeScript: Mammoth + parse5 | Semantic content first; sanitize an allowlisted AST |
| Document → DOCX | TypeScript: `docx` | Editable Word structure and explicit breaks; Word owns repagination |
| PPTX → Slides | Python: python-pptx | Static editable objects, notes, sections, and integer EMU geometry |
| Slides → PPTX | TypeScript: PptxGenJS | Fixed-canvas geometry, notes, sections, objects, and charts |
| XLSX → Spreadsheet | Go: Excelize | Each visible worksheet creates one Spreadsheet from sparse chunks |
| Spreadsheet → XLSX | Python: XlsxWriter | One visible worksheet with formulas and accepted cached results |
| Native Resource → PDF | Python: WeasyPrint-based family renderers | Exact revision and static presentation from family-owned layout input |

## Authority and integration boundaries

Import / Export owns:

- translation request, state, exact input/output references, options, and request digest;
- worker invocation, schema version, diagnostics, fidelity report, and execution events;
- generated artifact metadata and download readiness;
- format adapter registry and versioned worker DTOs.

Integrated authority:

- Sources owns uploaded binary and captured website Source identity, versions, and immutable blob references.
- Document, Slides, and Spreadsheet own native Resource identity, lifecycle, validation, revision, and ChangeSets.
- Connectors own external synchronization. Knowledge owns ingestion and lattice projection.
- Agents and Platform Intelligence own assisted reasoning; Research owns web retrieval.

## Core data model

```typescript
export type TranslationDirection = "import" | "export";
export type TranslationFormat = "docx" | "pptx" | "xlsx" | "pdf";
export type TranslationState =
  | "accepted"
  | "validating"
  | "converting"
  | "committing"
  | "succeeded"
  | "partially_succeeded"
  | "failed"
  | "canceled";

export interface Translation {
  id: string;
  userId: string;
  projectId: string;
  direction: TranslationDirection;
  format: TranslationFormat;
  source: {
    kind: "source" | "document" | "slides" | "spreadsheet";
    id: string;
    revision: string;
    digest: string;
  };
  options: Record<string, unknown>;
  state: TranslationState;
  result?: { kind: string; id: string; revision?: string };
  createdAt: string;
  updatedAt: string;
}

export interface WorkerRequest<TOptions = Record<string, unknown>> {
  contractVersion: string;
  translationId: string;
  inputPath: string;
  inputDigest: string;
  outputDirectory: string;
  limits: WorkerLimits;
  options: TOptions;
}

export interface WorkerLimits {
  timeoutMs: number;
  maxMemoryBytes: number;
  maxInputBytes: number;
  maxOutputBytes: number;
  maxFiles: number;
}

export interface WorkerArtifact {
  role: "primary" | "preview" | "supporting";
  path: string;
  mimeType: string;
  digest: string;
  byteSize: number;
}

export interface TranslationDiagnostic {
  severity: "info" | "warning" | "error";
  code: string;
  location?: Record<string, unknown>;
  message: string;
}

export interface WorkerResult<TDraft> {
  contractVersion: string;
  translationId: string;
  outputDigest: string;
  draft?: TDraft;
  artifacts: WorkerArtifact[];
  diagnostics: TranslationDiagnostic[];
}
```

## Operations and job classification

| Request type or stage | Queue | Response |
|---|---|---|
| `translations.import.v1`, `translations.export.v1` | Serial | Deferred `202` with translation ID |
| `translation.worker.convert` | Concurrent | Internal stage result |
| Destination Resource create command | Owning Resource serial job | Internal result |
| `translation.settle` | Serial | Internal settlement |
| `translations.get.v1`, `diagnostics.list.v1`, `artifacts.get.v1` | Concurrent | Inline |

Each Job has one immutable queue assignment. Request, worker execution, Resource commit, and settlement are explicit stages connected by the durable translation ID.

The serial acceptance stage persists the translation and an idempotent `convert` stage receipt, then returns an `InternalStageIntent`. After commit, `InternalJobDispatcher` enqueues the concurrent conversion. Conversion returns a typed Resource-command or artifact-settlement intent; wiring enqueues that later stage. Every stage is keyed by `(translationId, stageKey)` and request digest. Repetition returns its recorded result; a different digest is `idempotency_mismatch`. Job wiring owns Scheduler invocation and follow-on dispatch.

## Revision and event model

A translation request is immutable after creation. Its lifecycle is an append-only state machine:

```plain text
accepted → validating → converting → committing → succeeded
                                          ↘ partially_succeeded
               ↘ failed
               ↘ canceled
```

Translation requests are immutable operational records rather than editable content, so lifecycle changes append events rather than ChangeSets. Retries create a new attempt under the same request or a new request when options or input change. A repeated `clientRequestId` and digest returns the original translation.

Imported Resource creation records ordinary Resource revision 1 and provenance back to the exact Source version and translation. Export pins one exact Resource revision. Events include `TranslationAccepted`, `WorkerCompleted`, `ResourceImported`, `ArtifactExported`, and `TranslationSettled`.

## Capability-owned tables

```sql
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('import','export')),
  format TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  options_json TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL,
  result_kind TEXT,
  result_id TEXT,
  result_revision TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (user_id, project_id, client_request_id),
  UNIQUE (user_id, project_id, id)
);

CREATE TABLE translation_attempts (
  id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  worker_kind TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  state TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  output_digest TEXT,
  started_at TEXT,
  completed_at TEXT,
  UNIQUE (translation_id, attempt),
  UNIQUE (user_id, project_id, translation_id, id),
  FOREIGN KEY (user_id, project_id, translation_id)
    REFERENCES translations(user_id, project_id, id)
);

CREATE TABLE translation_diagnostics (
  id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  attempt_id TEXT,
  severity TEXT NOT NULL,
  code TEXT NOT NULL,
  location_json TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id, project_id, translation_id)
    REFERENCES translations(user_id, project_id, id),
  FOREIGN KEY (user_id, project_id, translation_id, attempt_id)
    REFERENCES translation_attempts(user_id, project_id, translation_id, id)
);

CREATE TABLE translation_artifacts (
  id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  content_digest TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id, project_id, translation_id)
    REFERENCES translations(user_id, project_id, id)
);

CREATE TABLE translation_events (
  translation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  state TEXT NOT NULL,
  safe_detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (translation_id, seq),
  FOREIGN KEY (user_id, project_id, translation_id)
    REFERENCES translations(user_id, project_id, id)
);

CREATE TABLE translation_stage_receipts (
  translation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  stage_kind TEXT NOT NULL,
  queue_type TEXT NOT NULL CHECK (queue_type IN ('serial','concurrent')),
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL,
  result_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (translation_id, stage_key),
  FOREIGN KEY (user_id, project_id, translation_id)
    REFERENCES translations(user_id, project_id, id)
);
```

Translations are retained operation records. Artifact-byte lifecycle preserves the translation receipt and diagnostics. `source_id` and `result_id` are cross-capability typed addresses validated through Source and Resource ports.

## SQL indexes

```sql
CREATE INDEX translations_project_updated
  ON translations(user_id, project_id, updated_at DESC, id DESC);
CREATE INDEX translations_state_updated
  ON translations(user_id, project_id, state, updated_at, id);
CREATE INDEX translations_source
  ON translations(user_id, project_id, source_kind, source_id, source_revision);
CREATE INDEX diagnostics_translation_severity
  ON translation_diagnostics(user_id, project_id, translation_id, severity, created_at);
CREATE INDEX artifacts_translation_role
  ON translation_artifacts(user_id, project_id, translation_id, role);
CREATE INDEX translation_stages_pending
  ON translation_stage_receipts(
    state, queue_type, updated_at, user_id, project_id, translation_id
  );
```

## Named rebuildable projections

- `translation_status`: current progress, attempt, warning/error counts, result, and timestamps derived from translations, attempts, events, and diagnostics.
- `translation_fidelity_summary`: stable supported/materialized/dropped feature counts grouped by family and location.
- `export_artifact_catalog`: ready output artifacts with safe filename and MIME projection.

These are rebuildable read models, distinct from SQL indexes. Artifact bytes and canonical Resource and Source records remain authoritative.

## Dependencies and ports

Required:

- Source exact-version and blob reader.
- Document, Slides, and Spreadsheet immutable export snapshot readers.
- corresponding public create command/result contracts for imports; wiring owns invocation.
- bounded file workspace, subprocess runner, IDs, clock, digest, database, logger.

Provided:

- import/export request commands;
- status, diagnostic, and artifact readers;
- translation provenance reader.

Workers receive versioned files and DTOs through the bounded worker runner. The parent process owns database, provider, retrieval, and capability interactions.

## Intelligence and web use

The canonical conversion path is deterministic. Assisted repair is an Agent workflow that produces a reviewed Resource command with explicit diagnostics and provenance.

## Principal import flow

```mermaid
sequenceDiagram
  participant U as "User"
  participant I as "InternalJobDispatcher"
  participant X as "Import / Export"
  participant S as "Source"
  participant W as "Isolated worker"
  participant R as "Native Resource capability"
  U->>X: Import exact Source version
  X-->>I: Committed convert-stage intent
  I->>X: Concurrent idempotent conversion stage
  X->>S: Read immutable file
  X->>W: Convert under limits
  W-->>X: Versioned draft and diagnostics
  X->>X: Strict validation
  X-->>I: Serial Resource-command intent
  I->>R: Public create command
  R-->>I: Resource ID and revision 1
  I->>X: Serial settlement stage
  X-->>U: Durable result plus fidelity report
```

## Invariants

- Every translation pins one exact Source or Resource revision.
- Workers execute with bounded filesystem and subprocess authority.
- Parent process strictly validates every worker output.
- Each imported Resource commits atomically.
- XLSX may partially succeed across independent visible worksheets, but each created Spreadsheet is atomic.
- Export serializes the exact semantic Resource snapshot selected by the family export port.
- Unsupported features produce explicit fidelity diagnostics.
- A retry returns the existing Resource or artifact result.
- Every stage is idempotent by translation ID, stage key, and request digest.
- Job wiring owns Scheduler invocation and each stage commits before follow-on dispatch.

## Conformance scenarios

1. Translate Document ↔ DOCX and Document → PDF through the shared translation state machine.
2. Recover requests, attempts, diagnostics, artifacts, stage receipts, and provenance from canonical records.
3. Execute isolated workers through subprocesses and the bounded concurrent pool.
4. Translate PPTX and XLSX through the same versioned worker contracts.
5. Recover accepted and converting translations after process restart.

## Acceptance criteria

- [ ] Import creates native state only through the destination capability.
- [ ] Export reads one immutable revision.
- [ ] More conversions than concurrent slots wait in FIFO backlog.
- [ ] Hostile or oversized input fails while canonical Resource state remains atomic.
- [ ] Duplicate requests return the original result.
- [ ] Replaying conversion, destination-command, or settlement stages returns recorded effects.
- [ ] Fidelity diagnostics identify dropped/materialized features.
- [ ] Status and fidelity projections rebuild from canonical translation records.
- [ ] Worker sandboxing confines workers to declared files, limits, and versioned DTOs.

## References

- [Operation Codex — File Translation, Import, and Export](https://app.notion.com/p/394b6410e50281b3bb8bc8dd2d22ae5e)
- [Import — DOCX to Document](https://app.notion.com/p/3acb6410e50281038192e08fc89b605a)
- [Export — Document to DOCX](https://app.notion.com/p/3acb6410e5028134aedfe63676d5418c)
- [Export — Document to PDF](https://app.notion.com/p/3acb6410e502817fbde1f33e76f61b82)
- [Import — PPTX to Slides](https://app.notion.com/p/3acb6410e5028108b8bdc90ce4eeec9c)
- [Export — Slides to PPTX](https://app.notion.com/p/3acb6410e5028156bee8c6cca9f2ab87)
- [Export — Slides to PDF](https://app.notion.com/p/3acb6410e50281419ce6ed5fd51edf09)
- [Import — XLSX to Spreadsheet](https://app.notion.com/p/3acb6410e5028182b958fcd202736a6c)
- [Export — Spreadsheet to XLSX](https://app.notion.com/p/3acb6410e50281bf9ebed3037d6cb114)
- [Export — Spreadsheet to PDF](https://app.notion.com/p/3acb6410e50281ffb153c8565943f650)
