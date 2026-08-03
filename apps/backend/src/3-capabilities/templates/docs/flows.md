# Templates flows

Every command runs the same preamble:

```text
1. decode `{ requestId, origin, command }` strictly at the wire boundary
2. digest = canonicalDigest(command)          # sorted keys, undefined dropped
3. receipt = store.getReceipt(requestId)
     digest or command type differs -> idempotency_mismatch
     present                        -> replay the stored result
     absent                         -> continue
4. command-specific work
5. store.recordReceipt(...)                   # no-op if step 4 already wrote it
```

**Nothing is written before the work runs.** A failed command leaves no trace to
reconcile, so a retry is simply the command again rather than the resumption of a
half-finished one. What makes that safe is that every call into a resource is
keyed by the request: the resource replays its own completed attempt, so
"start over" arrives at the same place without doing the work twice.

One key per command, shared by all of its calls — they are steps in one
procedure, not independent operations, so they replay together or not at all.

## Registration

```text
template.register(kind, resourceId, name, description?, contextBindings?)
  1. resources.get(kind)                      -> unsupported_kind, before any effect
  2. nameTaken(kind, name)                    -> name_conflict, before any effect
  3. resource.duplicate({ sourceResourceId, idempotencyKey })
                                              -> the ID the resource allocated
  4. resource.markAsTemplate({ resourceId })  # the copy goes private
  5. resource.applyBindings({ ... })          # skipped when nothing is declared
  6. allocate templateId
     store.create: catalog row + receipt + template.registered transaction,
                   all in one SQLite transaction
```

**Templates owns the procedure.** The resource neither knows nor decides that it
is becoming a template: `duplicate` is a pure copy a capability could offer for
its own reasons, and sealing is a separate instruction. That is also why bindings
are applied in step 5 rather than during the copy — registration and
instantiation then differ by exactly one call.

**Both refusals precede any effect**, which is why the name is checked in step 2
rather than left to the unique index. The index cannot report until the row is
written, and the row is now written last.

**Step 6's three writes are one transaction.** If the catalog row committed and
the receipt did not, the retry would re-run steps 3–5 (replayed by the resource)
and then fail step 2 against the row it wrote itself a moment earlier — a name
conflict reported to the caller for the store's own half-finished write.

