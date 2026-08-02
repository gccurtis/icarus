# Templates Capability — Design

## Intent

Templates is a small, regular, project-scoped capability that keeps one
catalog of reusable resource templates. A template is not a second generic
content format. It is a reference to a template-mode resource owned by another
kind, such as Document.

Registering a template makes a detached copy of an existing resource through
that resource kind's copy adapter, and returns the new Template's ID. Using a
template makes another detached copy, this time as a normal resource. The
source, the backing template, and every instance can be edited independently.

The organising idea is that **a template turns a resource into a function of
its Context Variables**. Registration keeps the resource's structure and clears
what its variables pointed at; instantiation supplies the arguments, or leaves
them to be filled in later.

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
- allocation of the stable template ID, and the resource kind;
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

Context in particular is untouched. Templates has no Context runtime
dependency, declares no Context port, and never creates, mutates, resolves, or
deletes a Context record. Instantiation arguments may *reference* a Context,
but only as an opaque `(kind, id)` pair that the owning resource adapter
decodes — see the
[Templates and Context Variables addendum](document-design/templates-and-context-variables.md).
Because Context is now project-scoped only, with no user scope and no
project-then-user fallback, such a reference resolves identically for every
instantiation in the project, and no Templates command carries a scope
selector.

```text
Templates catalog
  Template { id, kind, resourceId }
                       |
                       +-- kind adapter --> backing resource in template mode
```

## Identity and record

```ts
interface TemplateRecord {
  /** Stable catalog identity. Allocated by Templates, never supplied by a caller. */
  readonly id: string;

  /** Owning resource kind, initially "document". */
  readonly kind: string;

  /** ID used to open the backing copy through the owning capability. */
  readonly resourceId: string;

  readonly createdAt: string;
}
```

**Templates allocates the Template ID and returns it.** A caller registering a
template is pointing at a resource it already owns and asking for a catalog
entry it has never seen; it has no basis on which to name that entry. So
`template.register` takes no ID, and the allocated `TemplateRecord` is the
command's result.

This is deliberately different from resource creation. Resource IDs *are*
caller-supplied throughout this backend — `document.create` takes a
`documentId` — because the caller is creating something it will immediately
address. The Template ID is catalog identity, not resource identity, and the
catalog is Templates' own concept.

In version 1, `resourceId === id`: Templates allocates one identifier and hands
it down to the adapter as the ID for the backing copy, exactly as a caller
hands `documentId` to `document.create`. The explicit `resourceId` remains in
the record because the catalog reference is always the pair
`(kind, resourceId)`, and future resource kinds should not have to infer an
address from a Template record's storage key.

Allocating rather than accepting the ID does not weaken exact replay. The
identifier is minted once and **frozen in the command claim before any adapter
call**, so an exact retry and a resumed pending claim both reuse it. This is the
same technique as Document's delegated command claim, which freezes its target
output ID before the external side effect starts.

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

/** Variable name -> target. Names are the user-facing labels, not stable IDs. */
type TemplateContextBindings = Readonly<Record<string, ContextEntry>>;

interface TemplateInstantiationInput {
  /** Omitted means the instance keeps the backing template's title. */
  readonly title?: string;

  /** Omitted, empty, and partial are all legal. */
  readonly contextBindings?: TemplateContextBindings;
}

interface TemplateResourceAdapter {
  readonly kind: string;

