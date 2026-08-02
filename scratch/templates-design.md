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
its Context Variables**. Registration keeps the resource's structure and records
default bindings for its variables; instantiation overrides those defaults, or
leaves them to be filled in later.

The first version is deliberately narrow:

- project scope only;
- register a resource as a template;
- list and get registered templates;
- instantiate a template as a normal resource; and
- delete a template through its owning resource kind.

Cross-project sharing, template marketplaces, permissions, categories,
version pinning, arbitrary template parameters, and resource quotas are
deferred.

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
deletes a Context record. Instantiation bindings may *reference* a Context, but
only as an opaque `(kind, id)` pair that the owning resource adapter
interprets — see the
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

  /**
   * Catalog label. Required, trimmed, and unique per kind among live records.
   * This is what "rename the template" renames — the backing resource's title
   * is sealed and unreachable, so the catalog cannot borrow it.
   */
  readonly name: string;

  /** Optional catalog annotation: what this template is for. */
  readonly description?: string;

  /**
   * The template's declared parameters. What a caller declares at registration
   * is what this template exposes; anything undeclared is baked-in content.
   */
  readonly contextBindings: TemplateContextBindings;

  readonly createdAt: string;
  readonly updatedAt: string;
}
```

`state` and `deletedAt` exist in storage but are not part of this record. They
are reservation and filtering mechanics, and any record a caller can retrieve is
by definition ready and live, so they live on a store-internal
`StoredTemplateRecord` instead.

**`contextBindings` is constitutive, not descriptive.** A template is a resource
as a function of its Context Variables; the declared bindings are that
function's parameter list, so they are a defining part of what the record *is*.
Two templates over the same Document declaring different parameters are
different templates. `template.get` returns them because a caller cannot use a
template without knowing its parameters — and because the declaration exists
nowhere else to be read from.

Because the record and the backing resource now each hold something real, no
more than one path may change either: see
[Editing and deletion](#editing-and-deletion).

**Templates allocates the Template ID and returns it.** A caller registering a
template is pointing at a resource it already owns and asking for a catalog
entry it has never seen; it has no basis on which to name that entry. So
`template.register` takes no ID, and the allocated `TemplateRecord` is the
command's result.

### Which identifiers a caller supplies

There is no single rule for this across the backend. Three conventions coexist,
and which one applies depends on who is naming what:

| Convention | Capabilities | Retry safety comes from |
|---|---|---|
| Caller-supplied | Document's *internal structural* IDs only (`blockId` and friends) | Request receipts keyed by `(resourceId, requestId)` |
| Allocated internally | Document, Context, Derived Outputs, Structured Data, Comments, Investigation, Persona, Templates | A caller-supplied idempotency key or request ID |
| Derived from content | General Files (`sha256(content)`), Connector (`sha256(providerKind::locator)`), Activity (`act_<sha256(idempotencyKey)>`) | Identity is a pure function of the input |

Updated 2026-08-02: `document.create` now allocates its own ID, and Slide has
been deleted. Aggregate IDs are allocated everywhere; only Document's structural
IDs inside an operation batch remain caller-supplied, and that is an open
question in [`0-general-updates.md`](0-general-updates.md) item 2.

Templates follows the **second** convention, and Derived Outputs is the direct
precedent: it allocates its own output ID inside `declare()` and takes a
caller-supplied `idempotencyKey` purely so a retry can be recognised. Templates
does the same thing with `requestId`.

The caller still supplies every identifier it is genuinely the author of — the
registration `source`, and the `destinationResourceId` for an instance, which
follows the first convention exactly as `document.create` does. What it does
not supply is the catalog identity, because the catalog is Templates' own
concept and the caller has never seen it.

In version 1, `resourceId === id`: Templates allocates one identifier and hands
it down to the adapter as the ID for the backing copy, exactly as a caller
hands `documentId` to `document.create`. The explicit `resourceId` remains in
the record because the catalog reference is always the pair
`(kind, resourceId)`, and future resource kinds should not have to infer an
address from a Template record's storage key.

Allocating rather than accepting the ID does not weaken exact replay. The
identifier is minted once and **frozen in the command claim before any adapter
call**, so an exact retry and a resumed pending claim both reuse it. This is
the same problem shape as freezing a target before an external call generally
— resolving the address fresh on retry would risk pointing at a different
target if it could change in between — but Templates' own `TemplateCommandClaim`
is a Templates-only mechanism; freezing an *allocated* resource ID here is a
different case from freezing a *reference to something that already exists*,
which is why the two are solved independently rather than shared.

Templates does not own a second display name. A resource adapter may return a
resource summary for presentation, but the catalog does not duplicate that
mutable metadata. For a Document template, the backing Document's title is
editable and can be used as the library label. An instantiated Document still
receives its own destination title.

`description` is not an exception to that rule, because it is not a copy of
anything. The backing resource has no field it duplicates: it answers "what is
this template for, and when should I reach for it?", which is a statement about
the catalog entry rather than about the resource. It is supplied at
registration and edited through `template.update`, alongside the declared
bindings.

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

interface TemplateContextBinding {
  /** Omitted means "explicitly unbound", not "leave alone". */
  readonly entry?: ContextEntry;

  /** Optional note: what this variable is for, shown to whoever instantiates. */
  readonly description?: string;
}

/** Variable name -> binding. Names are the user-facing labels, not stable IDs.
 *  Normalised to {} when absent; an empty record and an omitted field mean the
 *  same thing. A variable that is not a key here is left exactly as it is. */
type TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>;

interface TemplateInstantiationInput {
  /** Omitted means the instance keeps the backing template's title. */
  readonly title?: string;

  readonly contextBindings: TemplateContextBindings;
}

interface TemplateResourceAdapter {
  readonly kind: string;

  createTemplateCopy(input: {
    sourceResourceId: string;
    templateId: string;
    /** Defaults recorded on the template, applied over the copied source. */
    contextBindings: TemplateContextBindings;
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

**A binding is a pair, not a bare reference.** Each entry carries the target
*and* an optional description of what the variable is for. A template is only
useful if the person instantiating it can tell what `Main topic` is supposed to
mean, and that explanation belongs beside the default rather than in prose
somewhere else. The description is template documentation, not resource
content: it is never copied into the instantiated resource's own state.

`entry` is optional inside the pair so a template can declare a documented
variable with no default at all.

**Bindings are normalised, not optional.** `contextBindings` may be omitted on
the wire, but the domain always sees a record — an absent field and `{}` mean
exactly the same thing, so no code branches on `undefined`. This follows the
codebase's habit of normalising at the edge rather than threading optionality
inward.

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
  readonly origin: TemplateOrigin;
  readonly command: TemplateCommand;
}

type TemplateOrigin = "user" | "agent" | "automation" | "system";

type TemplateCommand =
  | {
      type: "template.register";
      /** No templateId: Templates allocates it and returns it. */
      source: TemplateResourceRef;
      description?: string;
      /** Defaults recorded on the template. */
      contextBindings?: TemplateContextBindings;
    }
  | {
      type: "template.instantiate";
      templateId: string;
      destinationResourceId: string;
      title?: string;
      /** Overrides applied over the template's defaults. */
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
  | { type: "template.get"; templateId: string }    // the catalog record
  | { type: "template.list"; kind?: string }
  | { type: "template.load"; templateId: string };  // the backing content
```

