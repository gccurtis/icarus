# Templates rework — implementation plan

Invert the Templates ↔ resource relationship, remove command claims, and clear
the Templates database.

## What this is

Templates currently expects a **translation adapter** per resource kind, written
by hand in `1-init`, satisfying a Templates-owned port. Templates supplies the
destination ID and the adapter returns nothing.

After this rework Templates receives the **resource capability's own runtime
object** and drives it directly. The resource allocates its own IDs. Templates
owns the whole procedure and passes commands through to resources it has sealed.

## What you need to know

- **Nothing here is broken.** Templates is green at 297 tests. This is a
  redesign of a seam that has zero implementations, which is why it is cheap now
  and expensive later.
- **The Templates database is cleared, not migrated.** The record shape, the
  claim table, and the state column all change.
- **Document is not built in this plan.** This plan makes Templates ready to
  receive a resource runtime. Document's side —`duplicate`, `markAsTemplate`,
  Context Variables — is [`document-changes-design.md`](document-changes-design.md).
- **Nothing in this plan is open.** `appliedRevision: 0` was the last question
  and it is settled; it constrains Document's `duplicate`, not Templates.
- **Progress is ticked in** [`0-templates-checklist.md`](0-templates-checklist.md),
  not here.

### The model, stated once

```text
caller ──POST /templates/command──> Templates ──> resource runtime (Document, …)
                                        │
                                        ├─ duplicate()      -> new resource ID
                                        ├─ markAsTemplate() -> resource goes private
                                        ├─ applyBindings()  -> binds its variables
                                        ├─ submit()         -> pass-through edits
                                        ├─ load()           -> pass-through reads
                                        └─ logicalDelete()/purge()
```

- Templates knows kinds. Resources know nothing about Templates.
- A sealed resource is unreachable through its own endpoints. Templates is the
  only caller that gets through, because it holds the runtime object rather than
  going over HTTP.
- `template.list` is the **only** template listing in the system. Resource
  capabilities do not expose one.

### What each side owns

| Concern | Owner |
|---|---|
| Template ID, catalog row, name, description, declared bindings | Templates |
| Resource ID of the backing copy | The resource capability |
| Duplication mechanics, content, revisions | The resource capability |
| Deciding a resource is a template, and sealing it | Templates, by calling `markAsTemplate` |
| Listing, filtering, and searching templates | Templates |

---

## What should be done

### Step 1 · Clear the database and drop the claim machinery

1. Delete `data/templates.db`.
2. Delete the `command_claims` table, `claimCommand`, `bindClaimTemplateId`,
   `completeClaim`, and `TemplateClaimState` / `TemplateCommandClaim` /
   `TemplateClaimOutcome`.
3. Add a `command_receipts` table keyed by `request_id`, holding
   `request_digest`, `result_json`, `created_at`. Mirror Document's
   `getCreateSubmission` / `recordSubmission` shape.
4. In `TemplateService.command`, replace claim-then-execute with:
   receipt lookup → replay on hit, mismatch on differing digest → execute →
   record receipt.
5. Delete `TemplateRecordState`, the `state` column, `markReady`,
   `deleteReservation`, and the `_ready` partial index. Records are inserted
   ready.
6. Delete `CHECK (resource_id = id)`.

**Why it all goes together:** `bindClaimTemplateId` exists only to freeze an ID
before an external call. Once the catalog row is written *after* the resource
returns, there is no ID to freeze, so the reservation, its two states, and the
promote/release pair have nothing left to do.

**Why `CHECK (resource_id = id)` goes with them:** the capability that **stores**
a resource allocates its ID. Templates allocates the Template ID because it
stores the catalog row; the resource capability allocates the backing resource's
ID because it stores the resource. They were never required to match — the
`CHECK` made a coincidence look like a rule, and it only held because Templates
was handing its own ID down as the destination.

