# Capability — Icarus Activity Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502814f83f8c6c74fa4c63b).

## Summary / Concept
Activity is the first capability in the **Collaboration** build group. It owns a durable stream of minimal committed facts and a rebuildable presentation feed. It never owns the content or revision history of the target that changed.
### Prerequisites
- Project target-address and safe-summary contracts.
- Public committed-change or history readers from each enabled target capability.
- Database, IDs, clock, digest, logger, and the dual-queue runtime.
- Actor attribution supplied by initialization.
### Ownership
Activity owns fact admission, idempotency, feed rendering, and Activity query projections. Target capabilities own their resources, revisions, ChangeSets, and validation. Observability owns operational logs.
### Runtime placement
```plain text
apps/backend/src/
  3-capabilities/
    activity/
      domain/
      application/
      ports/
      persistence/
      projections/
      index.ts
  4-job-wiring/
    activity/
      registerActivityEndpointMappings.ts
      createActivityJobs.ts
```
## Types & Interfaces
```typescript
import type { ProjectTargetRef } from "../project/public";

export interface CommittedActivityFact {
  factId: string;
  actor: {
    kind: "operator" | "agent" | "automation" | "system";
    id: string;
  };
  target: ProjectTargetRef;
  action: string;
  targetRevision?: number;
  safeMetadata: Record<string, unknown>;
  occurredAt: string;
}

export interface ActivityItem {
  factId: string;
  target: ProjectTargetRef;
  targetLabel: string;
  renderedSummary: string;
  actor: CommittedActivityFact["actor"];
  action: string;
  occurredAt: string;
}

export interface ActivityFactRecorder {
  record(fact: CommittedActivityFact): Promise<ActivityItem>;
}

export interface ActivityReader {
  list(input: {
    cursor?: string;
    limit: number;
    target?: ProjectTargetRef;
    actor?: CommittedActivityFact["actor"];
  }): Promise<{ items: ActivityItem[]; nextCursor?: string }>;
}

export interface ActivityProjectionRebuilder {
  rebuild(input: { afterFactId?: string; limit: number }): Promise<{
    processed: number;
    nextFactId?: string;
  }>;
}
```
The fact is deliberately bounded and safe to render. It points at canonical state instead of copying domain payloads.
## Runtime Objects
```typescript
export interface ActivityRuntime {
  recorder: ActivityFactRecorder;
  reader: ActivityReader;
  rebuilder: ActivityProjectionRebuilder;
}

export function createActivityRuntime(deps: {
  repository: ActivityRepository;
  targetSummaryReader: TargetSummaryReader;
  clock: Clock;
  logger: Logger;
}): ActivityRuntime {
  const recorder = new ActivityService(deps);
  const reader = new ActivityQueryService(deps.repository);
  const rebuilder = new ActivityFeedRebuilder(deps);
  return { recorder, reader, rebuilder };
}
```
- `ActivityService` validates and records each committed fact idempotently.
- `ActivityQueryService` reads cursor-stable feed rows.
- `ActivityFeedRebuilder` resolves safe target summaries and regenerates presentation rows from canonical facts.
- Job wiring constructs a fresh Job for every external query, internal fact admission, or rebuild batch.
## Change Operations
Activity facts are append-only. Presentation rows are derived and may be replaced during a rebuild.
```typescript
export type ActivityChangeOperation =
  | { type: "record_fact"; fact: CommittedActivityFact }
  | { type: "rebuild_item"; factId: string }
  | { type: "delete_stale_projection"; factId: string };
```
- `record_fact` inserts one canonical fact. Replaying the same `factId` and digest returns the existing result; a different digest is `idempotency_mismatch`.
- `rebuild_item` recomputes the label and summary from the canonical fact plus the current safe-summary adapter.
- `delete_stale_projection` removes presentation state only. It never deletes the fact.
## Endpoints
- `GET /activity?cursor=&limit=` — list the project Activity feed.
- `GET /activity/targets/:targetKind/:targetId` — list Activity for one typed target.
- `GET /activity/actors/:actorKind/:actorId` — list Activity attributed to one actor.
- `POST /internal/activity/facts` — internal typed admission surface used by job wiring after another capability commits.
- `POST /internal/activity/rebuild` — internal bounded rebuild request.
External HTTP handlers only create `RequestEnvelope` values. Exact path matching and Job construction live in `4-job-wiring/activity`.
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
<td>List feed or target Activity</td>
<td>\<code\>ListActivityJob\</code\></td>
<td>Concurrent</td>
<td>Inline</td>
<td>Calls \<code\>ActivityReader\</code\></td>
</tr>
<tr>
<td>\<code\>activity.fact.record\</code\></td>
<td>\<code\>RecordActivityFactJob\</code\></td>
<td>Serial</td>
<td>Internal inline</td>
<td>Emits \<code\>record_fact\</code\></td>
</tr>
<tr>
<td>\<code\>activity.projection.rebuild\</code\></td>
<td>\<code\>RebuildActivityBatchJob\</code\></td>
<td>Concurrent</td>
<td>Internal stage result</td>
<td>Computes feed rows and emits a serial settlement intent</td>
</tr>
<tr>
<td>\<code\>activity.projection.settle\</code\></td>
<td>\<code\>SettleActivityBatchJob\</code\></td>
<td>Serial</td>
<td>Internal inline</td>
<td>Applies \<code\>rebuild_item\</code\> and \<code\>delete_stale_projection\</code\></td>
</tr>
</table>
A target capability commits its own mutation first. Job wiring then admits its `CommittedActivityFact`. Activity cannot make the target mutation succeed or fail retroactively.
## SQL Tables
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE activity_facts (
  fact_id TEXT PRIMARY KEY,
  fact_digest TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('operator', 'agent', 'automation', 'system')),
  actor_id TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_subpath_json TEXT CHECK (target_subpath_json IS NULL OR json_valid(target_subpath_json)),
  action TEXT NOT NULL,
  target_revision INTEGER CHECK (target_revision IS NULL OR target_revision >= 1),
  safe_metadata_json TEXT NOT NULL CHECK (json_valid(safe_metadata_json)),
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL
) STRICT;

CREATE TABLE activity_items (
  fact_id TEXT PRIMARY KEY REFERENCES activity_facts(fact_id) ON DELETE CASCADE,
  target_label TEXT NOT NULL,
  rendered_summary TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  rebuilt_at TEXT NOT NULL
) STRICT;

CREATE INDEX activity_facts_time
  ON activity_facts (occurred_at DESC, fact_id);
CREATE INDEX activity_facts_target_time
  ON activity_facts (target_kind, target_id, occurred_at DESC, fact_id);
CREATE INDEX activity_facts_actor_time
  ON activity_facts (actor_kind, actor_id, occurred_at DESC, fact_id);
CREATE INDEX activity_items_time
  ON activity_items (occurred_at DESC, fact_id);
```
`activity_facts` is canonical. `activity_items` is a rebuildable projection and is distinct from the SQL indexes that accelerate queries.
## Invariants & Acceptance
- One `factId` identifies one digest and one committed fact.
- Facts contain safe metadata and typed references, not copied target content.
- Feed rows rebuild from facts plus safe target summaries.
- Removing the projection cannot remove canonical Activity history.
- Concurrent rebuild work settles through a separate serial Job.
