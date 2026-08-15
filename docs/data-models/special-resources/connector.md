# Connector

A configured link to an external system — Drive, Notion, a warehouse, a mailbox.
The connector holds the configuration and the sync state; what it pulls in
becomes [external files](external-file.md).

```ts
interface Connector {
  projectId: Id<"projects">;
  provider: string;            // "google_drive", "notion", "slack", "postgres"
  displayName: string;         // "Marketing Drive"
  status: ConnectorStatus;
  scope: ConnectorScope[];
  credentialRef: string;       // pointer into the secret store, never the secret
  sync?: ConnectorSync;
  createdBy: Actor;
  updatedAt: number;
}

type ConnectorStatus =
  | "connected"
  | "needs_auth"
  | "syncing"
  | "error"
  | "disconnected";

interface ConnectorScope {
  path: string;                // a folder id, database id, channel, schema
  label: string;               // what to show a person
  recursive?: boolean;
}

interface ConnectorSync {
  cursor?: string;             // provider's delta token or page marker
  lastSyncedAt?: number;
  lastError?: string;
  fileCount?: number;
}
```

## Credentials are referenced, never stored

`credentialRef` is a pointer into a secret store. No access token, refresh
token, password, or connection string appears in this document.

The reason is that a project document is read constantly, by many code paths,
and cached in many places. A secret in it is a secret in every log line, every
error report, and every client cache that ever touched the record. The
indirection costs one lookup at sync time and removes the entire class of leak.

## Provider is a string

Not a union. New providers are added constantly and each addition would
otherwise be a schema change that has to be deployed before anyone can connect
anything. The set of valid values lives with the sync implementations, which is
also the only place that can act on them.

## Scope is explicit

A connector syncs what it is told to sync — named folders, databases, channels —
not everything the credential can reach. An OAuth grant to a Drive account is
typically broad, and `scope` is what turns that into a specific, visible,
auditable set of content in a specific project.

It is a list rather than a single path because one credential legitimately
covers several places, and connecting the same account three times to reach
three folders would triple the tokens to rotate and revoke.

## Status and sync are separate

`status` is the connector's health — can it reach the provider at all. `sync` is
the progress of the last run. They are separate because they change on different
schedules and answer different questions: a connector can be `connected` with a
stale `lastSyncedAt`, or `needs_auth` while still holding perfectly good
previously synced files.

`cursor` is opaque. Providers express incremental sync differently — page
tokens, change ids, timestamps, log sequence numbers — and normalizing them
would mean modelling every provider's delta semantics in a field that only that
provider's code reads.

## Deleting a connector

Removing a connector does not remove the files it brought in. Those are project
content that people have referenced in documents and findings, and severing a
credential should not silently empty a project. The files keep their
`origin.connectorId`, which becomes a dangling reference — that is intentional,
and it is what tells the UI to show them as no longer syncing.

## Related

[external file](external-file.md) · [activity](../collaboration/activity.md)