`template.get` and `template.load` are separate on purpose. `get` is a single
store read and answers "what is this template"; `load` goes through the adapter
to the sealed backing resource and answers "what is in it". A picker lists
records and should not pay for content.

`template.load` exists because registration seals the backing resource's own
read surface as well as its writes — see
[Editing and deletion](#editing-and-deletion). Its `content` is `unknown` at the
Templates boundary: a Document snapshot for kind `document`, something else for
a later kind. Templates has no per-kind types and must not grow any, exactly as
with the content edits going the other way. The caller knows the `kind` from the
record.

This is the one place the adapter port does **not** return `void`. That rule
bought a real property — a call that returns nothing has nothing to disagree
with, so there is no resource-mismatch error to write — and it now holds for the
mutating methods only.

`template.list` returns live records ordered by creation time and ID and does
not expose a pagination contract. Pagination and any catalog-size limit are
deferred; a future size limit belongs in a global resource-quota policy, not a
Templates-specific configuration key.

The public surface uses the repository's two static paths:

| Method | Path | Queue | Purpose |
|---|---|---|---|
| `POST` | `/templates/command` | serial | Register, instantiate, or delete with exact replay. |
| `POST` | `/templates/query` | concurrent | Get or list catalog records. |

There is no public command for setting `kind`, `resourceId`, or template mode
on an existing resource. Registration always creates a copy.

The command endpoint is serial because it mutates and the service
reads-then-writes across several store calls that no single statement makes
atomic:

- claim-then-execute has the same shape — two concurrent retries of one
  `requestId` would both observe a pending claim and both drive the adapter.

This is the same reason Document and Slide commands are serial. An earlier
draft of the implementation plan argued for `concurrent` on the grounds that
every Templates invariant was a single-row store invariant. That was wrong:
claim-then-execute crosses store and adapter work, so concurrent retries could
drive the adapter twice.

## Registration flow

```text
template.register(source kind + resourceId, description?, contextBindings?)
  1. Claim requestId and its canonical command digest.
  2. Resolve the injected adapter for source.kind; unknown kind fails here.
  3. Allocate templateId and reserve the catalog row for it.
  4. Ask the adapter to copy the frozen source as templateId in template mode,
     applying the supplied bindings as the template's defaults.
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

### Registration sets defaults; it does not clear anything

A backing template copies its source's Context Variables as they are, and then
applies whatever `contextBindings` the registration supplied on top. There is
no clearing pass.

An earlier draft had registration wipe every variable target, on the theory
that a template must start blank to be a function of its variables. That was
solving a problem the binding record already solves, at the cost of a
destructive step and of making a perfectly reasonable case — "this template
should default to the Cars context unless told otherwise" — impossible to
express. Once registration accepts bindings, the registrar decides:

| Registration binding for a variable | Result on the template |
|---|---|
| Not a key in the record | Keeps whatever the source had |
| Key present with `entry` | That target becomes the template's default |
| Key present, `entry` omitted | Explicitly unbound |

The third row is what replaces the old blanket clear, and it is deliberate
rather than automatic. A registrar who wants the blank-template behaviour names
the variables and omits their entries; a registrar who wants sensible defaults
sets them; a registrar who supplies nothing gets a faithful copy.

Instantiation then works the same way over the template's defaults, so the
whole feature is one override rule applied twice rather than a clear-then-fill
sequence. Nothing has to be undone, and a resource is never mutated into a
state its author did not ask for.

Registration **records the declared bindings on the Template record**, and the
adapter applies the table above to the backing copy's variable state.

The record is the primary of those two, not a copy of the second. A template is
a resource as a function of its Context Variables, and the declared bindings are
that function's parameter list — they are a defining part of the template's
identity, not metadata about it. Two templates over the same Document declaring
different parameters are different templates. The resource's variable state
cannot express this: it holds what each variable currently points at, but it
cannot say which variables the template means to expose, and it has nowhere to
put a parameter's `description`.

Direct, literally-authored references are untouched at both steps — only
variables participate. A template author who wants a reference to survive every
instantiation authors it directly instead of through a variable.

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

### Bindings override defaults, and every part is optional

Instantiation applies exactly the same override rule as registration, this time
over the template's recorded defaults:

| Instantiation binding for a variable | Result on the instance |
|---|---|
| Not a key in the record | Keeps the template's default, bound or not |
| Key present with `entry` | That target overrides the default |
| Key present, `entry` omitted | Explicitly unbound on the instance |

So `contextBindings` may be omitted, empty, or partial, and the common flows all
work without special cases: instantiate a fully-defaulted template with no
input at all; override one variable; or start something deliberately blank.

A variable left unbound stays unbound on the instance, and the owning resource
capability can bind it later through its ordinary editing surface. This matters
because instantiation is not the only moment a user can decide what a template
points at — requiring a complete binding set would force a caller to resolve
every reference up front, when the natural flow is often to create the instance
and then fill it in. Unbound variables are therefore legal state on any
resource, and are refused only where they would actually cause harm: at the
point a Prompt tries to produce a concrete Context scope. That admission check
is described in the addendum.

A binding's `description` is template documentation and is not carried into the
instance; only the resolved target is.

`title` is likewise optional; an instance keeps the backing template's title
when none is supplied, and can be renamed afterwards.

Templates does not store an instance list. The new resource belongs entirely
to its owning capability, whose normal list/query surface discovers it. Exact
replay of the Templates command returns the same destination resource.

## Editing and deletion

**Every change to a registered template goes through Templates.** A backing
template is not opened and edited through its owning resource capability, even
though `TemplateRecord.resourceId` names it and the resource capability could
serve the request.

`template.update` is the single editing path. One command carries both halves:

- the **catalog half** — `description` and `contextBindings` replace their
  predecessors wholesale, under compare-and-swap on `expectedRevision`;
- the **resource half** — content edits are forwarded to the resource adapter,
  which applies them through the owning capability's internal command path.

They are one command because they are one fact. An earlier draft let the
resource be edited directly and kept the declaration only in the resource's
variable state, precisely so the two could not disagree. Once the declaration
lives on the record — and it has to, for the catalog to be usable — that
argument inverts: two writable statements about the same template will drift
unless one command owns both. Renaming a variable through the Document endpoints
would otherwise leave the catalog advertising a parameter that no longer exists,
and nothing would ever notice.

So registration **seals** the backing resource. The moment the copy exists, the
owning capability's whole public surface is refused for that resource —
**reads included**, not a chosen subset — checked on the resource rather than
enumerated per command, so a command or query added later is sealed by default.
The refusal is one typed error naming Templates as the only way in. Template-mode
resources also stay out of the capability's ordinary resource list, and nothing
can move a resource between template and normal mode.

Reading a template therefore crosses the Templates boundary, through
`template.load`. The one thing the owning capability still answers is a
*listing* of its templates — a cross-resource question over its own storage,
handing back identifying metadata rather than content. Listing stays; reading
moves.

The backing resource is not something a user owns any more. It exists for one
reason: so instantiation has something to copy.

**Nothing renames it, from either side.** The owning capability cannot — the
surface is sealed. Templates does not offer it either: `template.update` edits
the *template*, and the backing resource's title is not part of the template's
addressable state. It keeps the title it was copied with, which is what an
instance inherits when instantiation supplies no `title`. Renaming means
renaming the template record.

Only `template.delete` may remove a backing template. The Templates service
first claims the command, asks the resource adapter to delete or tombstone the
backing copy, and then soft-deletes the catalog record. The original resource
and already-created instances are untouched.

Instances are unaffected by a template edit. Instantiation copies; there is no
propagation, by design.

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
  description TEXT,
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

**Templates stores the declared bindings.** `context_bindings_json BLOB NOT
NULL` on the catalog row, following the `mentions_json` precedent in
`comments/persistence/sqliteSchema.ts`. An omitted wire field and `{}` mean the
same thing, so the column is never null.

The row and the resource hold two different things. The record holds the
**declaration** — which variables are parameters, and each one's `description`.
The backing resource holds the **applied targets**, written by the adapter
during the copy. Neither is derivable from the other, and the declaration exists
nowhere else. They cannot drift because `template.update` is the only path that
changes either, and it writes both.

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
outbox and publishes them through the injected Activity publisher. Each
committed transaction carries the required command origin (`user`, `agent`,
`automation`, or `system`) unchanged:

- `template.registered` for a new catalog/backing template;
- `template.updated` for an accepted edit to a registered template;
- `template.deleted` for removal.

The vocabulary here is **transaction**, matching Activity and the Comments
producer (`CommentCommittedTransaction`, `source_transaction_id`,
`transaction_outbox`). Templates and Document still say "fact" in code; that is
a rename to make, not a second concept.

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
    domain/canonical.ts
    domain/errors.ts
    domain/model.ts
    persistence/sqliteMappers.ts
    persistence/sqliteSchema.ts
    persistence/sqliteTemplateStore.ts
    ports/activityPublisher.ts
    ports/resourceAdapter.ts
    ports/templateStore.ts
    wire/commandSchemas.ts
    wire/querySchemas.ts
    wire/valueSchemas.ts
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
   source. Its Context Variables are the source's, with the registration
   bindings applied as defaults.
7. An instantiated resource is a detached normal resource, never an alias of
   its template.
8. Bindings are optional at both registration and instantiation, and apply the
   same override rule: absent key inherits, present key with `entry` sets,
   present key without `entry` explicitly unbinds.
9. An unbound variable is legal state on any resource; it is refused only when
   a Prompt tries to produce a concrete Context scope from it.
10. The declared bindings are persisted on the Template record and returned by
    `template.get` and `template.list`. They are the template's parameter list
    and part of its identity. The backing resource separately holds each
    variable's applied target; neither side is derivable from the other.
11. `template.update` is the only path that changes a registered template —
    catalog declaration and backing content in one command — so the two cannot
    drift.
12. Templates never reads or writes resource-owned tables directly.
13. Unsupported kinds fail before a catalog row or destination is created.
14. Exact command retries return the original result; divergent reuse fails.
    Origin is not part of the canonical command digest, so it never turns an
    otherwise exact retry into a mismatch.
15. Ordinary resource APIs cannot promote, demote, or delete a registered
    template behind the Templates catalog.
16. Deleting a template does not mutate its source or prior instances.
17. Templates performs no Context read or write. It imports the `ContextEntry`
    type only; a binding target is an opaque pair, interpreted by the owning
    resource kind.

## Deferred

- cross-project, user-level, organization-level, or public templates;
- template versions or instance pinning to a named template version;
- categories, thumbnails, search ranking, favorites, or marketplace metadata;
- live linkage or propagation from a template into existing instances;
- arbitrary parameter-schema infrastructure beyond Context Variable bindings
  and an optional title;
- caller-chosen Template IDs;
- a global resource quota, including any catalog-size limit;
- batch instantiation; and
- Context composition performed on a caller's behalf during instantiation.
  Grouping several resources into one binding target is a caller's single
  `POST /contexts/union` call before instantiation, not a Templates concern.

## Implementation order

1. Add the project-scoped Templates model, SQLite store, ID allocation with
   `reserving → ready` reservation, command claims, and get/list queries.
2. Add the adapter registry and strict command/query wiring, including the
   typed `TemplateInstantiationInput` decoder.
3. Implement the Document template adapter and Document-mode persistence from
   the companion addendum, including the binding override rule at both
   registration and instantiation.
4. Wire registration, instantiation, deletion, startup recovery, and Activity
   outbox publication.
5. Add focused tests for detached copies, allocated-and-returned Template IDs,
   `resourceId === templateId`, reservation collision before any adapter call,
   exact retry, divergent retry, unsupported kind, missing backing resource,
   omitted/partial bindings, and deletion isolation.

Steps 1, 2, 4, and the adapter-independent half of 5 are planned in detail in
[`templates-implementation-plan.md`](templates-implementation-plan.md). Step 3
is a separate, larger workstream.
