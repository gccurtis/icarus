# Capability — Icarus Presence Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e50281949261c0c8ef45fe05).

## Summary / Concept
Presence is the second capability in the **Collaboration** build group. It owns ephemeral leases describing which connections are active and which typed target each connection is viewing. Presence is descriptive state: it does not create ChangeSets, revisions, or durable Activity facts.
### Prerequisites
- Project target-address contract.
- Realtime connection ownership in `2-transport`.
- IDs, clock, logger, concurrent Jobs, and an injected TTL registry.
### Ownership
`2-transport` owns WebSocket or SSE connections. Presence owns typed heartbeat, view, leave, expiry, and list semantics. Target capabilities remain authoritative for every referenced resource.
### Runtime placement
```plain text
apps/backend/src/
  3-capabilities/
    presence/
      domain/
      application/
      ports/
      projections/
      index.ts
  4-job-wiring/
    presence/
      registerPresenceEndpointMappings.ts
      createPresenceJobs.ts
```
## Types & Interfaces
```typescript
import type { ProjectTargetRef } from "../project/public";

export interface PresenceDisplay {
  name: string;
  color: string;
}

export interface PresenceLease {
  connectionId: string;
  actorId: string;
  target?: ProjectTargetRef;
  display: PresenceDisplay;
  expiresAt: string;
}

export type PresenceMessage =
  | { type: "presence.heartbeat"; target?: ProjectTargetRef; display: PresenceDisplay }
  | { type: "presence.leave" }
  | { type: "presence.changed"; target?: ProjectTargetRef; leases: PresenceLease[] };

export interface PresenceRegistry {
  upsert(lease: PresenceLease): Promise<void>;
  delete(connectionId: string): Promise<void>;
  list(target?: ProjectTargetRef): Promise<PresenceLease[]>;
  expire(now: string): Promise<number>;
}
```
An in-memory registry serves one process. A shared TTL implementation may be injected through the same contract when the runtime spans processes.
## Runtime Objects
```typescript
export interface PresenceRuntime {
  heartbeat(command: PresenceHeartbeat): Promise<PresenceLease>;
  leave(connectionId: string): Promise<void>;
  list(target?: ProjectTargetRef): Promise<PresenceLease[]>;
  expire(): Promise<number>;
}

export function createPresenceRuntime(deps: {
  registry: PresenceRegistry;
  clock: Clock;
  leaseDurationMs: number;
  publisher: PresencePublisher;
  logger: Logger;
}): PresenceRuntime {
  return new PresenceService(deps);
}
```
`PresenceService` computes expiry from the injected clock, refreshes a lease, and publishes a typed change message. It accepts authenticated connection and actor identities from transport; clients do not choose them.
## Change Operations
```typescript
export type PresenceChangeOperation =
  | { type: "heartbeat"; connectionId: string; target?: ProjectTargetRef; display: PresenceDisplay }
  | { type: "leave"; connectionId: string }
  | { type: "expire"; connectionIds: string[] };
```
- `heartbeat` creates or refreshes one lease.
- `leave` removes the connection immediately.
- `expire` removes leases whose TTL elapsed.
- None of these operations mutates the referenced target.
## Endpoints
- `POST /presence/heartbeat` — refresh the caller’s lease.
- `DELETE /presence` — leave explicitly.
- `GET /presence` — list active leases.
- `GET /presence/targets/:targetKind/:targetId` — list active leases on one target.
- Realtime transport accepts the equivalent `presence.heartbeat` and `presence.leave` messages and publishes `presence.changed`.
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
<td>Heartbeat</td>
<td>\<code\>HeartbeatPresenceJob\</code\></td>
<td>Concurrent</td>
<td>Inline or realtime</td>
<td>Applies \<code\>heartbeat\</code\>; publishes \<code\>presence.changed\</code\></td>
</tr>
<tr>
<td>Leave</td>
<td>\<code\>LeavePresenceJob\</code\></td>
<td>Concurrent</td>
<td>Inline or realtime</td>
<td>Applies \<code\>leave\</code\>; publishes \<code\>presence.changed\</code\></td>
</tr>
<tr>
<td>List</td>
<td>\<code\>ListPresenceJob\</code\></td>
<td>Concurrent</td>
<td>Inline</td>
<td>Calls \<code\>PresenceRegistry.list\</code\></td>
</tr>
<tr>
<td>TTL sweep</td>
<td>\<code\>ExpirePresenceLeasesJob\</code\></td>
<td>Concurrent</td>
<td>Internal result</td>
<td>Applies \<code\>expire\</code\>; publishes changed targets</td>
</tr>
</table>
Presence work uses the concurrent path. Registry operations must be atomic per connection even though they do not enter the serial canonical-mutation queue.
## SQL Tables
Presence owns no SQLite tables. Its canonical runtime state is the injected TTL registry:
```typescript
interface PresenceRegistryRecord {
  key: `presence:${string}`; // connection identity
  value: PresenceLease;
  expiresAt: string;
}
```
A restart or lease expiry clears Presence naturally. Activity and Comments do not rebuild Presence.
## Invariants & Acceptance
- One connection has at most one active lease.
- Every lease expires without a heartbeat.
- Connection and actor identity come from transport composition.
- Listing never returns an expired lease.
- Presence loss cannot alter target content, Comments, or Activity.
