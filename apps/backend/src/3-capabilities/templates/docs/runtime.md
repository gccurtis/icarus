# Templates runtime

## Construction

```text
config + logger + Activity
  -> resource capabilities
  -> createTemplateResourceRegistry()      # empty in the current tree
  -> createTemplatesInstance(config, resources, activity, logger)
  -> registerTemplateEndpoints(registry, templates, logger)
  -> templates.publishPendingActivity()    # startup outbox drain
```

Templates is constructed after the resource capabilities so their runtime objects
can be registered into it without a constructor cycle. Registration is one line
per kind, with no wrapper:

```ts
templateResources.register(document);
```

It receives the registry through the read-only `TemplatableResourceRegistry`
face; `RuntimeTemplateResourceRegistry` in
[`1-init/create/templates.ts`](../../../1-init/create/templates.ts) is the
mutable-during-composition half. That file is the only place that sees both
Templates and a resource capability, which is what keeps them from importing each
other.

`createTemplateCapability(store, dependencies, clock?, createId?)` follows the
house factory idiom; the class is not exported. The clock and ID generator are
injectable for testing and default to `new Date()` and `randomUUID`.

Storage is `./data/templates.db` with project-hashed table names
`tpl_<sha256(projectId)[0..16]>_{templates,history,command_receipts,transaction_outbox}`.

## Endpoints

| Method | Path | Queue | Purpose |
|---|---|---|---|
| `POST` | `/templates/command` | serial | Register, update, instantiate, delete, purge |
| `POST` | `/templates/query` | concurrent | Get, search, or load |

**Why the command endpoint is serial.** It mutates, and the service
reads-then-writes across several store calls that no single statement makes
atomic. Receipt-then-execute has the same shape: two concurrent retries of one
`requestId` would both find no receipt and both drive the resource.

This is the same reason Document commands are serial, and it is what the house
rule means by serialising where the store cannot enforce the invariant on its
own. The cost is that a slow `duplicate` holds the single serial slot; that is
accepted, exactly as it is for Document.

[`test/capabilities/templates-wiring.test.ts`](../../../../test/capabilities/templates-wiring.test.ts)
asserts both queue choices so they cannot drift.

## Status codes

| Outcome | Status | Body code |
|---|---|---|
| `template.registered` | 201 | — |
| `template.updated`, `template.instantiated`, `template.deleted`, `template.purged` | 200 | — |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `TemplateNotFoundError` | 404 | `not_found` |
| `TemplateAlreadyExistsError` | 409 | `already_exists` |
| `TemplateNameConflictError` | 409 | `name_conflict` |
| `StaleTemplateRevisionError` | 409 | `revision_conflict` |
| `TemplateIdempotencyMismatchError` | 409 | `idempotency_mismatch` |
| `TemplateBindingMismatchError` | 400 | `binding_mismatch` (+ `missing`, `unexpected`) |
| `InvalidTemplateCursorError` | 400 | `invalid_cursor` |
| `TemplateUnsupportedKindError` | 400 | `unsupported_kind` |
| `TemplateWireError` | 400 | `validation_error` |
| anything else | 500 | `internal_error` |

The 500 branch returns a fixed generic message and logs the real one. Only
`>= 500` is logged; expected 4xx outcomes are not error-logged.

`binding_mismatch` carries the offending names as arrays rather than only in its
message, because a client fixing the call needs them.

## Idempotency keys

Minted by Templates from the request, never by the caller:

```text
templates:register:<requestId>
templates:update:<requestId>
templates:instantiate:<requestId>
templates:delete:<requestId>
templates:purge:<requestId>
templates:retention-purge:<templateId>
```

**One key per command, shared by every call that command makes.** A command's
calls are steps in one procedure rather than independent operations, so they
replay together or not at all — and a resource that keys `duplicate` off its own
create receipt sees the same key on the retry that produced the copy.

A retry after a failure re-runs the command from the start, because nothing was
written. The key is what makes that safe: the resource replays its own completed
attempt instead of performing a second one.

## Command origin

Every command body includes a required `origin` of `user`, `agent`,
`automation`, or `system`. It is not part of the command digest. Registration,
update, and deletion persist that origin on their transaction-outbox row and pass
it to Activity unchanged.

## Logging

`templates.registered`, `templates.updated`, `templates.instantiated`,
`templates.deleted`, `templates.purged` at info with `templateId`, `kind`, and
`requestId`; `templates.query.completed` at debug; `templates.command.failed` at
warn on any command failure; `templates.activity.publish-failed` at warn;
`templates.endpoints.registered` at info during startup;
`templates.command.failed` / `templates.query.failed` at error for 5xx only.

The list query logs `searched: true` rather than the term itself — a search
string is user content, and the useful signal is whether filtering happened.
