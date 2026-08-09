# Comments flows

## Accepted state-changing command

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Comments route
  participant S as Comments service/store
  participant A as Activity
  C->>R: POST /comments/command
  R->>R: strict decode; serial job
  R->>S: command(normalized input)
  S->>S: check receipt and current state
  S->>S: atomic Comment + receipt + outbox commit
  S->>A: publish(stable source transaction)
  alt Activity accepts
    S->>S: mark outbox published
  else Activity unavailable
    Note over S: accepted Comment remains; row stays pending
  end
  S-->>R: typed command result
  R-->>C: 201 or 200
```

Create generates and returns one Comment ID; callers cannot supply it. Each
state-changing command also creates a source publication key from which
Activity allocates and returns its separate ledger ID. An
update parses mentions from its new normalized body.

## Replay and matching-state no-op

An existing request ID is checked before current Comment lookup. Equal digest
returns the original stored result, including after deletion, without another
write or publish. A changed digest returns 409.

Resolve on resolved or reopen on open is different: it is a new accepted
request whose desired state already holds. Comments stores that request's
receipt, returns the current Comment, and creates no Activity row or timestamp
change.

## Query and pagination

```text
comment.get
  -> validate ID -> select non-deleted row -> Comment or 404

comment.listByTarget
  -> validate exact kind/ID and optional state
  -> decode filter-bound cursor
  -> select non-deleted rows after (createdAt, id)
  -> limit + 1 -> page and optional next cursor
```

The query does not load or validate the target resource. It returns the opaque
sub-target exactly as stored for the owner/UI to interpret.

## Startup recovery

Startup constructs Activity before Comments, creates the narrow publisher
adapter, registers both Comments endpoints, and calls
`comments.publishPendingActivity()` before the HTTP transport is registered.
If Activity had already accepted a transaction before a crash, its stable-ID
replay succeeds and Comments can mark the outbox row published.

The mapped Activity transaction uses `kind: "comment"`, the Comment ID as
`resourceId`, and safe metadata containing only target kind/ID, resulting
state, and mention count.