**What this costs:** a crash between the resource call and the catalog write
leaves an orphan backing resource. Tracked as
[general-updates AR-1](0-general-updates.md#ar-1--registration-can-leak-an-orphaned-backing-resource).

*(This step absorbs what was general-updates item 17, now removed from that
file.)*

### Step 2 · Replace the adapter port with a resource-runtime port

1. Delete `ports/resourceAdapter.ts`'s `TemplateResourceAdapter`.
2. Add `ports/templatableResource.ts`:

   ```ts
   export interface TemplatableResource {
     readonly kind: string;

     /** Pure copy. New ID, same content. No template awareness, no bindings. */
     duplicate(input: {
       sourceResourceId: string;
       /** What to call the copy. Omitted keeps the source's own name. */
       name?: string;
       idempotencyKey: string;
     }): Promise<{ resourceId: string }>;

     /** Seals the resource: private, unreachable through its own endpoints. */
     markAsTemplate(input: { resourceId: string }): Promise<void>;

     /** Binds the resource's own variables. Typed, not opaque — see below. */
     applyBindings(input: {
       resourceId: string;
       contextBindings: TemplateContextBindings;
       idempotencyKey: string;
     }): Promise<void>;

     /** Pass-through edit. Opaque to Templates; the kind interprets it. */
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

   export interface TemplatableResourceRegistry {
     get(kind: string): TemplatableResource | undefined;
   }
   ```

3. Rename in `1-init/create/templates.ts`: `createTemplateAdapterRegistry` →
   `createTemplateResourceRegistry`, `RuntimeTemplateAdapterRegistry` →
   `RuntimeTemplateResourceRegistry`. `startBackend.ts:117` follows. The registry
   *shape* is unchanged — only its value type and the words.
4. `TemplateDependencies.adapters` → `resources`, and
   `TemplateUnsupportedKindError`'s message says *runtime*, not *adapter*.

**Why `applyBindings` is a method and not a `submit` call.** An earlier draft of
this plan said bindings were applied by calling `submit`. That is not
implementable: `submit` carries `operations: unknown`, and only the owning kind
knows what a context-variable operation looks like. Templates would have to
construct one, which is exactly the per-kind knowledge the whole design keeps out
of it.

A typed method is also the honest shape. Bindings arrive in Templates' own
vocabulary — decoded strictly at its wire boundary, stored on its record — so
handing them across the port unchanged is a pass-through, while turning them into
operations would be a translation Templates is not entitled to make. This is the
same argument `templates-design.md` already makes for
`TemplateInstantiationInput` being typed rather than `arguments?: unknown`:
Context Variables are resource-level structure, not a Document peculiarity.

`submit` stays for caller-supplied content edits, where `unknown` is correct
because the caller — not Templates — authored the payload.

**Why a port at all, if we are "passing the runtime object":** the port is only
the *type* of the value in the registry. There is **no adapter object** — that is
what the inversion removed. Registration is one line:

```ts
templateResources.register(document);   // Document's runtime object, no wrapper
```

That line typechecks only if `DocumentCapability` actually has `duplicate`,
`markAsTemplate`, and the rest. Without the interface the registry would be
`Record<string, any>`, and a missing or misspelled method would surface at
runtime as *"undefined is not a function"* inside a serial job instead of at
compile time.

Typing the registry as `DocumentCapability` directly is the other alternative,
and it fails on both counts: Templates would import Document, breaking the
cross-capability rule, and it could never hold a second kind.

Same pattern as `ContextManager` satisfying `PersonaContextPort` and
`FormulaNameResolver` satisfying `DocumentFormulaResolver` — a narrow interface
the concrete runtime happens to satisfy.

### Step 3 · Rework `template.register`

New command shape — `source` becomes a flat `kind` + `resourceId`:

```ts
{
  type: "template.register";
  kind: string;
  resourceId: string;
  name: string;
  description?: string;
  contextBindings: TemplateContextBindings;
}
```

`TemplateResourceRef` survives, but only as the shape of the
`template.instantiated` **result**. It is no longer a command input.

Procedure:

1. Receipt lookup on `requestId`; replay on hit, mismatch on a differing digest.
2. `registry.get(kind)` → `TemplatableResource`, else `unsupported_kind`.
3. `nameTaken(kind, name)` → else `name_conflict`. Both checks precede any
   external call.
4. `resource.duplicate({ sourceResourceId: resourceId, idempotencyKey })`
   → `{ resourceId: backingId }`.
5. `resource.markAsTemplate({ resourceId: backingId })`.
6. If `contextBindings` is non-empty,
   `resource.applyBindings({ resourceId: backingId, contextBindings, idempotencyKey })`.
7. Allocate `templateId`; insert the catalog row, the receipt, and the
   `template.registered` transaction **in one SQLite transaction**, with
   `resourceId: backingId`. ✅ *`store.create` already does this — it landed in
   step 1, where removing the claim made the window it closes unsurvivable.*

**Why bindings are applied in step 6 rather than during duplication:**
`duplicate` stays a pure copy with no knowledge of templates or bindings. That
keeps it reusable — a resource capability can offer duplication for its own
reasons — and it means registration and instantiation apply bindings by the same
call rather than by two different mechanisms.

**Why step 7's three writes are one transaction:** if the catalog row commits and
the receipt does not, a retry re-runs step 4 (replayed by the resource), then
fails at step 3 with a name conflict against the row it just wrote.

**`TemplateAlreadyExistsError` stays.** `reserve()` is gone, but the insert can
still lose on `UNIQUE (kind, resource_id)` — two registrations of the same source
racing past the name check with different names. The error keeps its 409.

### Step 4 · Rework `template.instantiate`

```ts
{ type: "template.instantiate"; templateId: string; name?: string;
  contextBindings: TemplateContextBindings }
```

1. Receipt lookup; replay on hit.
2. Load the template record; `registry.get(record.kind)`.
3. **Reject unless every declared binding key is supplied.** A partial
   instantiation is an error, not a resource with unbound variables. New typed
   failure: `IncompleteTemplateBindingsError` → 400, naming the missing keys.
4. `resource.duplicate({ sourceResourceId: record.resourceId, name?, idempotencyKey })`
   → the new instance's ID.
5. `resource.applyBindings(...)` with the instance's arguments.
6. **No `markAsTemplate`** — an instance is a normal resource.
7. Record the receipt; return `{ template, resource: { kind, resourceId } }`.

`destinationResourceId` is **removed from the wire.** The resource allocates it.

**`title` became `name`.** What instantiation takes is the *instance's* name, and
calling it `title` invited it to be confused with the template's. Three names
meet here and none is the other: the Template record's `name` (the catalog
label), the sealed backing copy's inherited title (unreachable), and this one.
It reaches the resource through `duplicate`, which is the only thing that names a
copy.