  createTemplateCopy(input: {
    sourceResourceId: string;
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;

  instantiateTemplate(input: {
    templateId: string;
    destinationResourceId: string;
    instantiation: TemplateInstantiationInput;
    idempotencyKey: string;
  }): Promise<void>;

  deleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;
}

interface TemplateResourceRegistry {
  get(kind: string): TemplateResourceAdapter | undefined;
}
```

**Adapter methods return nothing.** An earlier draft had the copy methods
return a `TemplateResourceRef`, which Templates then had to validate against
what it asked for. That check protected nothing: Templates supplies both the
`kind` and the destination ID, so a successful adapter call can only have
produced the resource it was told to produce. Returning `void` removes a
redundant round-trip and a whole failure mode. `TemplateResourceRef` survives
only as the shape of the registration *source* and of the command result.

**Instantiation input is typed, not type-erased.** An earlier draft passed
`arguments?: unknown` for each adapter to decode privately. That is the wrong
boundary. The thing an instantiation actually varies is the resource's Context
Variables, and Context Variables are **resource-level structure**, not a
Document peculiarity — the point of a template is that a resource becomes a
function of its variables, whatever kind of resource it is. Hoisting that into
`TemplateInstantiationInput` lets the wire layer decode it strictly at the edge
in the house style, instead of pushing an unvalidated blob through the domain
for a private decoder to interpret.

`ContextEntry` is a type-only import of the `{ id, kind }` atom, matching
Structured Data and Derived Outputs. Templates still has no Context runtime,
port, read, or write.

Adding another kind means implementing and registering another adapter. It
does not add a new union member, table, or import to the Templates domain — a
kind that has no Context Variables simply receives empty bindings.

## Commands and queries

Every identifier a caller *can* know is supplied before work begins, so retries
address the same source and destination. The one identifier a caller cannot
know — the Template ID — is allocated by Templates and frozen in the command
claim before any adapter call, which gives retries the same guarantee.

```ts
interface TemplateCommandRequest {
  readonly requestId: string;
  readonly command: TemplateCommand;
}

type TemplateCommand =
  | {
      type: "template.register";
      /** No templateId: Templates allocates it and returns it. */
      source: TemplateResourceRef;
    }
  | {
      type: "template.instantiate";
      templateId: string;
      destinationResourceId: string;
      title?: string;
      contextBindings?: TemplateContextBindings;
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

> **Under review (deviation D1 in
> [`templates-implementation-plan.md`](templates-implementation-plan.md)).** The
> plan argues `/templates/command` should be **concurrent**, not serial:
> Templates holds no revisioned state, every mutation is a single-row store
> invariant, and a serial adapter call would block the single serial slot —
> and therefore every Document and Slide command — for the duration of a
> cross-database resource copy. Not yet applied to this table.

## Registration flow

```text
template.register(source kind + resourceId)
  1. Claim requestId and its canonical command digest.
  2. Resolve the injected adapter for source.kind; unknown kind fails here.
  3. Allocate templateId and reserve the catalog row for it.
  4. Ask the adapter to copy the frozen source as templateId in template mode.
  5. Mark the record ready and complete the command claim with it.
```

The reservation at step 3 is not optional bookkeeping. Because Templates now
allocates the identifier, that identifier has to become durable *before* the
adapter call, or a crash mid-copy would have nothing to resume from and a retry
would mint a second ID and a second backing resource. Reserving first also
means a collision is detected before any external side effect rather than
after one.

A reserved-but-not-ready record is invisible to `template.get` and
`template.list`. A crash between steps 4 and 5 is recovered by replaying the
same adapter idempotency key against the reserved ID; the adapter's own durable
attempt returns its existing result rather than copying again.

Registration never turns the original resource into a template. Later changes
to the original do not affect the backing template, and later changes to the
backing template do not affect the original.

### Registration clears the Context Variable bindings

A backing template copies its source's Context Variable **identities and
names** but not their **targets**. Every variable on a freshly registered
template is unbound.

This is the point of the feature rather than a detail of it. Registering a
template means "keep this resource's structure, forget what it was pointed at",
so that the template is a function of its variables and each instantiation
supplies the arguments. A template that silently retained the source's
bindings would produce instances quietly grounded in whatever the original
author happened to be working on.

Direct, literally-authored references are not cleared — only variable targets.
A template author who wants a reference to survive every instantiation authors
it directly instead of through a variable.

The mechanics for Documents are in the
[Templates and Context Variables addendum](document-design/templates-and-context-variables.md).

## Instantiation flow

```text
template.instantiate(templateId, destinationResourceId, title?, contextBindings?)
  1. Claim requestId and its canonical command digest.
  2. Load the ready Template record.
  3. Resolve the adapter for Template.kind.
  4. Ask the adapter to copy the backing template as a normal resource,
     applying the supplied bindings.
  5. Complete the command claim with the new resource reference.
```

Instantiation input is decoded strictly at the wire boundary, before step 1,
like every other command in this capability. There is no per-kind private
decoding step.

Instantiation reads the backing resource at one frozen revision. It never
aliases the template's mutable state. A later template edit affects only later
instantiations.

### Bindings are optional

`contextBindings` may be omitted, empty, or partial. A variable that no binding
names stays unbound on the instance, and the owning resource capability can
bind it later through its ordinary editing surface.

This matters because instantiation is not the only moment a user can decide
what a template points at. Requiring a complete binding set would force a
caller to resolve every reference up front, when the natural flow is often to
create the instance and then fill it in. The rule is therefore that unbound
variables are legal state on any resource, and are only refused where they
would actually cause harm — at the point a Prompt tries to produce a concrete
Context scope. That admission check is described in the addendum.

`title` is likewise optional; an instance keeps the backing template's title
when none is supplied, and can be renamed afterwards.

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
  state       TEXT NOT NULL CHECK (state IN ('reserving', 'ready')),
  created_at  TEXT NOT NULL,
  deleted_at  TEXT,
  UNIQUE (kind, resource_id),
  CHECK (resource_id = id)
);

CREATE TABLE template_command_claims (
  request_id     TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  command_type   TEXT NOT NULL,
  -- The identifier Templates allocated for this request, frozen before the
  -- adapter call so a resumed claim never mints a second one.
  template_id    TEXT,
  state          TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
  result_json    BLOB,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
```

An identical `requestId` retry returns the stored result. Reusing a request ID
with different canonical input returns `idempotency_mismatch`.

Pending claims are safe to resume because every identifier the command depends
on is frozen before any adapter call — caller-supplied ones by definition, and
the allocated Template ID by `template_id` on the claim row and the `reserving`
catalog row — and because every adapter receives a deterministic idempotency
key derived from the request.

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
   user storage scope. Every capability it dispatches to — including Context,
   through instantiation bindings — is likewise project-scoped, so no command
   needs a scope selector.
2. Every live Template record resolves to exactly one `(kind, resourceId)`.
3. In version 1, the backing resource ID equals the Template ID.
4. The Template ID is allocated by Templates, never accepted from a caller, and
   is frozen in the command claim and a `reserving` catalog row before any
   adapter call.
5. A `reserving` record is invisible to `template.get` and `template.list`, and
   blocks a second registration of the same identity.
6. A backing resource is a detached copy, never an alias of the registration
   source, and every Context Variable on it is unbound.
7. An instantiated resource is a detached normal resource, never an alias of
   its template.
8. Instantiation bindings are optional. An unbound variable is legal state on
   any resource; it is refused only when a Prompt tries to produce a concrete
   Context scope from it.
9. Templates never reads or writes resource-owned tables directly.
10. Unsupported kinds fail before a catalog row or destination is created.
11. Exact command retries return the original result; divergent reuse fails.
12. Ordinary resource APIs cannot promote, demote, or delete a registered
    template behind the Templates catalog.
13. Deleting a template does not mutate its source or prior instances.
14. Templates performs no Context read or write. It imports the `ContextEntry`
    type only; bindings travel through as opaque pairs and are interpreted by
    the owning resource kind.

## Deferred

- cross-project, user-level, organization-level, or public templates;
- template versions or instance pinning to a named template version;
- categories, thumbnails, search ranking, favorites, or marketplace metadata;
- live linkage or propagation from a template into existing instances;
- arbitrary parameter-schema infrastructure beyond Context Variable bindings
  and an optional title;
- caller-chosen Template IDs;
- batch instantiation; and
- Context composition performed on a caller's behalf during instantiation.
  Grouping several resources into one binding target is a caller's single
  `POST /contexts/union` call before instantiation, not a Templates concern.

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
