# Templates types

All types live in [`domain/model.ts`](../domain/model.ts) unless noted.

## Record

```ts
interface TemplateRecord {
  readonly id: string;            // allocated by Templates
  readonly kind: string;
  readonly resourceId: string;    // allocated by the owning capability — never `id`
  readonly name: string;          // catalog label, unique per kind among live records
  readonly description?: string;  // catalog annotation
  readonly contextBindings: TemplateContextBindings;  // the declared parameters
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Only ever a *result* shape — nothing on the wire names a resource this way. */
interface TemplateResourceRef {
  readonly kind: string;
  readonly resourceId: string;
}
```

There is no `state`. A row exists only once its backing copy does, so every row
is a usable template; the old `reserving`/`ready` pair existed to hold an
identity across an external call that now happens first.

`resourceId` is whatever `duplicate` returned. It is not the Template ID and is
not required to resemble it — see [concepts](concepts.md) → Identity.

`name` is the template's own label and the only thing a rename touches. The
backing copy's title is sealed with the copy, so the catalog cannot borrow it as
the thing a user renames. Nor could Templates read it: `load` returns content as
`unknown`, and Templates grows no per-kind types with which to find a title
inside it. So `name` is required at registration — there is no default available.

`description` is not a copy of anything the backing copy holds either. It answers
"what is this template for", which is a statement about the catalog entry.

`contextBindings` is the template's declared parameter list, and part of what
identifies the template — see [concepts](concepts.md) → Bindings. It is stored
here because this is the only place it exists.

## Bindings

```ts
interface TemplateContextBinding {
  readonly target?: ContextEntry;  // omitted means "explicitly unbind"
  readonly description?: string;   // declaration only; registration accepts it,
                                   // instantiation rejects it
}

type TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>;
```

`contextBindings` is optional on the wire and required in the domain: the decoder
normalises an absent field to `{}` so nothing downstream branches on `undefined`.

There are **two** binding decoders, and the split is deliberate. Registration
*declares* a parameter, so `decodeDeclaredBindings` accepts
`["target", "description"]` with both optional. Instantiation *supplies an
argument*, so `decodeBindingArguments` accepts `["target"]` only and **requires**
it.

Both restrictions are refusals rather than silent drops. A `description` at
instantiation is a 400 because silently ignoring an accepted field is the class
of bug the split exists to remove. An omitted `target` is a 400 because at
registration it means "a parameter with no default", while here it would leave
the instance holding an unbound variable — the same shape meaning two different
things, one of which is not allowed.

`ContextEntry` is `{ id, kind }`, re-exported as a type only. `kind` is
load-bearing downstream: a binding may target a Context or a directly usable
resource, and the owning capability routes on it.

## Commands and queries

```ts
interface TemplateCommandRequest {
  readonly requestId: string;
  readonly origin: TemplateOrigin;
  readonly command: TemplateCommand;
}

type TemplateOrigin = "user" | "agent" | "automation" | "system";

type TemplateCommand =
  | { type: "template.register";
      kind: string;                        // selects the runtime
      resourceId: string;                  // addresses one of its resources
      name: string;                        // required — see the Record section
      description?: string;
      contextBindings: TemplateContextBindings }
  | { type: "template.update";
      templateId: string;
      expectedRevision: number;
      name?: string;                       // each optional field means
      description?: string;                // "leave alone" when absent, and
      contextBindings?: TemplateContextBindings;   // replaces wholesale when present
      resourceOperations?: unknown }       // content edits, opaque here
  | { type: "template.instantiate";
      templateId: string;                  // no destination: the resource allocates it
      name?: string;                       // the INSTANCE's name — see below
      contextBindings: TemplateContextBindings }   // exactly the declared keys,
                                                   // each with a target
  | { type: "template.delete"; templateId: string }
  | { type: "template.purge"; templateId: string };

type TemplateCommandResult =
  | { type: "template.registered"; template: TemplateRecord }
  | { type: "template.updated"; template: TemplateRecord }
  | { type: "template.instantiated"; template: TemplateRecord; resource: TemplateResourceRef }
  | { type: "template.deleted"; templateId: string; revision: number }
  | { type: "template.purged"; templateId: string };

interface TemplateListFilter {
  readonly kinds?: readonly string[];   // any-of; `[]` matches nothing
  readonly search?: string;             // case-insensitive substring, name + description
  readonly limit?: number;
  readonly cursor?: string;             // opaque; only a previous `nextCursor`
}

type TemplateQuery =
  | { type: "template.get"; templateId: string }          // the catalog record
  | ({ type: "template.list" } & TemplateListFilter)
  | { type: "template.load"; templateId: string };        // the backing content

type TemplateQueryResult =
  | { type: "template.record"; template: TemplateRecord }
  | { type: "template.records"; templates: readonly TemplateRecord[]; nextCursor?: string }
  | { type: "template.content"; template: TemplateRecord; content: unknown };
```

`template.register` names its source flat rather than as a nested ref: `kind`
selects the runtime and `resourceId` addresses one of its resources, which are
two different jobs. Nesting them implied a shared identity they never had.

