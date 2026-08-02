# Templates types

All types live in [`domain/model.ts`](../domain/model.ts) unless noted.

## Record

```ts
type TemplateRecordState = "reserving" | "ready";

interface TemplateRecord {
  readonly id: string;            // allocated by Templates
  readonly kind: string;
  readonly resourceId: string;    // equals `id` in version 1
  readonly name: string;          // catalog label, unique per kind among live records
  readonly description?: string;  // catalog annotation
  readonly contextBindings: TemplateContextBindings;  // the declared parameters
  readonly state: TemplateRecordState;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface TemplateResourceRef {
  readonly kind: string;
  readonly resourceId: string;
}
```

`name` is the template's own label and the only thing a rename touches. The
backing resource's title is sealed with the resource (see
[concepts](concepts.md) → Bindings), so the catalog cannot borrow it as the thing
a user renames. Nor could Templates read it: `readTemplateCopy` returns content
as `unknown`, and Templates grows no per-kind types with which to find a title
inside it. So `name` is required at registration — there is no default available.

`description` is not a copy of anything the backing resource holds either. It
answers "what is this template for", which is a statement about the catalog
entry.

`contextBindings` is the template's declared parameter list, and part of what
identifies the template — see [concepts](concepts.md) → Bindings. It is stored
here because this is the only place it exists; the backing resource separately
holds each variable's applied target, which is a different statement, and the
adapter owns that side's resource-specific meaning.

## Bindings

```ts
interface TemplateContextBinding {
  readonly target?: ContextEntry;  // omitted means "explicitly unbind"
  readonly description?: string;   // declaration only; registration accepts it,
                                   // instantiation rejects it
}

type TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>;

interface TemplateInstantiationInput {
  readonly title?: string;
  readonly contextBindings: TemplateContextBindings;   // normalised, never undefined
}
```

`contextBindings` is optional on the wire and required in the domain: the
decoder normalises an absent field to `{}` so nothing downstream branches on
`undefined`.

There are **two** binding decoders, and the split is deliberate. Registration
*declares* a parameter, so `decodeDeclaredBindings` accepts
`["target", "description"]`. Instantiation *supplies an argument*, so
`decodeBindingArguments` accepts `["target"]` only — a `description` there is a
400 rather than a silently ignored field, which is the class of bug the split
exists to remove.

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
      source: TemplateResourceRef;         // no templateId: Templates allocates it
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
      templateId: string;
      destinationResourceId: string;
      title?: string;
      contextBindings: TemplateContextBindings }
  | { type: "template.delete"; templateId: string }
  | { type: "template.purge"; templateId: string };

type TemplateCommandResult =
  | { type: "template.registered"; template: TemplateRecord }
  | { type: "template.updated"; template: TemplateRecord }
  | { type: "template.instantiated"; template: TemplateRecord; resource: TemplateResourceRef }
  | { type: "template.deleted"; templateId: string; revision: number }
  | { type: "template.purged"; templateId: string };

type TemplateQuery =
  | { type: "template.get"; templateId: string }     // the catalog record
  | { type: "template.list"; kind?: string }
  | { type: "template.load"; templateId: string };   // the backing content

type TemplateQueryResult =
  | { type: "template.record"; template: TemplateRecord }
  | { type: "template.records"; templates: readonly TemplateRecord[] }
  | { type: "template.content"; template: TemplateRecord; content: unknown };
```

`template.update` is the only path that changes a registered template. It
carries both halves — the catalog declaration and the backing content — in one
command, so the two statements about a template cannot diverge. `expectedRevision`
is a compare-and-swap and the first one in this capability: everything else here
either creates or removes.

`template.get` and `template.load` are separate so a picker listing a catalog
stays a single store read. `load` exists at all because registration seals the
owning capability's own read surface; see [concepts](concepts.md).

## Ports

`TemplateStore` ([`ports/templateStore.ts`](../ports/templateStore.ts)) is
synchronous because SQLite is. Beyond ordinary reads it carries the claim
protocol — `claimCommand`, `bindClaimTemplateId`, `completeClaim` — and the
reservation lifecycle — `reserve`, `nameTaken`, `markReady`, `update`, `delete`,
`deleteReservation` — plus retained-history purge and retention operations.
`markReady` and `delete` each take a `TemplateFinalizeCommit` so the catalog
change and its Activity transaction commit in one transaction.

`update` takes a `TemplateUpdateCommit` and does three things atomically:
compare-and-swap on `expectedRevision`, archive the record being replaced into
history at its old revision, and append the transaction. The archive is not
optional bookkeeping — every other revision transition here leaves a history
record, and an update that skipped it would make `latestSnapshot` report
pre-update state as though it were current.

`nameTaken` exists so the service can tell a name collision from an identity
collision: `reserve` returns a single `false` for any unique violation, but the
two are different errors to a caller. The unique index remains the authority.

`TemplateResourceAdapter` ([`ports/resourceAdapter.ts`](../ports/resourceAdapter.ts))
has create, instantiate, update, logical-delete, and purge methods, all
returning `Promise<void>` with deterministic idempotency keys — plus
`readTemplateCopy`, which returns `unknown` and takes no key because it is a
read. `TemplateResourceRegistry` exposes only `get(kind)`.

`TemplateActivityPublisher` ([`ports/activityPublisher.ts`](../ports/activityPublisher.ts))
has a single `publish(transaction)`.

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
different origin replays rather than conflicts. Source transactions persist the origin that
committed the catalog change and pass it directly to Activity.

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
| `TemplateUnsupportedKindError` | 400 `unsupported_kind` |
| `TemplateWireError` | 400 `validation_error` |

The three 409s stay distinct because a caller does something different with
each: a revision conflict is retried after re-reading, a name conflict needs a
different name, and an idempotency mismatch means the request ID was reused for
different content.

`TemplateNameConflictError` carries `templateName`, not `name` — a parameter
property called `name` would be clobbered by the `this.name` assignment every
error class here makes, silently losing the value a caller needs.

There is deliberately no resource-mismatch error, because the *mutating* adapter
methods return nothing to disagree with. `readTemplateCopy` does return
something, but Templates passes it straight through without interpreting it.
