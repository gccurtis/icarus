# Capability — Icarus Project Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502815ba44ddf057968c5c5).

## Summary / Concept
Project is build position **Project 1**. It follows the Research group and precedes Workspace. It owns the project profile, authored summary, ordered objectives, and project-level read composition used by Overview. The project identity is supplied when the application is initialized; endpoint payloads operate against that bound identity.
Questions belongs to the Collaboration group and owns Question, Hypothesis, Assumption, and Answer records. Project owns only the Overview-facing aggregation contract and consumes Question summaries through `ProjectQuestionReader` after Questions is composed.
### Prerequisites and build position
#### Required before implementation
- Platform Database transactions, SQLite migrations, Logger, IDs, clock, and serial/concurrent job runtime.
- Stable summary-reader contracts for Document, Slides, Spreadsheet, Analysis, Evidence, and Research.
- Shared ChangeSet attribution, idempotent command receipts, and typed conflict responses.
#### Integration sequence
1. Build the Project profile aggregate, operations, migrations, repository, and Base/ChangeSet replay.
2. Add the Resource Catalog Projection from capability-owned summary readers.
3. Add the Question-facing Overview contributor when Questions is composed.
4. Compose Workspace against the Project Overview seam.
### Concept and authority
Project answers two different questions without conflating their storage:
- **What is this project?** The canonical Project profile owns its name, summary, lifecycle, objectives, revision, and ChangeSets.
- **What does this project currently contain and know?** The Project Overview Projection assembles capability-owned summaries at read time.
Documents, Slides, Spreadsheets, Analyses, Evidence, Research Runs, Questions, and Collaboration records remain canonical in their own capabilities. Project stores no copied editor bodies, Evidence assertions, Research candidates, or Question aggregates.
The Resource Catalog Projection is a typed runtime projection over capability-owned list/read ports. Its stable contract permits a rebuildable cache later, but canonical resource identity and content remain with the owning capability.
### Repository placement
```plain text
apps/backend/src/3-capabilities/project/
  domain/
    model.ts
    target.ts
    operations.ts
    reducer.ts
    validation.ts
    footprints.ts
  application/
    service.ts
    overview.ts
  ports/
    repository.ts
    overviewReaders.ts
  persistence/
    migrations/
      001-project.ts
    sqliteProjectRepository.ts
  public.ts
  index.ts

apps/backend/src/4-job-wiring/project/
  registerProjectEndpointMappings.ts
  projectJobFactories.ts
```
The repository and migrations stay with Project. Initialization binds `projectId` from configuration, constructs the repository adapter with Platform Database, and injects capability-owned summary readers. Job factories never parse project scope from route or body fields.
## Types & Interfaces
### Canonical aggregate and submissions
```typescript
type ProjectLifecycle = "active" | "archived";

interface ProjectObjective {
  objectiveId: string;
  statement: string;
  status: "active" | "achieved" | "paused";
  ordinal: number;
}

interface ProjectProfile {
  projectId: string;
  revision: number;
  name: string;
  summaryMarkdown: string;
  lifecycle: ProjectLifecycle;
  objectives: readonly ProjectObjective[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectSubmission {
  submissionId: string;
  expectedRevision: number;
  operations: readonly ProjectOperation[];
}

interface ProjectChangeSet {
  changeSetId: string;
  projectId: string;
  fromRevision: number;
  toRevision: number;
  submissionId: string;
  requestHash: string;
  operations: readonly ProjectOperation[];
  inverseOperations: readonly ProjectOperation[];
  footprint: ProjectFootprint;
  compensationOfChangeSetId?: string;
  actorId?: string;
  committedAt: string;
}

interface ProjectFootprint {
  metadata: boolean;
  objectiveIds: readonly string[];
  objectiveOrder: boolean;
}
```
### Project target-address contract
Project owns the shared address vocabulary used by Activity, Presence, Comments, Workspace, Agents, and Automation. The address identifies canonical state; the capability named by `kind` still owns that state.
```typescript
type ProjectTargetKind =
  | "project"
  | "workspace"
  | "question"
  | "hypothesis"
  | "research"
  | "source"
  | "evidence"
  | "data_table"
  | "data_variable"
  | "analysis"
  | "document"
  | "slides"
  | "spreadsheet"
  | "media"
  | "agent_task"
  | "automation";

interface ProjectTargetRef {
  kind: ProjectTargetKind;
  resourceId: string;
  subpath?: Readonly<Record<string, string>>;
}

interface ProjectTargetSummary {
  target: ProjectTargetRef;
  label: string;
  revision?: number;
  lifecycle: "active" | "archived" | "removed";
  updatedAt?: string;
}

interface ProjectTargetAdapter {
  readonly kind: ProjectTargetKind;
  summarize(target: ProjectTargetRef): Promise<ProjectTargetSummary>;
}

interface ProjectTargetRegistry {
  summarize(target: ProjectTargetRef): Promise<ProjectTargetSummary>;
}
```
Each enabled capability registers one narrow adapter during initialization. Project validates the closed `kind` vocabulary and dispatches summary reads; it does not store copied target bodies or write another capability's tables.
### Overview and catalog contracts
```typescript
type NativeResourceKind = "document" | "slides" | "spreadsheet";

interface ProjectResourceSummary {
  kind: NativeResourceKind;
  resourceId: string;
  title: string;
  revision: number;
  lifecycle: "active" | "archived";
  updatedAt: string;
}

interface ProjectQuestionSummary {
  questionId: string;
  revision: number;
  text: string;
  status: "open" | "investigating" | "answered" | "archived";
  priority: number;
  currentAnswerId: string | null;
  updatedAt: string;
}

interface ProjectAnalysisSummary {
  analysisId: string;
  revision: number;
  name: string;
  lifecycle: "active" | "archived";
  updatedAt: string;
}

interface ProjectResearchSummary {
  runId: string;
  revision: number;
  mode: "question" | "hypothesis" | "discovery";
  status: string;
  updatedAt: string;
}

interface ProjectEvidenceSummary {
  evidenceId: string;
  revision: number;
  statement: string;
  reviewState: "proposed" | "admitted" | "rejected" | "deprecated";
  updatedAt: string;
}

interface ProjectOverviewProjection {
  project: ProjectProfile;
  resources: readonly ProjectResourceSummary[];
  questions: readonly ProjectQuestionSummary[];
  analyses: readonly ProjectAnalysisSummary[];
  researchRuns: readonly ProjectResearchSummary[];
  evidence: readonly ProjectEvidenceSummary[];
  generatedAt: string;
}

interface ProjectResourceReader {
  listResourceSummaries(
    cursor?: string,
  ): Promise<{
    items: readonly ProjectResourceSummary[];
    nextCursor?: string;
  }>;
}

interface ProjectQuestionReader {
  listQuestionSummaries(
    cursor?: string,
  ): Promise<{
    items: readonly ProjectQuestionSummary[];
    nextCursor?: string;
  }>;
}

interface ProjectAnalysisReader {
  listAnalysisSummaries(cursor?: string): Promise<{
    items: readonly ProjectAnalysisSummary[];
    nextCursor?: string;
  }>;
}

interface ProjectResearchReader {
  listResearchSummaries(cursor?: string): Promise<{
    items: readonly ProjectResearchSummary[];
    nextCursor?: string;
  }>;
}

interface ProjectEvidenceReader {
  listEvidenceSummaries(cursor?: string): Promise<{
    items: readonly ProjectEvidenceSummary[];
    nextCursor?: string;
  }>;
}

interface ProjectOverviewReaders {
  resources: readonly ProjectResourceReader[];
  questions?: ProjectQuestionReader;
  analyses: ProjectAnalysisReader;
  research: ProjectResearchReader;
  evidence: ProjectEvidenceReader;
}
```
### Repository and construction interfaces
```typescript
interface ProjectRepository {
  create(input: {
    name: string;
    summaryMarkdown: string;
    submissionId: string;
  }): Promise<ProjectProfile>;

  load(): Promise<ProjectProfile>;

  appendChangeSet(input: {
    expectedRevision: number;
    submissionId: string;
    operations: readonly ProjectOperation[];
  }): Promise<ProjectChangeSet>;

  listChangeSets(input: {
    cursor?: string;
    limit: number;
  }): Promise<{
    items: readonly ProjectChangeSet[];
    nextCursor?: string;
  }>;

  compensate(input: {
    direction: "undo" | "redo";
    expectedRevision: number;
    submissionId: string;
  }): Promise<ProjectChangeSet>;
}

interface CreateProjectDependencies {
  projectIdentity: { projectId: string };
  repository: ProjectRepository;
  overviewReaders: ProjectOverviewReaders;
  targets: ProjectTargetRegistry;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  changeSetAttribution: ChangeSetAttribution;
}
```
## Runtime Objects
### Project aggregate
The Project aggregate is the profile row plus its ordered objectives. One monotonic revision governs the entire aggregate. Every accepted submission produces a complete next state, exact inverse operations, a footprint, and one immutable ChangeSet.
Creation is represented by a `0 → 1` ChangeSet. Rename, summary, lifecycle, objective, undo, and redo operations all pass through the same reducer and compare-and-swap write protocol. Base compaction is unnecessary while the complete aggregate remains bounded; if objectives later become unbounded, the same Base-plus-tail contract used by larger authored resources can replace the normalized head without changing endpoint semantics.
### Resource Catalog Projection
`ProjectResourceCatalog` is a runtime object constructed from the Document, Slides, and Spreadsheet summary readers:
```typescript
interface ProjectResourceCatalog {
  list(input: {
    kinds?: readonly NativeResourceKind[];
    cursor?: string;
    limit: number;
  }): Promise<{
    items: readonly ProjectResourceSummary[];
    nextCursor?: string;
  }>;
}

function createProjectResourceCatalog(
  readers: readonly ProjectResourceReader[],
): ProjectResourceCatalog {
  return createMergedStableCatalog({
    readers,
    sort: ["updatedAt:desc", "kind:asc", "resourceId:asc"],
  });
}
```
The catalog merges stable summaries, applies a deterministic sort, and emits a bounded cursor. It never becomes a second source of resource truth.
### Project Overview Projection
`project.overview.get` loads the Project profile and fans out through the registered readers. The service returns one typed projection with each section independently bounded. The Question section is filled through `ProjectQuestionReader` when the Collaboration-group Questions capability is composed.
```typescript
const project = createProjectCapability({
  projectIdentity: config.project,
  repository: createSqliteProjectRepository({
    database,
    projectId: config.project.projectId,
  }),
  overviewReaders: {
    resources: [
      document.projectSummaryReader,
      slides.projectSummaryReader,
      spreadsheet.projectSummaryReader,
    ],
    analyses: analysis.projectSummaryReader,
    research: research.projectSummaryReader,
    evidence: evidence.projectSummaryReader,
    questions: questions?.projectSummaryReader,
  },
  logger,
  clock,
  ids,
  changeSetAttribution,
});
```
### Rebuildable read products
- Project Overview Projection.
- Resource Catalog Projection.
- Search text derived from Project name, summary, and objective statements.
- Optional cached section counts keyed by the owning capability's revision or cursor watermark.
Deleting rebuildable products preserves the Project profile, objectives, ChangeSets, receipts, and every capability-owned object.
## Change Operations
```typescript
type ProjectOperation =
  | { kind: "set_name"; name: string }
  | { kind: "set_summary"; summaryMarkdown: string }
  | { kind: "set_lifecycle"; lifecycle: ProjectLifecycle }
  | { kind: "add_objective"; objective: ProjectObjective }
  | {
      kind: "update_objective";
      objectiveId: string;
      patch: Partial<
        Pick<ProjectObjective, "statement" | "status">
      >;
    }
  | { kind: "remove_objective"; objectiveId: string }
  | {
      kind: "move_objective";
      objectiveId: string;
      beforeObjectiveId: string | null;
    };
```
<table fit-page-width="true" header-row="true">
<tr>
<td>Operation</td>
<td>Validation and effect</td>
</tr>
<tr>
<td>`set_name`</td>
<td>Requires a nonblank bounded name and updates project metadata.</td>
</tr>
<tr>
<td>`set_summary`</td>
<td>Replaces the bounded authored project summary.</td>
</tr>
<tr>
<td>`set_lifecycle`</td>
<td>Moves between active and archived while retaining history.</td>
</tr>
<tr>
<td>`add_objective`</td>
<td>Adds one stable objective identity at an explicit ordinal.</td>
</tr>
<tr>
<td>`update_objective`</td>
<td>Changes an objective statement or status.</td>
</tr>
<tr>
<td>`remove_objective`</td>
<td>Removes the objective from the current head; inverse operations retain restoration data.</td>
</tr>
<tr>
<td>`move_objective`</td>
<td>Changes order by stable IDs and rewrites only the affected ordinal range.</td>
</tr>
</table>
A stale submission may commute only when its footprint is disjoint from intervening ChangeSets. Different objective bodies may commute. Rename conflicts with another metadata edit; objective reordering conflicts with any stale operation whose positional assumption crosses the moved range.
## Endpoints
```typescript
interface InitializeProjectRequest {
  submissionId: string;
  name: string;
  summaryMarkdown?: string;
}

interface SubmitProjectRequest {
  submission: ProjectSubmission;
}

interface CompensateProjectRequest {
  submissionId: string;
  expectedRevision: number;
}
```
<table fit-page-width="true" header-row="true">
<tr>
<td>Method and path</td>
<td>Request type</td>
<td>Result</td>
</tr>
<tr>
<td>PUT /project</td>
<td>`project.initialize`</td>
<td>Project at revision 1 or the idempotent existing receipt.</td>
</tr>
<tr>
<td>GET /project</td>
<td>`project.get`</td>
<td>Canonical Project profile.</td>
</tr>
<tr>
<td>GET /project/overview</td>
<td>`project.overview.get`</td>
<td>Project Overview Projection.</td>
</tr>
<tr>
<td>GET /project/resources</td>
<td>`project.resources.list`</td>
<td>Bounded Resource Catalog Projection.</td>
</tr>
<tr>
<td>GET /project/history</td>
<td>`project.history.list`</td>
<td>Bounded ChangeSet summaries.</td>
</tr>
<tr>
<td>POST /project/submissions</td>
<td>`project.submit`</td>
<td>Accepted ChangeSet or typed conflict.</td>
</tr>
<tr>
<td>POST /project/undo</td>
<td>`project.undo`</td>
<td>Compensating ChangeSet.</td>
</tr>
<tr>
<td>POST /project/redo</td>
<td>`project.redo`</td>
<td>Compensating ChangeSet.</td>
</tr>
</table>
Endpoint requests carry command identity and expected revision where mutation safety requires them. The bound Project service supplies the configured project identity to the repository.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response</td>
<td>Calls or emitted operations</td>
</tr>
<tr>
<td>`project.initialize`</td>
<td>`InitializeProjectJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Creates revision 1 and emits the initial ChangeSet.</td>
</tr>
<tr>
<td>`project.get`</td>
<td>`GetProjectJob`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Reads the bound Project profile.</td>
</tr>
<tr>
<td>`project.overview.get`</td>
<td>`GetProjectOverviewJob`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Fans out through bounded summary readers and assembles the projection.</td>
</tr>
<tr>
<td>`project.resources.list`</td>
<td>`ListProjectResourcesJob`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Merges resource summaries under a stable cursor.</td>
</tr>
<tr>
<td>`project.history.list`</td>
<td>`ListProjectHistoryJob`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Reads immutable ChangeSet summaries.</td>
</tr>
<tr>
<td>`project.submit`</td>
<td>`SubmitProjectJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Reduces operations and commits the next head, ChangeSet, and receipt.</td>
</tr>
<tr>
<td>`project.undo` / `project.redo`</td>
<td>`CompensateProjectJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Appends an inverse or forward compensation ChangeSet.</td>
</tr>
</table>
```typescript
const projectJobFactories: EndpointJobFactoryMap = {
  "project.initialize": createSerialInlineJob(initializeProject),
  "project.get": createConcurrentInlineJob(getProject),
  "project.overview.get":
    createConcurrentInlineJob(getProjectOverview),
  "project.resources.list":
    createConcurrentInlineJob(listProjectResources),
  "project.history.list":
    createConcurrentInlineJob(listProjectHistory),
  "project.submit": createSerialInlineJob(submitProject),
  "project.undo": createSerialInlineJob(undoProject),
  "project.redo": createSerialInlineJob(redoProject),
};
```
## SQL Tables
The Project migration runs on a connection with `PRAGMA foreign_keys = ON`. The repository is constructed with the configured project identity. The schema can retain more than one Project profile while each constructed service is bound to exactly one of them.
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE project_profiles (
  project_id TEXT PRIMARY KEY
    CHECK (length(project_id) > 0),
  revision INTEGER NOT NULL
    CHECK (revision >= 1),
  name TEXT NOT NULL
    CHECK (length(trim(name)) BETWEEN 1 AND 200),
  summary_markdown TEXT NOT NULL DEFAULT ''
    CHECK (length(summary_markdown) <= 100000),
  lifecycle TEXT NOT NULL
    CHECK (lifecycle IN ('active', 'archived')),
  objectives_json TEXT NOT NULL DEFAULT '[]'
    CHECK (
      json_valid(objectives_json)
      AND json_type(objectives_json) = 'array'
    ),
  created_at TEXT NOT NULL
    CHECK (length(created_at) > 0),
  updated_at TEXT NOT NULL
    CHECK (length(updated_at) > 0)
);

CREATE TABLE project_change_sets (
  change_set_id TEXT PRIMARY KEY
    CHECK (length(change_set_id) > 0),
  project_id TEXT NOT NULL,
  from_revision INTEGER NOT NULL
    CHECK (from_revision >= 0),
  to_revision INTEGER NOT NULL
    CHECK (to_revision = from_revision + 1),
  submission_id TEXT NOT NULL
    CHECK (length(submission_id) > 0),
  request_kind TEXT NOT NULL
    CHECK (
      request_kind IN (
        'create',
        'revise',
        'archive',
        'restore',
        'undo',
        'redo'
      )
    ),
  request_hash TEXT NOT NULL
    CHECK (
      length(request_hash) = 64
      AND request_hash NOT GLOB '*[^0-9a-f]*'
    ),
  operations_json TEXT NOT NULL
    CHECK (
      json_valid(operations_json)
      AND json_type(operations_json) = 'array'
    ),
  inverse_operations_json TEXT NOT NULL
    CHECK (
      json_valid(inverse_operations_json)
      AND json_type(inverse_operations_json) = 'array'
    ),
  footprint_json TEXT NOT NULL
    CHECK (
      json_valid(footprint_json)
      AND json_type(footprint_json) = 'object'
    ),
  compensation_of_change_set_id TEXT,
  actor_id TEXT,
  committed_at TEXT NOT NULL
    CHECK (length(committed_at) > 0),
  UNIQUE (project_id, to_revision),
  UNIQUE (project_id, submission_id),
  UNIQUE (project_id, change_set_id),
  FOREIGN KEY (project_id)
    REFERENCES project_profiles(project_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (compensation_of_change_set_id)
    REFERENCES project_change_sets(change_set_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE project_command_receipts (
  project_id TEXT NOT NULL,
  submission_id TEXT NOT NULL
    CHECK (length(submission_id) > 0),
  request_kind TEXT NOT NULL
    CHECK (
      request_kind IN (
        'create',
        'revise',
        'archive',
        'restore',
        'undo',
        'redo'
      )
    ),
  request_hash TEXT NOT NULL
    CHECK (
      length(request_hash) = 64
      AND request_hash NOT GLOB '*[^0-9a-f]*'
    ),
  outcome TEXT NOT NULL
    CHECK (outcome IN ('accepted', 'rejected')),
  change_set_id TEXT,
  resulting_revision INTEGER,
  response_json TEXT,
  error_json TEXT,
  received_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (project_id, submission_id),
  UNIQUE (project_id, change_set_id),
  CHECK (
    (
      outcome = 'accepted'
      AND change_set_id IS NOT NULL
      AND resulting_revision IS NOT NULL
      AND response_json IS NOT NULL
      AND error_json IS NULL
    )
    OR
    (
      outcome = 'rejected'
      AND change_set_id IS NULL
      AND response_json IS NULL
      AND error_json IS NOT NULL
    )
  ),
  CHECK (response_json IS NULL OR json_valid(response_json)),
  CHECK (error_json IS NULL OR json_valid(error_json)),
  FOREIGN KEY (project_id)
    REFERENCES project_profiles(project_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (project_id, change_set_id)
    REFERENCES project_change_sets(project_id, change_set_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX project_profiles_updated
  ON project_profiles(updated_at DESC, project_id);

CREATE INDEX project_change_sets_revision
  ON project_change_sets(project_id, to_revision DESC);

CREATE INDEX project_change_sets_compensation
  ON project_change_sets(project_id, compensation_of_change_set_id)
  WHERE compensation_of_change_set_id IS NOT NULL;

CREATE INDEX project_receipts_outcome
  ON project_command_receipts(outcome, completed_at DESC);
```
### Atomic write protocol
A mutation starts `BEGIN IMMEDIATE`, loads the configured Project profile, verifies `expectedRevision`, checks the command receipt and request hash, reduces the complete aggregate, and writes the next head, immutable ChangeSet, and receipt before commit. The initial profile commits as a `0 → 1` ChangeSet. Undo and redo append compensation ChangeSets; prior history remains immutable.
### Relational guarantees
The schema contains **3 tables** and **4 explicit indexes**. Project, ChangeSet, and receipt identities are bound through foreign keys. Revision and submission uniqueness provide compare-and-swap and idempotency. The Resource Catalog and Project Overview remain rebuildable read products rather than canonical tables.
## Invariants & Acceptance
### Invariants
1. The initialized Project identity is the identity used by every Project repository call.
2. Endpoint payloads express the operation, expected revision, and command identity; initialization supplies scope.
3. One monotonic revision governs the Project profile and ordered objectives.
4. Every accepted mutation writes one immutable ChangeSet and one command receipt atomically.
5. Documents, Slides, Spreadsheets, Analyses, Research Runs, Evidence, and Questions retain their owning capability.
6. Project Overview contains stable summaries and references, never copied canonical bodies.
7. The Resource Catalog is deterministic, bounded, and rebuildable from capability-owned readers.
8. Questions remains Collaboration-owned; Project consumes only its typed summary projection.
9. Undo and redo append compensation and preserve accepted history.
### Acceptance criteria
- Initialization creates the configured Project profile at revision 1 and is idempotent by submission identity.
- Duplicate submissions return the stored receipt; changed payloads under the same identity conflict.
- Stale revisions return the current revision and conflicting footprint.
- Independent objective edits can commute; conflicting metadata or order edits fail deterministically.
- Overview reads return the canonical Project profile plus bounded capability-owned summaries.
- A Document, Slide deck, or Spreadsheet rename appears in the next Resource Catalog read without a Project mutation.
- Question summaries can be attached through the declared reader without moving Question tables into Project.
- Removing any rebuildable Overview cache preserves all canonical state.
## References
- [Product — Icarus Complete Product Definition](../product/definition.md)
- [Architecture — Icarus Ideal Backend Runtime, Capabilities & Data Map](../runtime/backend-map.md)
- [Architecture — Icarus Runtime Foundation & Repository Boundaries](../runtime/repository-boundaries.md)
- [Model — Icarus Request, Job & Dual-Queue Runtime](../runtime/dual-queue.md)
- [Capability — Icarus Questions, Hypotheses & Answers Runtime Model](questions.md)
