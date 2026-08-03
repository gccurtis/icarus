# Templates Capability — Design

## Intent

Templates is a small, regular, project-scoped capability that keeps one
catalog of reusable resource templates. A template is not a second generic
content format. It is a reference to a template-mode resource owned by another
kind, such as Document.

Registering a template makes a detached copy of an existing resource by driving
that resource kind's own runtime, then seals the copy and returns the new
Template's ID. Using a template makes another detached copy, this time as a
normal resource. The source, the backing template, and every instance can be
edited independently.

The organising idea is that **a template turns a resource into a function of
its Context Variables**. Registration keeps the resource's structure and records
which of its variables are parameters; instantiation supplies arguments for
exactly those parameters.

The first version is deliberately narrow:

- project scope only;
- register a resource as a template;
- get, search, and paginate registered templates;
- update a registered template — the only path that changes one;
- instantiate a template as a normal resource; and
- delete and purge a template through its owning resource kind.

Cross-project sharing, template marketplaces, permissions, categories,
version pinning, arbitrary template parameters, and resource quotas are
deferred.

## Ownership boundary

Templates owns:

- which backing resources are registered as templates;
- allocation of the stable Template ID, and the resource kind;
- the whole registration and instantiation **procedure** — copy, seal, bind;
- exact command replay, by receipt; and
- the only template listing in the system.

Templates does not own:

- resource content, revision history, internal IDs, names, or validation;
- **resource IDs** — the capability that stores a resource allocates its ID;
- how a Document, Slide, Spreadsheet, or other resource is copied;
- Context records or Context resolution;
- Derived Outputs referenced by another resource; or
- copies already instantiated from a template.

The resource capability owns the `isTemplate`/resource-mode flag and copy
mechanics. Templates never reads or writes another capability's tables directly.

The resource is **driven, not consulted**: it neither knows nor decides that it
is becoming a template. `duplicate` is a pure copy a capability could offer for
its own reasons, and sealing is a separate instruction Templates gives after it.

Context in particular is untouched. Templates has no Context runtime dependency,
declares no Context port, and never creates, mutates, resolves, or deletes a
Context record. Bindings may *reference* a Context, but only as an opaque
`(kind, id)` pair that the owning capability interprets — see
[`document-changes-design.md`](document-changes-design.md). Because Context is
project-scoped only, with no user scope and no project-then-user fallback, such a
reference resolves identically for every instantiation in the project, and no
Templates command carries a scope selector.

```text
Templates catalog
  Template { id, kind, resourceId }
                       |
                       +-- kind's runtime --> the sealed backing copy
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

**The rule, stated once: the capability that stores a thing allocates its ID.**
Templates allocates the Template ID because it stores the catalog row. The owning
capability allocates the backing copy's ID because it stores the copy, and hands
it back from `duplicate`. So `resourceId !== id`, always.

An earlier version had them equal, enforced by `CHECK (resource_id = id)`. That
only held because Templates was passing its own ID down as the destination — the
constraint made a coincidence look like a rule. Removing it is what let the
catalog row be written *after* the copy exists, which in turn is what removed the
reservation, its two states, and its promote/release pair.

The caller supplies exactly one identifier: the source it already owns, as flat
`kind` + `resourceId` on `template.register`. It names no destination anywhere —
not for the backing copy, not for an instance.

Allocating rather than accepting the ID does not weaken exact replay, but the
mechanism changed with the rule. There is no longer an identifier to freeze
across an external call, because nothing durable is written before that call.
Replay rests entirely on the receipt and on the deterministic idempotency key the
resource receives.

Templates does not own a second display name for the *resource*. The record's
`name` is the catalog's own label — see below — and the backing copy's title is
sealed with the copy and unreachable from either side. An instance receives its
own `name`, supplied at instantiation and applied by `duplicate`.

`description` is not an exception to that rule, because it is not a copy of
anything. The backing resource has no field it duplicates: it answers "what is
this template for, and when should I reach for it?", which is a statement about
the catalog entry rather than about the resource. It is supplied at
registration and edited through `template.update`, alongside the declared
bindings.

A Template has no independent content revision. The backing resource's
revision is authoritative. Editing the backing resource does not create a new
Template record or change its ID.

## Resource runtime registry

Templates is generic because startup registers one **runtime object per kind**.
There is no adapter to write:

```ts
templateResources.register(document);   // Document's own runtime, no wrapper
```

```ts
interface TemplatableResource {
  readonly kind: string;

