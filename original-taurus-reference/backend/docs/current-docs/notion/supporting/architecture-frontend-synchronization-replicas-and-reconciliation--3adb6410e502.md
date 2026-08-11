---
title: "Architecture — Frontend Synchronization, Replicas & Reconciliation"
notion_page_id: "3adb6410e502815497b0e1c1c60ef284"
notion_url: "https://app.notion.com/3adb6410e502815497b0e1c1c60ef284"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Frontend Synchronization, Replicas & Reconciliation

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Every mutable backend aggregate is represented by an explicit replica controller: confirmed server state plus an ordered optimistic overlay. Components never pretend a pending projection is confirmed, and retries never become duplicate operations.
## Authority and goals
Omega owns canonical resources, Workspace state, Project metadata, permissions, jobs, and revisions. Alpha optimizes perceived latency and continuity. Synchronization must therefore provide:
- a stable last-confirmed projection;
- immediate local prediction where safe;
- ordered, idempotent submission;
- typed acceptance/refusal/conflict handling;
- cancellation and generation fencing;
- reconnect and cache recovery;
- observable status for components and assistive technology.
Optimism is a presentation technique. It never bypasses authorization, entitlement, validation, or revision checks.
## Replica shape
```typescript
type ReplicaHealth =
  | "initial"
  | "ready"
  | "submitting"
  | "offline"
  | "retrying"
  | "conflicted"
  | "refused"
  | "unsupported";

interface PendingOperation<Op> {
  submissionId: string;
  operation: Op;
  expectedRevision: number;
  enqueuedAt: string;
  attempts: number;
}

interface ReplicaState<T, Op> {
  confirmed: T | null;
  confirmedRevision: number | null;
  optimistic: T | null;
  pending: readonly PendingOperation<Op>[];
  inFlightSubmissionId: string | null;
  health: ReplicaHealth;
  error: FrontendFault | null;
  generation: number;
}

interface ReplicaController<T, Op> {
  readonly state: Readable<ReplicaState<T, Op>>;
  load(signal?: AbortSignal): Promise<void>;
  submit(operation: Op): Promise<SubmissionResult>;
  ingestProjection(projection: AggregateProjection<T>): void;
  noticeChange(change: ProjectChangeDescriptor): void;
  retry(): Promise<void>;
  resetForGeneration(generation: number): void;
}
```
`optimistic` is derived by applying pending operations in order to `confirmed`. It is not an independently mutated store.
## Operation and transport identity
Every accepted command carries one durable idempotency identity. Transport attempts carry a separate tracing identity:
```typescript
interface OperationEnvelope<Op> {
  projectId?: string;
  aggregate: {
    kind: string;
    id: string;
  };
  expectedRevision: number;
  submissionId: string; // retained unchanged across every retry
  operation: Op;
}

interface TransportAttempt {
  requestId: string; // new per HTTP/SSE attempt; correlation only
}
```
Project operations always include `projectId`. Control-plane operations use the appropriate user or organization scope. `submissionId`, or the endpoint’s explicitly named equivalent, is the sole acceptance/idempotency key. `requestId` never authorizes replay and never competes with `submissionId`. If a legacy Alpha client calls its durable field `clientRequestId`, its mapper must translate that one value to Omega `SubmissionID` rather than send two durable keys. Stable IDs are preferred to positions. A command that targets “tab 3,” “paragraph 7,” or “selected item” resolves that ephemeral phrase into durable identifiers before transport.
## Submission algorithm
1. Validate the local command and capture its current aggregate revision.
2. Generate one `SubmissionID`; retain it for all retries.
3. Append the operation to the aggregate’s serial pending queue.
4. Recompute the optimistic projection with a pure reducer.
5. Submit only the queue head.
6. On acceptance, replace or advance confirmed state using the authoritative response.
7. Remove the acknowledged operation, rebase the remaining queue, and submit the next item.
8. On retriable transport failure, retain the queue and surface retry/offline status.
9. On revision conflict, fetch or accept the returned current state, then use the aggregate-specific rebase policy.
10. On authorization, validation, entitlement, or unsupported refusal, remove or quarantine the operation according to policy and explain the refusal without presenting it as accepted.
Structural Workspace commands and resource mutations are serialized per aggregate. Independent aggregates may submit concurrently.
## Reconciliation outcomes
<table header-row="true">
<tr>
<td>Outcome</td>
<td>Runtime action</td>
<td>User presentation</td>
</tr>
<tr>
<td>accepted</td>
<td>advance confirmed revision; remove acknowledged op; rebase remainder</td>
<td>quiet success; announce only when needed</td>
</tr>
<tr>
<td>accepted with normalized state</td>
<td>replace predicted values with canonical values</td>
<td>animate minimally; preserve focus</td>
</tr>
<tr>
<td>transport timeout/5xx</td>
<td>retain same SubmissionID; retry policy</td>
<td>offline/retrying indicator; manual retry if exhausted</td>
</tr>
<tr>
<td>revision mismatch</td>
<td>load current; rebase if defined</td>
<td>transient resolving state; explicit conflict when not safely rebasable</td>
</tr>
<tr>
<td>unauthorized/forbidden</td>
<td>discard prediction; refresh admission-sensitive projections</td>
<td>clear refusal; no “saved” state</td>
</tr>
<tr>
<td>validation failure</td>
<td>revert invalid prediction; preserve editable draft when safe</td>
<td>inline field/problem detail</td>
</tr>
<tr>
<td>entitlement failure</td>
<td>revert; retain explanatory context</td>
<td>upgrade/access message routed from control-plane contract</td>
</tr>
<tr>
<td>resource deleted</td>
<td>remove stale runtime/tab through explicit recovery flow</td>
<td>“resource no longer exists”; offer safe navigation</td>
</tr>
<tr>
<td>schema/version unsupported</td>
<td>stop writes</td>
<td>upgrade/reload boundary</td>
</tr>
</table>
## Rebase policy is capability-specific
There is no generic merge that is correct for every resource.
- **Workspace:** reapply stable-ID commands against the new head; commands such as activate, move, close, and set-view-state define no-op and missing-target behavior.
- **Document:** use typed document operations/change sets and the Document conflict policy; do not diff arbitrary HTML at the application layer.
- **Spreadsheet:** the Resource is one sparse grid, not a workbook of sheets. Cell/range/formula operations resolve stable RowID, ColumnID, CellID, and RangeRef identities plus dependency rules; A1 notation is a revision-bound projection.
- **Slides:** slide/object operations resolve stable slide/object IDs.
- **Chat:** revisioned turn-tree operations preserve branch and turn identities.
- **Settings/grants:** generally require refetch and explicit user review rather than speculative merging.
- **AI jobs/tasks:** state transitions are server-authored; frontend commands request transitions and consume job events.
## Loading and request freshness
Each scope owns a monotonically increasing generation. Route changes, Project changes, resource disposal, and query changes abort outstanding work or make its completion ineligible.
```typescript
async function guardedLoad<T>(
  generation: number,
  currentGeneration: () => number,
  request: (signal: AbortSignal) => Promise<T>,
  apply: (value: T) => void
) {
  const controller = new AbortController();
  const value = await request(controller.signal);
  if (generation !== currentGeneration()) return;
  apply(value);
}
```
Real implementations retain and abort the controller during disposal. Generation checks remain even when abort is available because a response can race with cancellation.
Search/filter queries use request-key identity and “latest eligible response wins.” Aggregate mutations use serial queues; they must not use latest-response-wins.
## Change descriptors, projections, and streaming
Transport choice does not change reducer semantics, but the payload classes remain distinct.
- A successful mutation response or aggregate read may immediately advance the confirmed projection.
- Ω-014 publishes a durable, minimal `ProjectChangeDescriptor` plus cursor. It is an invalidation and discovery record, not a generic full aggregate projection.
- On a relevant descriptor, the owning replica uses the named aggregate/resource and revision to fetch an endpoint-specific projection or delta. Duplicate descriptors are harmless; a cursor or revision gap triggers a bounded reload rather than guessed state.
- Polling, foreground refresh, reconnect, and durable change delivery converge through the same descriptor-to-refresh policy.
- Chat/model stream chunks and presence events are transient presentation inputs. They may update explicitly partial state, but they do not become confirmed canonical state until Omega publishes the durable turn, task, or aggregate commit.
- Losing a subscription moves health to stale/offline and starts bounded reconnect/polling. Wakeups are hints; the durable cursor closes missed-notification gaps.
## Cache and offline posture
Local cache is an acceleration layer, not authority.
Cache records include scope identity, schema version, server revision, stored time, and subject identity. Sensitive data is cleared at sign-out. A cache may seed a visibly stale projection while revalidation runs. It may not silently authorize a Project, assert current grants, or overwrite a newer confirmed state.
V1 does not promise unrestricted offline editing. Operations may be retained in memory during a transient outage. A durable offline outbox is a separate product/security decision and must define encryption, subject separation, storage limits, conflict UX, and sign-out behavior before implementation.
## Multiple clients
Two frontend clients can address the same Project and resource. They do not share frontend memory. Omega accepts canonical operations through each User's Project Subcell, while the aggregate store serializes conflicting writes through revision/CAS. Each client reconciles canonical revisions and the durable Project change cursor while preserving only its own pending overlay. Presence, caret, and live selection are separate ephemeral collaboration channels and never enter the durable Workspace aggregate.
## Observability
Every submission exposes:
- scope and aggregate identity;
- the per-attempt RequestID and durable SubmissionID as separately labelled fields;
- expected and resulting revision;
- queue wait and request duration;
- retry count and refusal category;
- conflict/rebase result;
- current generation;
- no resource content in logs unless explicitly safe.
## Verification matrix
Required tests include pure optimistic reducers, queue serialization, duplicate-response deduplication, timeout retry with identical SubmissionID, conflict/rebase, stale-response fencing, project switch, resource deletion, offline/reconnect, multi-client revision races, cache schema mismatch, and sign-out cache clearing.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d2813fe9f261c35ac4"/>
- [Current Alpha Document synchronization design](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/docs/architecture/document-editor.md)

