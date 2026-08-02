# Templates flows

Every command runs the same preamble:

```text
1. decode `{ requestId, origin, command }` strictly at the wire boundary
2. digest = canonicalDigest(command)          # sorted keys, undefined dropped
3. outcome = store.claimCommand(...)
     digest or command type differs -> idempotency_mismatch
     completed -> replay the stored result
     pending   -> resume on the frozen identity
     claimed   -> continue
4. command-specific work
5. store.completeClaim(requestId, result)
```

## Registration

```text
template.register(source, name, description?, contextBindings?)
  1. resolve the adapter for source.kind      -> unsupported_kind, before any write
  2. nameTaken(source.kind, name)             -> name_conflict, before any write
  3. allocate templateId
     bindClaimTemplateId(requestId, templateId)
     reserve({ id: templateId, state: "reserving", name, description,
               contextBindings, revision: 1 })
  4. adapter.createTemplateCopy({ sourceResourceId, templateId,
                                  contextBindings, idempotencyKey })
  5. markReady + template.registered source transaction, one transaction
  6. completeClaim with the full record       <- how the caller learns the ID
```

Step 4 is ordered after step 3 deliberately. Because Templates allocates the
identifier, that identifier has to be durable before the external call, or a
crash mid-copy leaves nothing to resume from and a retry mints a second identity
and a second backing resource. It also means a collision — of identity or of
name — is detected before any side effect rather than after one.

The reservation carries the declared bindings and the name, not just the ID.
Both are catalog facts, and the record is the only place either exists.

On an adapter throw the reservation is released, so a failed registration does
not burn the ID or hold its name.

## Update

```text
template.update(templateId, expectedRevision, name?, description?,
                contextBindings?, resourceOperations?)
  1. load the ready record                    -> not_found
  2. revision check                           -> revision_conflict, before any effect
     name check, if renaming                  -> name_conflict, before any effect
  3. adapter.updateTemplateCopy({ ... })      # skipped when neither content nor
                                              # bindings changed
  4. store.update: CAS on expectedRevision
       archive the replaced record to history at its old revision
       write the replacement at revision + 1
       append the template.updated transaction
     ...all in one SQLite transaction
  5. completeClaim with the updated record
```

**Both halves in one command.** The catalog declaration and the content it
describes are two statements about the same template; letting them be edited
separately is exactly how they drift. Renaming a variable through the resource's
own endpoints would otherwise leave the catalog advertising a parameter that no
longer exists, and nothing would notice.

Both preconditions are checked in step 2, before step 3, so a rejected update
never leaves edited content behind an unchanged declaration.

Step 4's archive is what keeps the revision chain contiguous. Deletion already
snapshots before it tombstones; an update that skipped the snapshot would be the
one transition leaving no history, and `latestSnapshot` would then hand back
pre-update state as though it were current.

## Reading

```text
template.load(templateId)
  1. load the ready record                    -> not_found
  2. resolve the adapter                      -> unsupported_kind
  3. adapter.readTemplateCopy({ templateId })
  4. return { template, content }              # content is opaque
```

Separate from `template.get`, which is a single store read and calls no adapter
— a picker lists a catalog and should not pay for content. `template.load`
exists because registration seals the owning capability's own read surface, so
Templates becomes the only route to a backing copy's content.

## Instantiation

```text
template.instantiate(templateId, destinationResourceId, title?, contextBindings?)
  1. load the ready record                    -> not_found if missing/reserving/deleted
  2. resolve the adapter for record.kind
  3. adapter.instantiateTemplate({ templateId, destinationResourceId,
                                   instantiation, idempotencyKey })
  4. completeClaim with { template, resource }
```

No catalog row is written. The instance belongs entirely to its owning
capability, whose normal list/query surface discovers it.

Bindings may be omitted, empty, or partial. Templates never checks completeness
— an unbound variable is legal state on the destination, refused only when a
Prompt tries to produce a concrete Context scope from it.

## Deletion

```text
template.delete(templateId)
  1. load the ready record
  2. resolve the adapter
  3. adapter.logicalDeleteTemplateCopy({ templateId, idempotencyKey })
  4. logical delete + template.deleted source transaction, one transaction
```

The registration source and any prior instances are untouched.

## Recovery

A crash between the adapter call and finalisation leaves a `pending` claim with
its `template_id` bound and a `reserving` catalog row. The next identical
request resumes on that identity and replays the same adapter idempotency key.
No sweep job is needed: an abandoned reservation is invisible to `get` and
`list` and blocks only its own identity, which nothing else can name — and its
name, which a caller can pick differently.

`template.update` recovers the same way. Its adapter call runs before the local
commit, so a crash in between leaves edited content under an unchanged
declaration and a still-pending claim; the retry replays the same adapter
idempotency key and completes the catalog write.

## Activity

Accepted registrations, updates, and deletions each write a source transaction,
including the command's
origin, to the local outbox in the same transaction as the catalog change, so a
transaction cannot exist without its change. `publishPendingActivity()` drains it
through the injected publisher and marks each transaction published; a delivery failure
logs, stops the drain, and leaves the row for next time without altering the
accepted command result.

Instantiation publishes nothing here — the owning resource capability publishes
its own creation transaction, and a second item for the same resource would be
duplicate history.