  /** Pure copy: new ID, same content. No template awareness, no bindings. */
  duplicate(input: {
    sourceResourceId: string;
    /** What to call the copy. Omitted keeps the source's own name. */
    name?: string;
    idempotencyKey: string;
  }): Promise<{ resourceId: string }>;

  /** Seals it: private, unreachable through its own endpoints. One-way. */
  markAsTemplate(input: { resourceId: string }): Promise<void>;

  /** Binds the resource's own variables, in Templates' vocabulary. */
  applyBindings(input: {
    resourceId: string;
    contextBindings: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<void>;

  /** Pass-through edit. Caller-authored, so opaque here. */
  submit(input: {
    resourceId: string;
    operations: unknown;
    idempotencyKey: string;
  }): Promise<void>;

  /** Pass-through read. */
  load(input: { resourceId: string }): Promise<unknown>;

  logicalDelete(input: { resourceId: string; idempotencyKey: string }): Promise<void>;
  purge(input: { resourceId: string; idempotencyKey: string }): Promise<void>;
}

interface TemplatableResourceRegistry {
  get(kind: string): TemplatableResource | undefined;
}

interface TemplateContextBinding {
  /** Omitted means "explicitly unbound", not "leave alone". */
  readonly target?: ContextEntry;

  /** Optional note: what this variable is for, shown to whoever instantiates. */
  readonly description?: string;
}

/** Variable name -> binding. Names are the user-facing labels, not stable IDs.
 *  Normalised to {} when absent; an empty record and an omitted field mean the
 *  same thing. A variable that is not a key here is left exactly as it is. */
type TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>;

/** Only ever a *result* shape. Nothing on the wire names a resource this way. */
interface TemplateResourceRef {
  readonly kind: string;
  readonly resourceId: string;
}
```

**Templates owns the procedure; the resource is driven, not consulted.** A caller
gives Templates `{ kind, resourceId }` and it takes it from there: duplicate,
seal, bind. The resource never learns it is becoming a template — `duplicate` is
a pure copy a capability could offer for its own reasons, and `markAsTemplate` is
a separate instruction. That separation is what makes registration and
instantiation the same procedure differing by exactly one call.

**Why a port at all, if there is no adapter.** The interface is only the *type of
the value in the registry*. Without it the registry is `Record<string, any>` and
a missing or renamed method surfaces at runtime as *"undefined is not a
function"* inside a serial job instead of at compile time. Typing the registry as
`DocumentCapability` is the other alternative and fails twice: Templates would
import a capability, breaking the cross-capability rule, and it could never hold
a second kind. Same pattern as `ContextManager` satisfying `PersonaContextPort`.

**`duplicate` returns the ID it allocated.** An earlier draft had every method
return `void`, on the grounds that Templates supplied both the `kind` and the
destination ID and so had nothing to validate on the way back. That was correct
*while Templates supplied the destination*. It no longer does: the capability
that stores a resource allocates its ID, so there is something to hand back and
Templates records it. `load` returns content for the unrelated reason that a read
has to return something.

**Bindings cross as bindings, not as operations.** `submit`'s payload is
`unknown` because the *caller* authored it; bindings are different — they arrive
in Templates' own vocabulary, decoded strictly at its wire boundary and stored on
its record. Handing them over unchanged is a pass-through. Turning them into a
resource operation would be a translation requiring exactly the per-kind
knowledge this seam exists to keep out, so `applyBindings` is its own method.

That is also the answer to an older question about whether instantiation input
should be `arguments?: unknown` for each kind to decode privately. It should not.
The thing an instantiation varies is Context Variables, and those are
**resource-level structure**, not a Document peculiarity — the point of a
template is that a resource becomes a function of its variables, whatever kind of
resource it is.

**A binding is a pair, not a bare reference.** Each entry carries the target *and*
an optional description of what the variable is for. A template is only useful if
the person instantiating it can tell what `Main topic` is supposed to mean, and
that explanation belongs beside the default rather than in prose somewhere else.
The description is template documentation, not resource content: it is never
copied into the instantiated resource's own state.

`target` is optional inside the pair so a template can declare a documented
variable with no default at all.

**Bindings are normalised, not optional.** `contextBindings` may be omitted on the
wire, but the domain always sees a record — an absent field and `{}` mean exactly
the same thing, so no code branches on `undefined`.

`ContextEntry` is a type-only import of the `{ id, kind }` atom, matching
Structured Data and Derived Outputs. Templates still has no Context runtime,
port, read, or write.

Adding another kind means one capability satisfying the interface and one
`register` call. It adds no union member, table, or import to the Templates
domain — a kind with no Context Variables simply never receives an
`applyBindings` call.

**Compound kinds.** The registry is keyed by `kind`, so one runtime may register
under several: Slides is expected to appear as `slides::deck` and
`slides::slide`, matching Connector's existing `connector::file::text`
convention. The sub-kind travels inside the kind string, so `template.register`
still takes exactly `{ kind, resourceId }`.

## Commands and queries

A caller supplies only what it can genuinely know: the source it already owns.
Every allocated identifier — the Template ID, the backing copy's ID, an
instance's ID — comes back rather than going in.

```ts
interface TemplateCommandRequest {
  readonly requestId: string;
  readonly origin: TemplateOrigin;
  readonly command: TemplateCommand;
}

type TemplateOrigin = "user" | "agent" | "automation" | "system";

type TemplateCommand =
  | {
      /** Flat, not a nested ref: `kind` picks the runtime, `resourceId`
       *  addresses one of its resources. Two different jobs. */
      type: "template.register";
      kind: string;
      resourceId: string;
      /** Required: Templates cannot read the source's title to default from. */
      name: string;
      description?: string;
      contextBindings: TemplateContextBindings;
    }
  | {
      /** The only path that changes a registered template. */
      type: "template.update";
      templateId: string;
      expectedRevision: number;
      name?: string;
      description?: string;
      contextBindings?: TemplateContextBindings;
      resourceOperations?: unknown;
    }
  | {
      /** No destination: the owning capability allocates the instance's ID. */
      type: "template.instantiate";
      templateId: string;
      /** The INSTANCE's name — not the template's. */
      name?: string;
      /** Exactly the declared parameter set — no more, no fewer. */
      contextBindings: TemplateContextBindings;
    }
  | { type: "template.delete"; templateId: string }
  | { type: "template.purge"; templateId: string };

type TemplateCommandResult =
  | { type: "template.registered"; template: TemplateRecord }
  | { type: "template.updated"; template: TemplateRecord }
  | {
      type: "template.instantiated";
      template: TemplateRecord;
      resource: TemplateResourceRef;
    }
  | { type: "template.deleted"; templateId: string; revision: number }
  | { type: "template.purged"; templateId: string };

type TemplateQuery =
  | { type: "template.get"; templateId: string }    // the catalog record
  | { type: "template.list";                        // the only template listing
      kinds?: string[]; search?: string; limit?: number; cursor?: string }
  | { type: "template.load"; templateId: string };  // the backing content
```

`template.get` and `template.load` are separate on purpose. `get` is a single
store read and answers "what is this template"; `load` goes through the runtime
to the sealed backing copy and answers "what is in it". A picker lists records
and should not pay for content.

`template.load` exists because registration seals the backing copy's own read
surface as well as its writes — see
[Editing and deletion](#editing-and-deletion). Its `content` is `unknown` at the
Templates boundary: a Document snapshot for kind `document`, something else for a
later kind. Templates has no per-kind types and must not grow any. The caller
knows the `kind` from the record.

**`template.list` is the only template listing in the system.** No resource
capability exposes one, because a sealed resource is not something its own
capability answers questions about. That makes this query load-bearing rather
than convenient, so it is shaped as a picker: any-of by kind, case-insensitive
substring over name and description, keyset pagination over `(createdAt, id)`.

Two details that are easy to get wrong and are settled here. A search term's `%`
and `_` are escaped, so searching for `"50%"` finds that text instead of matching
every row. And an explicit `kinds: []` matches **nothing** rather than
everything — a caller that filtered every kind out should see nothing, not the
whole catalog.

The public surface uses the repository's two static paths:

| Method | Path | Queue | Purpose |
|---|---|---|---|
| `POST` | `/templates/command` | serial | Register, update, instantiate, delete, purge. |
| `POST` | `/templates/query` | concurrent | Get, search, or load. |

There is no public command for setting `kind`, `resourceId`, or template mode on
an existing resource. Registration always creates a copy.

The command endpoint is serial because it mutates and the service
reads-then-writes across several store calls that no single statement makes
atomic: the receipt lookup and the resource call are separate steps, so two
concurrent retries of one `requestId` would both find no receipt and both drive
the resource.

This is the same reason Document commands are serial. An earlier draft argued for
`concurrent` on the grounds that every Templates invariant was a single-row store
invariant. That was wrong then and is wrong now, for the same reason.

## Registration flow

```text
template.register(kind, resourceId, name, description?, contextBindings?)
  1. Look up the receipt for requestId; a hit replays, a differing digest is a
     mismatch.
  2. Resolve the runtime for kind; an unknown kind fails here.
  3. Check the name; a collision fails here.
  4. resource.duplicate(...)        -> the ID the resource allocated
  5. resource.markAsTemplate(...)   -> the copy goes private
  6. resource.applyBindings(...)    -> skipped when nothing is declared
  7. Allocate templateId; write the catalog row, the receipt, and the
     template.registered transaction in ONE SQLite transaction.
```

**Nothing durable exists until step 7.** That is the inversion of an earlier
design, which reserved the row first so the Template ID would survive the
external call. Once the resource allocates its own ID and the catalog row is
written afterwards, there is no identity to freeze — and so no `reserving` state,
no promote step, and no release-on-failure step.

Steps 2 and 3 still precede every external call, so a refusal never leaves a
backing copy behind. The name is checked in the service rather than left to the
unique index precisely because the index cannot report until the row is written,
and the row is now written last.

**Step 7's three writes are one transaction, and that is load-bearing.** If the
catalog row committed and the receipt did not, the retry would re-run steps 4–6
(replayed by the resource) and then fail step 3 against the row it wrote itself a
moment earlier — a name conflict reported to the caller for the store's own
half-finished write.

**The accepted cost.** A crash between step 4 and step 7 that is never retried
leaves a sealed backing copy no catalog row points at. It is unreachable rather
than merely hidden: the owning capability refuses sealed resources, and
`template.list` only knows catalog rows. That is a real leak, taken deliberately
in exchange for deleting the reservation machinery, and tracked as
[general-updates AR-1](0-general-updates.md#ar-1--registration-can-leak-an-orphaned-backing-resource).

Registration never turns the original resource into a template. Later changes to
the original do not affect the backing template, and later changes to the backing
template do not affect the original.

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
| Key present with `target` | That target becomes the template's default |
| Key present, `target` omitted | Explicitly unbound |

The third row is what replaces the old blanket clear, and it is deliberate
rather than automatic. A registrar who wants the blank-template behaviour names
the variables and omits their entries; a registrar who wants sensible defaults
sets them; a registrar who supplies nothing gets a faithful copy.

Instantiation then works the same way over the template's defaults, so the
whole feature is one override rule applied twice rather than a clear-then-fill
sequence. Nothing has to be undone, and a resource is never mutated into a
state its author did not ask for.

Registration **records the declared bindings on the Template record**, and
`applyBindings` applies the table above to the backing copy's variable state.

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

The mechanics for Documents are in
[`document-changes-design.md`](document-changes-design.md).

## Instantiation flow

```text
template.instantiate(templateId, name?, contextBindings)
  1. Receipt lookup on requestId.
  2. Load the Template record; resolve the runtime for its kind.
  3. Bindings must name EXACTLY the declared parameters, or the command is
     refused before any external call.
  4. resource.duplicate(...)        -> the instance's allocated ID
  5. resource.applyBindings(...)    -> skipped when nothing is declared
     ...and no markAsTemplate: an instance is an ordinary resource.
  6. Record the receipt; return { template, resource }.
```

The mirror of registration, one call shorter. Instantiation input is decoded
strictly at the wire boundary, like every other command here; there is no
per-kind private decoding step.

Instantiation reads the backing copy at one frozen revision. It never aliases the
template's mutable state. A later template edit affects only later
instantiations.

### Instantiation names exactly the declared parameters

**This reverses an earlier decision, and the reversal is the point.** The earlier
design allowed omitted, empty, or partial bindings, and let a variable stay
unbound on the instance to be filled in later through the owning capability's
ordinary editing surface. That is now refused:

| Instantiation binding | Result |
|---|---|
| Every declared name, each with a `target` | Applied to the instance |
| A declared name missing | `binding_mismatch`, nothing copied |
| A name the template never declared | `binding_mismatch`, nothing copied |
| A declared name with no `target` | 400 at the wire, nothing copied |

**Registration declares; instantiation supplies.** The two halves are not
symmetric, and the asymmetry is the design:

| | Registration | Instantiation |
|---|---|---|
| Which variables are named | The ones being made parameters | **Exactly** the declared set |
| A `target` on each | Optional | **Required** |
| An omitted `target` means | A parameter with no default | Rejected |

A declared `target` is what the **backing copy** holds. That is what makes a
template a working resource in its own right — openable, previewable, and a
sensible default to show whoever is about to instantiate it. Mechanically it also
survives into the instance for a moment, because `duplicate` is verbatim; then
`applyBindings` replaces it with the supplied one.

What it is **not** is a fallback for an argument the instantiator omitted,
because omitting one is refused. That is what makes "no instance ever holds an
unbound variable" true by construction rather than true only when the declaration
happened to have defaults, and it removes the admission check the earlier design
needed at the point a Prompt tried to produce a concrete Context scope: there is
no unresolvable state left to admit.

An undeclared name is refused for the converse reason. Anything the template did
not declare is not a parameter — it is baked-in content, and binding it would
edit the instance rather than configure it.

The cost is real and accepted: a caller must resolve every reference up front
rather than creating the instance and filling it in. The instance is an ordinary
resource afterwards and can be edited normally; what it cannot do is *begin* in a
state its author never described.

A binding's `description` is template documentation and is not carried into the
instance; only the resolved target is.

### Three names meet here, and none of them is the other

`template.instantiate` takes a **`name`**, and it is the *instance's*. An earlier
draft called it `title`, which invited exactly the confusion this heading exists
to prevent:

| Name | Owned by | Changed by |
|---|---|---|
| The Template record's `name` | Templates | `template.update` |
| The sealed backing copy's own title | The resource | **Nothing** — inherited from the registration source and unreachable from either side |
| The instance's name | The resource | Its own capability, after instantiation |

It reaches the resource through `duplicate`, which is the only thing that names a
copy. Omitting it inherits the backing copy's title — the only default available,
since nothing else describes this instance — and the instance can be renamed
afterwards through its own capability.

Templates does not store an instance list. The new resource belongs entirely
to its owning capability, whose normal list/query surface discovers it. Exact
replay of the Templates command returns the same destination resource.

## Editing and deletion

**Every change to a registered template goes through Templates.** A backing
template is not opened and edited through its owning resource capability, even
though `TemplateRecord.resourceId` names it and the resource capability could
serve the request.

`template.update` is the single editing path. One command carries both halves:

- the **catalog half** — `name`, `description`, and `contextBindings` replace
  their predecessors wholesale, under compare-and-swap on `expectedRevision`;
- the **resource half** — changed bindings go to `applyBindings` and content
  edits to `submit`, both driving the owning capability's internal path.

Two resource calls rather than one, because they are two different statements:
one about the template's parameters, one about its content. Bindings go first,
so a content edit referencing a freshly bound variable sees it.

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
`template.load`.

**And so does listing.** An earlier draft kept a per-kind template listing open
in the owning capability, on the grounds that listing hands back identifying
metadata rather than content. That exception is gone: `template.list` is the only
template listing in the system. A capability that refuses every question about a
sealed resource should not answer *"which of your resources are sealed"* either,
and the cross-kind picker has to exist regardless — so the per-kind one was a
second way to ask a question already answered better elsewhere.

The backing resource is not something a user owns any more. It exists for one
reason: so instantiation has something to copy.

**Nothing renames it, from either side.** The owning capability cannot — the
surface is sealed. Templates does not offer it either: `template.update` edits
the *template*, and the backing resource's title is not part of the template's
addressable state. It keeps the title it was copied with, which is what an
instance inherits when instantiation supplies no `title`. Renaming means
renaming the template record.

Only `template.delete` may remove a backing template. The service calls the
resource's `logicalDelete`, then archives the catalog record into history and
removes the live row — deletion is a revision, not a flag. The original resource
and already-created instances are untouched. `template.purge` later drains the
history, calling `purge` on the resource, and works off the archived snapshot,
which is why history has to retain `resourceId`.

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
  id                    TEXT PRIMARY KEY,   -- allocated by Templates
  kind                  TEXT NOT NULL,
  resource_id           TEXT NOT NULL,      -- allocated by the owning capability
  name                  TEXT NOT NULL,
  description           TEXT,
  context_bindings_json BLOB NOT NULL,
  revision              INTEGER NOT NULL CHECK (revision >= 1),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE (kind, resource_id)
);

-- Per kind, so a Document and a Spreadsheet template may share a name. No
-- partial predicate: deletion removes the live row, so a name is freed by
-- construction rather than by a `deleted_at IS NULL` clause.
CREATE UNIQUE INDEX templates_name_nocase ON templates(kind, name COLLATE NOCASE);

CREATE TABLE command_receipts (
  request_id     TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  command_type   TEXT NOT NULL,
  result_json    BLOB NOT NULL,
  created_at     TEXT NOT NULL
);
```

**No `state` column and no `deleted_at`.** Every row is a usable template: the
`reserving`/`ready` pair existed only to hold an allocated identity across an
external call that now happens first, and deletion is a revision in the shared
history table rather than a flag.

**No `CHECK (resource_id = id)`.** The capability that stores a thing allocates
its ID, so these are two different identifiers by rule. The old constraint held
only because Templates was passing its own ID down as the destination, which made
a coincidence look like a rule.

**Receipts, not claims.** Idempotency is: check a receipt, do the work with a
deterministic key, record the receipt. Nothing is written before the work runs,
so a failed command leaves no trace to reconcile and its retry is simply the
command again. What makes that safe is that every call into a resource is keyed
by the request, so the resource replays its own completed attempt rather than
performing a second one.

The consequence is that a failed attempt **starts over** rather than resuming.
That is the trade: the old claim could resume mid-procedure because it carried a
frozen identity, and it cost a pending state, a promote step, a release step, and
a second durable idempotency mechanism alongside the receipt table.

**The receipt commits with the change it records.** `create`, `update`, and
`delete` each write the catalog change, the receipt, and the Activity transaction
in one SQLite transaction. A row committed without its receipt would make a retry
re-run the whole command and then collide with the name it wrote itself.

**Templates stores the declared bindings**, following the `mentions_json`
precedent in `comments/persistence/sqliteSchema.ts`. An omitted wire field and
`{}` mean the same thing, so the column is never null.

The row and the resource hold two different things. The record holds the
**declaration** — which variables are parameters, and each one's `description`.
The resource holds the **applied targets**. Neither is derivable from the other,
and the declaration exists nowhere else. They cannot drift because
`template.update` is the only path that changes either, and it writes both.

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
`transaction_outbox`). Templates already speaks it; Document still says "fact"
in code, which is a rename to make rather than a second concept.

Instantiation already causes the owning resource to publish its normal creation
transaction, so Templates does not publish a second activity item for the same
created resource. Template command retries publish nothing new.

## Construction

Resources are constructed before Templates, then startup registers their runtime
objects into it:

```text
config + logger + Activity
  -> resource capabilities (Document first)
  -> createTemplateResourceRegistry()
  -> Templates store and runtime
  -> templateResources.register(document)
  -> Templates endpoints
```

This direction avoids a constructor cycle: Document does not receive the
Templates runtime. `1-init/create/templates.ts` is the only place that sees both,
which is what keeps the two capabilities from importing each other.

Placement:

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
    ports/templatableResource.ts
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
3. **The capability that stores a thing allocates its ID.** Templates allocates
   the Template ID; the owning capability allocates the backing copy's and
   returns it. They are never equal, and no constraint pretends otherwise.
4. The Template ID is never accepted from a caller, and neither is a
   destination — the wire rejects `templateId` on register and
   `destinationResourceId` on instantiate.
5. Nothing durable is written before the first external call, so there is no
   reservation, no pending state, and no identity to freeze.
6. A backing copy is a detached copy, never an alias of the registration source.
   Its Context Variables are the source's, with the declared bindings applied
   afterwards.
7. An instantiated resource is a detached normal resource, never an alias of its
   template, and is never sealed.
8. Bindings apply one override rule wherever they are applied: absent key
   inherits, present key with `target` sets, present key without `target`
   explicitly unbinds.
9. **Instantiation must name exactly the declared parameters.** A missing one is
   refused rather than defaulted; an undeclared one is refused as content rather
   than configuration. So no instance holds an unbound variable.
10. The declared bindings are persisted on the Template record and returned by
    `template.get` and `template.list`. They are the template's parameter list
    and part of its identity. The resource separately holds each variable's
    applied target; neither side is derivable from the other.
11. `template.update` is the only path that changes a registered template —
    catalog declaration and resource state in one command — so the two cannot
    drift.
12. Templates never reads or writes resource-owned tables directly.
13. Unsupported kinds and name conflicts fail before any external call, so no
    backing copy is created.
14. Exact command retries return the original result; divergent reuse fails.
    Origin is not part of the canonical command digest, so it never turns an
    otherwise exact retry into a mismatch.
15. A catalog change, its receipt, and its Activity transaction commit in one
    SQLite transaction, or none of them do.
16. Ordinary resource APIs cannot promote, demote, or delete a registered
    template behind the Templates catalog.
17. Deleting a template does not mutate its source or prior instances.
18. `template.list` is the only template listing in the system.
19. Templates performs no Context read or write. It imports the `ContextEntry`
    type only; a binding target is an opaque pair, interpreted by the owning
    resource kind.

## Deferred

- cross-project, user-level, organization-level, or public templates;
- template versions or instance pinning to a named template version;
- categories, thumbnails, search *ranking*, favorites, or marketplace metadata —
  `template.list` filters and paginates but does not score;
- live linkage or propagation from a template into existing instances;
- arbitrary parameter-schema infrastructure beyond Context Variable bindings
  and an optional title;
- caller-chosen Template IDs;
- a global resource quota, including any catalog-size limit;
- batch instantiation; and
- Context composition performed on a caller's behalf during instantiation.
  Grouping several resources into one binding target is a caller's single
  `POST /contexts/union` call before instantiation, not a Templates concern.

## Implementation status

**The Templates side is built.** The model, SQLite store, receipts, the runtime
port, all five commands, the search-shaped list, endpoints, and the Activity
outbox are implemented and tested.

**No resource runtime is registered**, so every command that reaches a resource
answers `unsupported_kind` in the current tree. A green test run means Templates
upholds its half of the contract; it does not mean a user can create a template.

The remaining work is Document's — `duplicate`, `markAsTemplate`,
`applyBindings`, `isTemplate` and sealing, Context Variables, and allowing a
Prompt Block to hold `appliedRevision: 0`. That is
[`document-changes-design.md`](document-changes-design.md), and progress across
both sides is tracked in
[`0-templates-checklist.md`](0-templates-checklist.md).
