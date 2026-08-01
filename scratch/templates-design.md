# Templates Capability — Design

## Intent

Templates is a small, regular, project-scoped capability that keeps one
catalog of reusable resource templates. A template is not a second generic
content format. It is a reference to a template-mode resource owned by another
kind, such as Document.

Registering a template makes a detached copy of an existing resource through
that resource kind's copy adapter. Using a template makes another detached
copy, this time as a normal resource. The source, the backing template, and
every instance can be edited independently.

The first version is deliberately narrow:

- project scope only;
- register a resource as a template;
- list and get registered templates;
- instantiate a template as a normal resource; and
- delete a template through its owning resource kind.

Cross-project sharing, template marketplaces, permissions, categories,
version pinning, and arbitrary template parameters are deferred.

## Ownership boundary

Templates owns:

- which backing resources are registered as templates;
- the stable template ID and resource kind;
- exact command replay for registration, instantiation, and deletion; and
- dispatch to one injected adapter for the registered kind.

Templates does not own:

- resource content, revision history, internal IDs, names, or validation;
- how a Document, Slide, Spreadsheet, or other resource is copied;
- Context records or Context resolution;
- Derived Outputs referenced by another resource; or
- copies already instantiated from a template.

The resource capability owns the `isTemplate`/resource-mode flag and copy
rules. Templates never reads or writes another capability's tables directly.

```text
Templates catalog
  Template { id, kind, resourceId }
                       |
                       +-- kind adapter --> backing resource in template mode
```

## Identity and record

```ts
interface TemplateRecord {
  /** Stable catalog identity, allocated before the backing copy is made. */
  readonly id: string;

  /** Owning resource kind, initially "document". */
  readonly kind: string;

  /** ID used to open the backing copy through the owning capability. */
  readonly resourceId: string;

  readonly createdAt: string;
}
```

In version 1, `resourceId === id`. The explicit `resourceId` remains in the
record because the catalog reference is always the pair `(kind, resourceId)`,
and future resource kinds should not have to infer an address from a Template
record's storage key.

Templates does not own a second display name. A resource adapter may return a
resource summary for presentation, but the catalog does not duplicate that
mutable metadata. For a Document template, the backing Document's title is
editable and can be used as the library label. An instantiated Document still
receives its own destination title.

A Template has no independent content revision. The backing resource's
revision is authoritative. Editing the backing resource does not create a new
Template record or change its ID.

## Resource adapter registry

Templates is generic because startup injects one adapter per supported kind:

```ts
interface TemplateResourceRef {
  readonly kind: string;
  readonly resourceId: string;
}

interface TemplateResourceAdapter {
  readonly kind: string;

  createTemplateCopy(input: {
    sourceResourceId: string;
    templateId: string;
    idempotencyKey: string;
  }): Promise<TemplateResourceRef>;

  instantiateTemplate(input: {
    templateId: string;
    destinationResourceId: string;
    /** Strictly decoded by this kind's adapter; never persisted by Templates. */
    arguments?: unknown;
    idempotencyKey: string;
  }): Promise<TemplateResourceRef>;

  deleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;
}

interface TemplateResourceRegistry {
  get(kind: string): TemplateResourceAdapter | undefined;
}
```

The `unknown` value is an internal type-erasure boundary, not an unvalidated
public payload. Job wiring selects the kind adapter, and that adapter owns a
strict decoder for its instantiation arguments. The Document arguments are
defined in the
[Templates and Context Variables addendum](document-design/templates-and-context-variables.md).
Unknown fields and unsupported arguments are rejected before any copy begins.

Adding another kind means implementing and registering another adapter. It
does not add a new union member, table, or import to the Templates domain.

## Commands and queries

All identifiers are supplied before work begins so retries use the same source
and destination identities.

```ts
interface TemplateCommandRequest {
  readonly requestId: string;
  readonly command: TemplateCommand;
}

type TemplateCommand =
  | {
      type: "template.register";
      templateId: string;
      source: TemplateResourceRef;
    }
  | {
      type: "template.instantiate";
      templateId: string;
      destinationResourceId: string;
      arguments?: unknown;
    }
  | {
      type: "template.delete";
      templateId: string;
    };

type TemplateCommandResult =
  | { type: "template.registered"; template: TemplateRecord }
  | {
      type: "template.instantiated";
      template: TemplateRecord;
      resource: TemplateResourceRef;
    }
  | { type: "template.deleted"; templateId: string };

type TemplateQuery =
  | { type: "template.get"; templateId: string }
  | { type: "template.list"; kind?: string };
```

`template.list` returns live records ordered by creation time and ID. The
initial catalog is bounded by a configured project limit and does not expose a
pagination contract. Pagination can be added without changing record identity
or copy behavior.

The public surface uses the repository's two static paths:

| Method | Path | Queue | Purpose |
|---|---|---|---|
| `POST` | `/templates/command` | serial | Register, instantiate, or delete with exact replay. |
| `POST` | `/templates/query` | concurrent | Get or list catalog records. |

There is no public command for setting `kind`, `resourceId`, or template mode
on an existing resource. Registration always creates a copy.

## Registration flow

```text
template.register(templateId, source kind + resourceId)
  1. Claim requestId and its canonical command digest.
  2. Resolve the injected adapter for source.kind.
  3. Ask it to copy the frozen source as templateId in template mode.
  4. Require the returned reference to match (kind, templateId).
  5. Insert the ready Template record and complete the command receipt.
```

