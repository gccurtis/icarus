# Templates flows

Every command runs the same preamble:

```text
1. decode strictly at the wire boundary
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
template.register(source, description?, contextBindings?)
  1. resolve the adapter for source.kind      -> unsupported_kind, before any write
  2. check maxTemplatesPerProject
  3. allocate templateId
     bindClaimTemplateId(requestId, templateId)
     reserve({ id: templateId, state: "reserving", description })
  4. adapter.createTemplateCopy({ sourceResourceId, templateId,
                                  contextBindings, idempotencyKey })
  5. markReady + template.registered fact, one transaction
  6. completeClaim with the full record       <- how the caller learns the ID
```

Step 3 is ordered before step 4 deliberately. Because Templates allocates the
identifier, that identifier has to be durable before the external call, or a
crash mid-copy leaves nothing to resume from and a retry mints a second identity
and a second backing resource. It also means a collision is detected before any
side effect rather than after one.

On an adapter throw the reservation is released, so a failed registration does
not burn the ID.

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
  3. adapter.deleteTemplateCopy({ templateId, idempotencyKey })
  4. softDelete + template.deleted fact, one transaction
```

The registration source and any prior instances are untouched.

## Recovery

A crash between the adapter call and finalisation leaves a `pending` claim with
its `template_id` bound and a `reserving` catalog row. The next identical
request resumes on that identity and replays the same adapter idempotency key.
No sweep job is needed: an abandoned reservation is invisible to `get` and
`list` and blocks only its own identity, which nothing else can name.

## Activity

Accepted registrations and deletions write a fact to the local outbox in the
same transaction as the catalog change, so a fact cannot exist without its
change. `publishPendingActivity()` drains it through the injected publisher and
marks each fact published; a delivery failure logs, stops the drain, and leaves
the row for next time without altering the accepted command result.

Instantiation publishes nothing here — the owning resource capability publishes
its own creation transaction, and a second item for the same resource would be
duplicate history.