`template.update` is the only path that changes a registered template. It carries
both halves — the catalog declaration and the resource's own state — in one
command, so the two statements about a template cannot diverge.
`expectedRevision` is a compare-and-swap and the only one in this capability:
everything else either creates or removes.

`template.instantiate` names no destination, because the owning capability
allocates the instance's ID and hands it back. Its `contextBindings` must be
exactly the declared parameter set, **each with a `target`** — see
[concepts](concepts.md).

Its `name` is the **instance's**, not the template's. Three names meet here and
none of them is the other: the Template record's `name` is the catalog label, the
sealed backing copy's title is inherited from the registration source and
unreachable, and this one is what the new resource is called. Omitting it
inherits the backing copy's title, the only default available.

`template.list` is the **only** template listing in the system, so it is shaped
as a picker: filter by kind, type-ahead over name and description, paginate.

`template.get` and `template.load` are separate so a picker listing a catalog
stays a single store read. `load` exists at all because registration seals the
owning capability's own read surface.

## Ports

`TemplateStore` ([`ports/templateStore.ts`](../ports/templateStore.ts)) is
synchronous because SQLite is. Beyond ordinary reads it carries the receipt pair
— `getReceipt`, `recordReceipt` — and the write set: `create`, `nameTaken`,
`update`, `delete`, plus retained-history purge and retention operations.

`create`, `update`, and `delete` each take a commit struct carrying **the
receipt** alongside the change and its Activity transaction, so all of it lands
in one SQLite transaction. That is not tidiness. A catalog row committed without
its receipt would make a retry re-run the whole command and then collide with the
name it wrote itself a moment earlier — reporting a conflict against the caller
for the store's own half-finished write.

`recordReceipt` is `INSERT OR IGNORE`, because the service also writes it through
a generic path after every command. First write wins.

`update` additionally archives the record being replaced into history at its old
revision. That is not optional bookkeeping — every other revision transition here
leaves a history record, and an update that skipped it would make
`latestSnapshot` report pre-update state as though it were current.

`nameTaken` exists so a collision is refused *before* any resource call. The
unique index remains the authority, but it cannot report until the row is written
and the row is now written last.

`TemplatableResource`
([`ports/templatableResource.ts`](../ports/templatableResource.ts)) is satisfied
structurally by a capability's own runtime — there is no adapter object.
`TemplatableResourceRegistry` exposes only `get(kind)`.

`TemplateActivityPublisher`
([`ports/activityPublisher.ts`](../ports/activityPublisher.ts)) has a single
`publish(transaction)`.

## Source transactions

```ts
type TemplateTransactionKind =
  | "template.registered"
  | "template.updated"
  | "template.deleted";

interface TemplateCommittedTransaction {
  readonly sourceTransactionId: string;
  readonly kind: TemplateTransactionKind;
  readonly templateId: string;
  readonly resourceKind: string;
  readonly resourceId: string;
  readonly actorId?: string;
  readonly origin: TemplateOrigin;
  readonly occurredAt: string;
}
```

`origin` is required on the command envelope rather than on the command itself.
It is deliberately excluded from the command digest, so an exact retry from a
different origin replays rather than conflicts. Source transactions persist the
origin that committed the catalog change and pass it directly to Activity.

## Errors

One class per distinguishable failure, in
[`domain/errors.ts`](../domain/errors.ts):

| Error | HTTP |
|---|---|
| `TemplateNotFoundError` | 404 `not_found` |
| `TemplateAlreadyExistsError` | 409 `already_exists` |
| `TemplateNameConflictError` | 409 `name_conflict` |
| `StaleTemplateRevisionError` | 409 `revision_conflict` |
| `TemplateIdempotencyMismatchError` | 409 `idempotency_mismatch` |
| `TemplateBindingMismatchError` | 400 `binding_mismatch` |
| `InvalidTemplateCursorError` | 400 `invalid_cursor` |
| `TemplateUnsupportedKindError` | 400 `unsupported_kind` |
| `TemplateWireError` | 400 `validation_error` |

The three 409s stay distinct because a caller does something different with each:
a revision conflict is retried after re-reading, a name conflict needs a
different name, and an idempotency mismatch means the request ID was reused for
different content.

`TemplateBindingMismatchError` carries `missing` and `unexpected` as arrays, not
only in its message. A client fixing the call needs the names, and parsing them
back out of prose is not an interface.

`InvalidTemplateCursorError` is separate from `TemplateWireError` because the fix
differs: restart the listing rather than correct the request's shape. The wire
layer only checks a cursor is a plausibly-sized string; whether it is a cursor
*this store issued* is the store's question, and its answer is keyed on a `kind`
tag so a cursor from another capability's listing fails loudly instead of
decoding into a plausible-looking position.

`TemplateNameConflictError` carries `templateName`, not `name` — a parameter
property called `name` would be clobbered by the `this.name` assignment every
error class here makes, silently losing the value a caller needs.

There is deliberately no resource-mismatch error. `duplicate` returns an ID and
`load` returns content, but Templates records the first and passes the second
straight through; neither is checked against an expectation, because Templates
never had one.