**Each argument must carry a `target`.** At registration an omitted target
declares a parameter with no default; at instantiation it would leave the
instance holding an unbound variable, which is the state the rule exists to
prevent. Rejected at the wire.

### Step 5 · Rework `template.list` into a search

```ts
{ type: "template.list";
  kinds?: string[];        // any-of
  search?: string;         // case-insensitive substring over name + description
  limit?: number; cursor?: string }

// result
{ type: "template.records"; templates: TemplateRecord[]; nextCursor?: string }
```

This is now the only way to discover templates of any kind, so it has to be
usable as a picker: filter by kind, type-ahead over name and description.

Pagination follows `document.list` — an opaque encoded cursor over the existing
`(created_at, id)` order, with a capability-private `encodeCursor`/`decodeCursor`
pair. Every paginating capability defines its own; there is no shared helper, and
introducing one is not this plan's job.

**Consequence:** `document.listTemplates` is removed from the Document plan
entirely. Resource capabilities do not list templates.

### Step 6 · `template.update` and `template.load` become pass-throughs

- `template.update` → catalog fields on the record, `resource.submit(...)` for
  `resourceOperations`, `resource.applyBindings(...)` when `contextBindings`
  changed, all under the existing CAS. Already built; the call targets split in
  two.
- `template.load` → `resource.load(...)`. Already built; only the call target
  changes.
- `template.delete` / `template.purge` → `logicalDelete` / `purge`. Same.

`appliedRevision: 0` is settled (Document change 0), so nothing here waits on it.
Document's `duplicate` needs it; Templates' side of these commands never did.

### Step 7 · Documentation