Registration never turns the original resource into a template. Later changes
to the original do not affect the backing template, and later changes to the
backing template do not affect the original.

The adapter call is idempotent. A crash after the resource copy but before the
catalog insert is recovered by replaying the same adapter key and completing
the pending claim; it must not create a second backing resource.

## Instantiation flow

```text
template.instantiate(templateId, destinationResourceId, arguments)
  1. Claim requestId and its canonical command digest.
  2. Load the ready Template record.
  3. Resolve the adapter for Template.kind.
  4. Strictly decode kind-specific arguments.
  5. Ask the adapter to copy the backing template as a normal resource.
  6. Complete the command receipt with the new resource reference.
```

Instantiation reads the backing resource at one frozen revision. It never
aliases the template's mutable state. A later template edit affects only later
instantiations.

Templates does not store an instance list. The new resource belongs entirely
to its owning capability, whose normal list/query surface discovers it. Exact
replay of the Templates command returns the same destination resource.

## Editing and deletion

The backing resource is opened and edited through its normal resource
capability using `TemplateRecord.resourceId`. The resource capability allows
content edits in template mode but keeps template-mode resources out of its
ordinary resource list.

Only `template.delete` may remove a backing template. The Templates service
first claims the command, asks the resource adapter to delete or tombstone the
backing copy, and then soft-deletes the catalog record. The original resource
and already-created instances are untouched.

Resource capabilities must reject an ordinary request that tries to change a
resource between template and normal mode or delete a registered backing
template behind the catalog.

## Persistence and idempotency

Templates is scoped only by configured `projectId`. It uses its own initial
SQLite file and project-hashed table prefix, matching current capability
conventions:

```text
./data/templates.db
tpl_${sha256(projectId).slice(0, 16)}_templates
```

Logical storage is small:

```sql
CREATE TABLE templates (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  deleted_at  TEXT,
  UNIQUE (kind, resource_id),
  CHECK (resource_id = id)
);

CREATE TABLE template_command_claims (
  request_id      TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  command_type    TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
  result_json     BLOB,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

An identical `requestId` retry returns the stored result. Reusing a request ID
with different canonical input returns `idempotency_mismatch`. Pending claims
are safe to resume because template and destination IDs are frozen before any
adapter call and every adapter receives a deterministic idempotency key.

No SQLite transaction spans Templates and a resource database.

## Activity

Templates writes accepted registry changes to its normal source-local Activity
outbox and publishes them through the injected Activity publisher:

- `template.registered` for a new catalog/backing template;
- `template.deleted` for removal.

Instantiation already causes the owning resource to publish its normal
creation transaction, so Templates does not publish a second activity item for
the same created resource. Template command retries publish nothing new.

## Construction

Resources are constructed before Templates, then startup builds the adapter
registry and passes it into the Templates capability:

```text
config + logger + Activity
  -> resource capabilities (Document first)
  -> Template resource adapters
  -> Templates store and runtime
  -> Templates endpoints
```

This direction avoids a constructor cycle. Document does not receive the
Templates runtime. Templates receives only the narrow Document adapter, not
Document's store or reducer.

Proposed placement:

```text
apps/backend/src/
  1-init/create/templates.ts
  3-capabilities/templates/
    application/templateService.ts
    domain/errors.ts
    domain/model.ts
    persistence/sqliteTemplateStore.ts
    persistence/sqliteSchema.ts
    ports/activityPublisher.ts
    ports/resourceAdapter.ts
    ports/templateStore.ts
    wire/commandSchemas.ts
    wire/querySchemas.ts
    docs/
    index.ts
  4-job-wiring/templates/registerTemplateEndpoints.ts
```

## Invariants

1. Templates is project-scoped only; public input cannot select a project or
   user storage scope.
2. Every live Template record resolves to exactly one `(kind, resourceId)`.
3. In version 1, the backing resource ID equals the Template ID.
4. A backing resource is a detached copy, never an alias of the registration
   source.
5. An instantiated resource is a detached normal resource, never an alias of
   its template.
6. Templates never reads or writes resource-owned tables directly.
7. Unsupported kinds fail before a catalog row or destination is created.
8. Exact command retries return the original result; divergent reuse fails.
9. Ordinary resource APIs cannot promote, demote, or delete a registered
   template behind the Templates catalog.
10. Deleting a template does not mutate its source or prior instances.

## Deferred

- cross-project, user-level, organization-level, or public templates;
- template versions or instance pinning to a named template version;
- categories, thumbnails, search ranking, favorites, or marketplace metadata;
- live linkage or propagation from a template into existing instances;
- arbitrary parameter-schema infrastructure; and
- batch instantiation.

## Implementation order

1. Add the project-scoped Templates model, SQLite store, command claims, and
   get/list queries.
2. Add the adapter registry and strict command/query wiring.
3. Implement the Document template adapter and Document-mode persistence from
   the companion addendum.
4. Wire registration, instantiation, deletion, startup recovery, and Activity
   outbox publication.
5. Add focused tests for detached copies, `resourceId === templateId`, exact
   retry, divergent retry, unsupported kind, missing backing resource, and
   deletion isolation.
