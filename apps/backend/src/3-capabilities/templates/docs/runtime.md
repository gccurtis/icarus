# Templates runtime

## Construction

```text
config + logger + Activity
  -> resource capabilities
  -> createTemplateAdapterRegistry()      # empty in the current tree
  -> createTemplatesInstance(config, adapters, activity, logger)
  -> registerTemplateEndpoints(registry, templates, logger)
  -> templates.publishPendingActivity()   # startup outbox drain
```

Templates is constructed after the resource capabilities so adapters can be
registered into it without a constructor cycle. It receives the registry through
the read-only `TemplateResourceRegistry` face; `RuntimeTemplateAdapterRegistry`
in [`1-init/create/templates.ts`](../../../1-init/create/templates.ts) is the
mutable-during-composition half.

`createTemplateCapability(store, dependencies, options, clock?, newId?)` follows
the house factory idiom; the class is not exported. The clock and ID generator
are injectable for testing and default to `new Date()` and `randomUUID`.

Storage is `./data/templates.db` with project-hashed table names
`tpl_<sha256(projectId)[0..16]>_{templates,command_claims,activity_outbox}`.

## Endpoints

| Method | Path | Queue | Purpose |
|---|---|---|---|
| `POST` | `/templates/command` | serial | Register, instantiate, delete |
| `POST` | `/templates/query` | concurrent | Get or list catalog records |

**Why the command endpoint is serial.** It mutates, and the service
reads-then-writes across several store calls that no single statement makes
atomic. `countLive()` and `reserve()` are separate statements, so concurrent
registrations could each observe room under `maxTemplatesPerProject` and then
all reserve, overshooting the limit. Claim-then-execute has the same shape: two
concurrent retries of one `requestId` would both observe a pending claim and
both drive the adapter.

This is the same reason Document and Slide commands are serial, and it is what
the house rule means by serialising where the store cannot enforce the
invariant on its own. The cost is that a slow adapter copy holds the single
serial slot; that is accepted, exactly as it is for Document.

[`test/capabilities/templates-wiring.test.ts`](../../../../test/capabilities/templates-wiring.test.ts)
asserts both queue choices so they cannot drift.

## Status codes

| Outcome | Status | Body code |
|---|---|---|
| `template.registered`, `template.instantiated` | 201 | — |
| `template.deleted` | 200 | — |
| `TemplateNotFoundError` | 404 | `not_found` |
| `TemplateAlreadyExistsError` | 409 | `already_exists` |
| `TemplateIdempotencyMismatchError` | 409 | `idempotency_mismatch` |
| `TemplateUnsupportedKindError` | 400 | `unsupported_kind` |
| `TemplateCatalogLimitError` | 400 | `catalog_limit_exceeded` |
| `TemplateWireError`, `TemplateValidationError` | 400 | `validation_error` |
| anything else | 500 | `internal_error` |

The 500 branch returns a fixed generic message and logs the real one. Only
`>= 500` is logged; expected 4xx outcomes are not error-logged.

## Idempotency keys

Minted by Templates from the claimed request, never by the caller:

```text
templates:register:<requestId>
templates:instantiate:<requestId>
templates:delete:<requestId>
```

A resumed pending claim replays the same key, so an adapter that owns a durable
attempt returns its existing result rather than copying again.

## Configuration

```yaml
templates:
  maxTemplatesPerProject: 500
```

## Logging

`templates.registered`, `templates.instantiated`, `templates.deleted` at info
with `templateId`, `kind`, and `requestId`; `templates.activity.publish-failed`
at warn; `templates.endpoints.registered` at info during startup;
`templates.command.failed` / `templates.query.failed` at error for 5xx only.