1. `templates/docs/README.md` — the status block is the most stale page in the
   capability. It describes an adapter registry, cites
   `scratch/document-design/templates-and-context-variables.md` (deleted), and
   lists `ports/resourceAdapter.ts` in its implementation map.
2. `templates/docs/{concepts,types,runtime,flows,invariants}.md` — the runtime
   port, the register/instantiate procedures, the search-shaped list, receipts
   instead of claims, no `reserving` state. `concepts.md`'s "adapter methods
   return void" rule and `invariants.md`'s "nothing to disagree with" line both
   go: `duplicate` and `load` return values now.
3. `templates-design.md` — **replace** the superseded-note-plus-old-content in
   *Resource runtime registry*, *Commands and queries*, and *Persistence and
   idempotency*, rather than leaving a note on top of stale text.
4. Tick A1–A7 in [`0-templates-checklist.md`](0-templates-checklist.md).

---

## Order and checkpoints

```text
1 claims -> receipts ─┐
                      ├─> 3 register ──> 4 instantiate ──> 5 list ──> 6 pass-through ──> 7 docs
2 runtime port ───────┘
```

Steps 1 and 2 are independent of each other and of everything else; each leaves
the tree green. Steps 3–6 are sequential because each reuses the previous one's
procedure. **The suite must be green after every step** — none of these is a
partial-migration checkpoint.

## Verification

```bash
rm -f apps/backend/data/templates.db
nix develop --command bash -c "cd apps/backend && pnpm typecheck"
nix develop --command bash -c "cd apps/backend && pnpm test"
```

Baseline **297 tests**. Expect a net reduction: the claim-resumption and
reservation tests go away with the mechanisms they cover, replaced by fewer
receipt-replay tests.

## Test changes

- **Delete:** pending-claim resumption, frozen-ID reuse, `reserving`-record
  invisibility, `deleteReservation`-on-failure, and the fixture's `observedState`
  probe — there is no longer a mid-command state to observe.
- **Rewrite:** every `registerCommand` fixture (`source` → `kind` +
  `resourceId`); the fake adapter becomes a fake resource runtime with
  `duplicate` returning an allocated ID; the crash-window test currently
  interposes on `completeClaim` and must interpose on the receipt write instead.
- **Add:** receipt replay on exact retry; digest mismatch on divergent reuse;
  `duplicate` called once per register; `markAsTemplate` called on register and
  **not** on instantiate; `resourceId` differs from `id`; partial instantiation
  bindings rejected; list filters by kind and by search over name and
  description, and paginates; catalog row, receipt, and transaction committed
  together.

## Settled

**`submit` carries a full `DocumentOperation[]`.** A template is fully editable
through `template.update` — text, blocks, headings, layout, styles. The one
practical consequence: `prompt.create.request` and `formula.evaluate.request` are
members of that union and start async attempts, so a template edit can kick off
model work. Accepted.

**Slides gets compound kind strings, not a wider registration payload.** The
registry is keyed by `kind`, so Slides satisfies the port once and registers
under two kinds:

```text
slides::deck
slides::slide
```

Matching Connector's existing `connector::file::text` convention. The sub-kind
travels inside the kind string, so `template.register` still takes exactly
`{ kind, resourceId }` and nothing about the Templates model changes. Confirm
when Slides is built.

## Open questions

**Does `duplicate` need an `idempotencyKey`, or should the resource key off its
own receipt table?** Document already has a create receipt keyed by request ID;
passing the Templates key straight into it is the cheapest option and is what
step 3 assumes. Confirm when Document's side is built — it does not block this
plan.

---

## Checklist

Tracked in [`0-templates-checklist.md`](0-templates-checklist.md), together with
the Document changes that follow and the two deferred items. It lives there
rather than here because it spans all three plans — and because a checklist kept
in two places is a checklist kept in neither.

## Sequencing note

Phase A completes and stays green with **no resource runtime registered**. Its
tests use a fake. That means Templates will still answer `unsupported_kind` to
every mutating command when Phase A finishes — which is exactly its state today,
not a regression, but worth expecting rather than discovering.

The first genuinely working template register happens at **B6**.