**The cost of writing last.** A crash between steps 3 and 6 that is never retried
leaves a sealed backing copy no catalog row points at. It is unreachable: the
owning capability refuses sealed resources and `template.list` only knows catalog
rows. Accepted deliberately — the reservation machinery that prevented it cost a
state column, two lifecycle methods, and a promote/release pair. Tracked as
[general-updates AR-1](../../../../../../scratch/0-general-updates.md#ar-1--registration-can-leak-an-orphaned-backing-resource).

## Update

```text
template.update(templateId, expectedRevision, name?, description?,
                contextBindings?, resourceOperations?)
  1. load the record                          -> not_found
  2. revision check                           -> revision_conflict, before any effect
     name check, if renaming                  -> name_conflict, before any effect
  3. resource.applyBindings({ ... })          # only if contextBindings changed
  4. resource.submit({ ... })                 # only if resourceOperations given
  5. store.update: CAS on expectedRevision
       archive the replaced record to history at its old revision
       write the replacement at revision + 1
       append the receipt and the template.updated transaction
     ...all in one SQLite transaction
```

**Both halves in one command.** The catalog declaration and the content it
describes are two statements about the same template; letting them be edited
separately is exactly how they drift. Renaming a variable through the resource's
own endpoints would otherwise leave the catalog advertising a parameter that no
longer exists, and nothing would notice.

**Two resource calls, not one**, because they are two different statements: one
about the template's parameters, one about its content. Bindings go first, so a
content edit referencing a freshly bound variable sees it.

Both preconditions are checked in step 2, before any resource call, so a rejected
update never leaves edited content behind an unchanged declaration.

Step 5's archive is what keeps the revision chain contiguous. Deletion already
snapshots before it tombstones; an update that skipped the snapshot would be the
one transition leaving no history, and `latestSnapshot` would then hand back
pre-update state as though it were current.

## Reading

```text
template.load(templateId)
  1. load the record                          -> not_found
  2. resources.get(record.kind)               -> unsupported_kind
  3. resource.load({ resourceId })            # the resource's own ID
  4. return { template, content }             # content is opaque, unread
```

Separate from `template.get`, which is a single store read and calls no resource
— a picker lists a catalog and should not pay for content. `template.load` exists
because registration seals the owning capability's own read surface, so Templates
becomes the only route to a backing copy's content.

## Listing

```text
template.list(kinds?, search?, limit?, cursor?)
  -> { templates, nextCursor? }
```

The only template listing in the system, so it is shaped as a picker rather than
a dump: any-of by kind, case-insensitive substring over name and description,
keyset pagination over `(createdAt, id)`.

An explicit `kinds: []` matches nothing rather than everything — a caller that
filtered every kind out should see nothing, not the whole catalog. A search
term's `%` and `_` are escaped, so searching for `"50%"` finds that text instead
of matching every row.

## Instantiation

```text
template.instantiate(templateId, name?, contextBindings)
  1. load the record                          -> not_found
  2. resources.get(record.kind)               -> unsupported_kind
  3. bindings must name exactly the declared parameters, each with a target
                                              -> binding_mismatch, before any effect
                                              (a missing target is a 400 at the wire)
  4. resource.duplicate({ sourceResourceId: record.resourceId, name?,
                          idempotencyKey })   -> the instance's allocated ID
  5. resource.applyBindings({ ... })          # skipped when nothing is declared
     ...and no markAsTemplate: an instance is an ordinary resource
  6. receipt; return { template, resource }
```

The mirror of registration, one call shorter. No catalog row is written: the
instance belongs entirely to its owning capability, whose ordinary list and query
surface discovers it.

Step 3 is strict in three directions, and together they are what make "no
instance holds an unbound variable" true by construction:

- a **missing** parameter is refused, rather than left to whatever the copy
  inherited;
- an **extra** one is refused, because a variable the template did not declare is
  baked-in content and binding it would edit the instance rather than configure
  it;
- a parameter supplied **without a target** is refused at the wire, because that
  is exactly the unbound state this rule exists to prevent. The same shape is
  legal at registration, where it means "a parameter with no default".

Step 4 copies the declared targets verbatim — `duplicate` knows nothing about
bindings — and step 5 replaces them with the supplied ones. So a declared target
is what the *template* holds, which is what makes the template itself openable
and previewable; it is never what an instance silently falls back to.

## Deletion

```text
template.delete(templateId)
  1. load the record
  2. resources.get(record.kind)
  3. resource.logicalDelete({ resourceId, idempotencyKey })
  4. archive + tombstone + receipt + template.deleted transaction, one transaction
```

The registration source and any prior instances are untouched.

`template.purge` runs off the archived snapshot, which is why history has to keep
`resourceId`: without it there would be nothing left to name when the live row is
gone.

## Recovery

A crash before the local commit leaves nothing — no row, no receipt, no
transaction — so the retry re-runs the command from the start and the resource
replays its own attempt on the same key. A crash *after* the local commit leaves
all of it, so the retry replays from the receipt without touching the resource.

There is no third case, because the row, the receipt, and the transaction commit
together. That is the whole recovery story: no sweep job, no pending state, no
frozen identity.

## Activity

Accepted registrations, updates, and deletions each write a source transaction,
including the command's origin, to the local outbox in the same transaction as
the catalog change, so a transaction cannot exist without its change.
`publishPendingActivity()` drains it through the injected publisher and marks
each transaction published; a delivery failure logs, stops the drain, and leaves
the row for next time without altering the accepted command result.

Instantiation publishes nothing here — the owning resource capability publishes
its own creation transaction, and a second item for the same resource would be
duplicate history.
