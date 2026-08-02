# Templates types

All types live in [`domain/model.ts`](../domain/model.ts) unless noted.

## Record

```ts
type TemplateRecordState = "reserving" | "ready";

interface TemplateRecord {
  readonly id: string;            // allocated by Templates
  readonly kind: string;
  readonly resourceId: string;    // equals `id` in version 1
  readonly description?: string;  // catalog annotation, immutable in v1
  readonly state: TemplateRecordState;
  readonly createdAt: string;
  readonly deletedAt?: string;
}

interface TemplateResourceRef {
  readonly kind: string;
  readonly resourceId: string;
}
```

`description` is not a copy of anything the backing resource holds. It answers
"what is this template for", which is a statement about the catalog entry. The
resource's own title stays with the resource and is read live.

## Bindings

```ts
interface TemplateContextBinding {
  readonly entry?: ContextEntry;   // omitted means "explicitly unbind"
  readonly description?: string;   // template documentation only
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

`ContextEntry` is `{ id, kind }`, re-exported as a type only.

## Commands and queries

```ts
interface TemplateCommandRequest {
  readonly requestId: string;
  readonly command: TemplateCommand;
}

type TemplateCommand =
  | { type: "template.register";
      source: TemplateResourceRef;         // no templateId: Templates allocates it
      description?: string;
      contextBindings: TemplateContextBindings }
  | { type: "template.instantiate";
      templateId: string;
      destinationResourceId: string;
      title?: string;
      contextBindings: TemplateContextBindings }
  | { type: "template.delete"; templateId: string };

type TemplateCommandResult =
  | { type: "template.registered"; template: TemplateRecord }
  | { type: "template.instantiated"; template: TemplateRecord; resource: TemplateResourceRef }
  | { type: "template.deleted"; templateId: string };

type TemplateQuery =
  | { type: "template.get"; templateId: string }
  | { type: "template.list"; kind?: string };

type TemplateQueryResult =
  | { type: "template.record"; template: TemplateRecord }
  | { type: "template.records"; templates: readonly TemplateRecord[] };
```

## Ports

`TemplateStore` ([`ports/templateStore.ts`](../ports/templateStore.ts)) is
synchronous because SQLite is. Beyond ordinary reads it carries the claim
protocol — `claimCommand`, `bindClaimTemplateId`, `completeClaim` — and the
reservation lifecycle — `reserve`, `markReady`, `softDelete`,
`deleteReservation`. `markReady` and `softDelete` each take a
`TemplateFinalizeCommit` so the catalog change and its Activity fact commit in
one transaction.

`TemplateResourceAdapter` ([`ports/resourceAdapter.ts`](../ports/resourceAdapter.ts))
has three methods, all returning `Promise<void>`, each taking a deterministic
`idempotencyKey`. `TemplateResourceRegistry` exposes only `get(kind)`.

`TemplateActivityPublisher` ([`ports/activityPublisher.ts`](../ports/activityPublisher.ts))
has a single `publish(fact)`.

## Facts and options

```ts
type TemplateFactKind = "template.registered" | "template.deleted";

interface TemplateCommittedFact {
  readonly factId: string;
  readonly kind: TemplateFactKind;
  readonly templateId: string;
  readonly resourceKind: string;
  readonly resourceId: string;
  readonly actorId?: string;
  readonly occurredAt: string;
}

interface TemplateOptions { readonly maxTemplatesPerProject: number }
```

Templates uses its own origin vocabulary; `1-init/create/templates.ts`
translates a fact into an `ActivityTransaction`.

## Errors

One class per distinguishable failure, in
[`domain/errors.ts`](../domain/errors.ts): `TemplateWireError`,
`TemplateValidationError`, `TemplateNotFoundError`,
`TemplateAlreadyExistsError`, `TemplateUnsupportedKindError`,
`TemplateIdempotencyMismatchError`, `TemplateCatalogLimitError`.

There is deliberately no resource-mismatch error, because adapter methods
return nothing to disagree with.
