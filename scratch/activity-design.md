# Activity

## Intent

Activity is the project-level record of accepted work. Resources publish an
Activity transaction after they accept a change; Activity stores it, orders it,
and makes it available for a feed or history view.

Activity also owns current Presence. Presence is useful alongside Activity,
but it is not history: it is an expiring view of who is here right now.

The first implementation is deliberately small:

- accept and persist published Activity transactions;
- query that project history; and
- keep Presence leases.

Undo and redo should build on this later. Activity will coordinate them, but
it will not own a resource's revisions, ChangeSets, or inverse operations.

## Terms

- **Kind** is the shared word for the resource or producer type: `document`,
  `slides`, `connector`, `project`, and so on. Activity does not call this a
  “capability.”
- **Activity transaction** is one accepted action being published to Activity.
  It is not an HTTP request and is not created for failed work or an exact
  retry.
- **Transaction ID** is the one stable ID for that Activity transaction. The
  source creates it with its accepted mutation, stores it in its outbox, and
  Activity keeps the same ID in its ledger. That makes retrying publication
  simple; we do not need a separate “fact ID.”
- **Resource reference** is optional. Most transactions concern a resource,
  but project-level or runtime-level work can publish a transaction with only
  its kind and no resource ID.
- **Presence lease** is an expiring record for one trusted session. It is
  current state, not an Activity transaction.

## Transaction model

The central value is intentionally plain:

```ts
interface ActivityTransaction {
  /** Stable across source-outbox retries and the Activity ledger. */
  id: string;

  /** The producer/resource kind, for example "document" or "project". */
  kind: string;
  /** Omitted only for work that has no individual resource. */
  resourceId?: string;

  /** The action within that kind, for example "changed" or "created". */
  operation: string;
  revision?: number;
  changeSetId?: string;
  actorId?: string;
  origin: "interactive" | "agent" | "automation" | "system";
  occurredAt: string;

  /** Small, safe display data. Never a copied resource body or prompt. */
  metadata?: Readonly<Record<string, unknown>>;
}

interface StoredActivityTransaction extends ActivityTransaction {
  /** Monotonic order inside this project's Activity ledger. */
  sequence: number;
  publishedAt: string;
}

interface PresenceLease {
  sessionId: string;
  actorId?: string;
  kind?: string;
  resourceId?: string;
  state: Readonly<Record<string, unknown>>;
  updatedAt: string;
  expiresAt: string;
}
```

The pair `(kind, operation)` gives Activity its event label, such as
`document.changed`. `resourceId` lets a feed be narrowed to one Document or
Slide when there is one, without forcing every project-level action into a
fake resource.

Activity stores the immutable transaction plus its project sequence. The feed
representation is derived and can be rebuilt. The transaction itself is not
rewritten or deleted by normal resource history compaction.

## Publishing

Activity is created before resource integration so a small publisher can be
made available to each resource:

```ts
interface ActivityRuntime {
  /** Trusted internal call. It is not a browser endpoint. */
  publish(transaction: ActivityTransaction): Promise<StoredActivityTransaction>;
  query(input: ActivityQuery): Promise<ActivityQueryResult>;
  presence: ActivityPresenceRuntime;
}
```

Resources still write their own local outbox in the same transaction as their
canonical change. Activity may have a separate database, so this is the part
that keeps publication durable:

```text
resource transaction
  ├─ accepted resource change / ChangeSet / command receipt
  └─ Activity transaction in that resource's outbox

after commit
  └─ publisher calls Activity.publish(transaction)
       └─ marks the source row published
```

`publish` is idempotent by transaction ID. If the same transaction is delivered
again, Activity returns the stored transaction. If the same ID is delivered
with different content, Activity rejects it. Activity's `sequence` is the
order in which it received published transactions; it is not a claim that
different resource databases committed in that order.

The source publisher belongs in initialization/job wiring. A post-commit nudge
can publish quickly, while a recovery job finds any still-unpublished rows
after a crash or restart.

### Document and Slide prerequisite

Document and Slide already have local outbox tables. Before connecting their
publishers, make each outbox row independently usable:

- retain the source command request ID;
- retain the source ChangeSet ID as a copied value that compaction cannot
  clear; and
- later, for undo/redo transactions, retain the compensation operation and
  target ChangeSet in that same row.

Today the live ChangeSet link can be cleared by compaction. A publisher must
publish from the outbox record it has, rather than loading a potentially pruned
ChangeSet afterwards.

## Presence

Presence is a project-scoped TTL lease:

```text
heartbeat → upsert the session lease with a new expiry
leave     → remove the session lease
expiry    → treat the lease as absent and clean it up in the background
```

The transport layer supplies the authenticated actor and session. Public input
does not choose either one. Start with realtime sessions; support HTTP
heartbeats only when transport can provide a stable server-owned session.

Presence state must stay bounded: display identity, a resource reference, and
later a target-specific cursor or selection. It must not become a generic data
channel or contain resource content. Heartbeats, leave, and expiry do not
publish Activity transactions.

## Endpoints

The public surface can start with two endpoints:

- `POST /activity/query` — project feed, a transaction by ID, history for a
  kind/resource pair, and current Presence.
- `POST /activity/command` — `presence.heartbeat` and `presence.leave`.

There is intentionally no public endpoint for appending arbitrary Activity
transactions. Only trusted resource publishers call `Activity.publish`.

## Undo and redo later

When we add undo/redo, Activity should provide the public commands while the
resource still performs the actual inverse change:

```text
Activity undo request
  → choose an earlier Activity transaction
  → ask that transaction's kind/resource to compensate its ChangeSet
  → resource accepts a new change and publishes a new Activity transaction
```

Redo compensates the direct undo transaction, not the original transaction:
`T0 → U1 → R2`. This keeps history immutable and avoids inventing a global
undo stack. At that point, resource compensation should be a trusted Activity
integration path, rather than a separate public way to create a redo.

This is intentionally a future design step. It does not need Activity tables,
endpoints, or jobs in the first implementation beyond recording the normal
transactions needed to support it.

## Implementation plan

1. **Create the core Activity runtime.** Add the project-bound Activity store,
   `ActivityTransaction`/Presence models, `publish`, and basic queries. Store
   immutable transactions by ID with a project sequence, plus TTL Presence
   leases.

2. **Wire publishing, not resource-domain dependencies.** Construct Activity
   first in startup. Give resource integration a small publisher/notifier, but
   keep the resource reducer and its SQLite transaction independent of the
   Activity store.

3. **Migrate and connect Document first.** Extend the Document outbox record
   so it is self-contained, add an unpublished-row publisher and recovery job,
   then verify normal Document create/change transactions appear once in
   Activity across retries and restart.

4. **Connect Slides using the same adapter shape.** Apply the same outbox and
   publisher pattern without changing the Activity core.

5. **Expose query and Presence.** Add the two public endpoints, bounded
   Presence validation, trusted transport context, expiry cleanup, and simple
   feed results.

6. **Add Activity-mediated undo/redo separately.** Only after the source
   transaction/publisher path is stable, add the coordinator and trusted
   resource compensation adapters.

The key tests are simple: publish once, publish the same transaction twice,
reject a changed transaction under the same ID, recover an unpublished source
row after restart, filter by kind/resource, and expire Presence correctly.
