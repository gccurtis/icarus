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
- **One decision is still open** and blocks step 6: whether a Prompt Block may
  hold `appliedRevision: 0`. See that document.

### The model, stated once

```text
caller ──POST /templates/command──> Templates ──> resource runtime (Document, …)
                                        │
                                        ├─ duplicate()      -> new resource ID
                                        ├─ markAsTemplate() -> resource goes private
                                        ├─ submit()         -> pass-through edits
                                        ├─ load()           -> pass-through reads
                                        └─ delete()/purge()
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
[general-updates 16a](0-general-updates.md#16--garbage-collection-for-orphaned-resources).

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
       idempotencyKey: string;
     }): Promise<{ resourceId: string }>;

     /** Seals the resource: private, unreachable through its own endpoints. */
     markAsTemplate(input: { resourceId: string }): Promise<void>;

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

3. Keep the registry shape in `1-init/create/templates.ts`; only the value type
   changes.

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

Procedure:

1. Receipt lookup on `requestId`; replay on hit.
2. `registry.get(kind)` → `TemplatableResource`, else `unsupported_kind`.
3. `nameTaken(kind, name)` → else `name_conflict`. Both checks precede any
   external call.
4. `resource.duplicate({ sourceResourceId: resourceId, idempotencyKey })`
   → `{ resourceId: backingId }`.
5. `resource.markAsTemplate({ resourceId: backingId })`.
6. If `contextBindings` is non-empty, `resource.submit(...)` to apply them to the
   backing copy.
7. Allocate `templateId`; insert the catalog row and the receipt **in one SQLite
   transaction**, with `resourceId: backingId`.
8. Append the `template.registered` transaction.

**Why bindings are applied in step 6 rather than during duplication:**
`duplicate` stays a pure copy with no knowledge of templates or bindings. That
keeps it reusable — a resource capability can offer duplication for its own
reasons — and it means binding application uses the same pass-through path that
`template.update` already needs.

**Why steps 7's two writes are one transaction:** if the catalog row commits and
the receipt does not, a retry re-runs step 4 (replayed by the resource), then
fails at step 3 with a name conflict against the row it just wrote.

### Step 4 · Rework `template.instantiate`

```ts
{ type: "template.instantiate"; templateId: string; name?: string;
  contextBindings: TemplateContextBindings }
```

1. Receipt lookup; replay on hit.
2. Load the template record; `registry.get(record.kind)`.
3. **Reject unless every declared binding key is supplied.** A partial
   instantiation is an error, not a resource with unbound variables.
4. `resource.duplicate({ sourceResourceId: record.resourceId, idempotencyKey })`
   → the new instance's ID.
5. `resource.submit(...)` to apply the instance's bindings.
6. **No `markAsTemplate`** — an instance is a normal resource.
7. Record the receipt; return `{ template, resource: { kind, resourceId } }`.

`destinationResourceId` is **removed from the wire.** The resource allocates it.

### Step 5 · Rework `template.list` into a search

```ts
{ type: "template.list";
  kinds?: string[];        // any-of
  search?: string;         // case-insensitive substring over name + description
  limit?: number; cursor?: string }
```

This is now the only way to discover templates of any kind, so it has to be
usable as a picker: filter by kind, type-ahead over name and description.

**Consequence:** `document.listTemplates` is removed from the Document plan
entirely. Resource capabilities do not list templates.

### Step 6 · `template.update` and `template.load` become pass-throughs

- `template.update` → catalog fields on the record, `resource.submit(...)` for
  `resourceOperations`, both under the existing CAS. Already built; only the
  call target changes.
- `template.load` → `resource.load(...)`. Already built; only the call target
  changes.

**Blocked on the open `appliedRevision` decision** only insofar as Document's
`duplicate` cannot produce a valid Prompt-bearing copy until it is settled.
Templates' side of both commands is independent of it.

### Step 7 · Documentation

1. `templates/docs/` — six files: the runtime port, the register/instantiate
   procedures, the search-shaped list, receipts instead of claims, no
   `reserving` state.
2. `templates-design.md` — replace the "Resource adapter registry" section
   rather than leaving the superseded note added on 2026-08-02.
3. `0-general-updates.md` — mark item 17 done.

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
  invisibility, `deleteReservation`-on-failure.
- **Rewrite:** every `registerCommand` fixture (`source` → `kind` +
  `resourceId`); the fake adapter becomes a fake resource runtime with
  `duplicate` returning an allocated ID.
- **Add:** receipt replay on exact retry; digest mismatch on divergent reuse;
  `duplicate` called once per register; `markAsTemplate` called on register and
  **not** on instantiate; partial instantiation bindings rejected; list filters
  by kind and by search over name and description; catalog row and receipt
  committed together.

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

### Phase A — Templates rework (this plan)

- [ ] **1. Claims → receipts**
  - [ ] delete `data/templates.db`
  - [ ] drop `command_claims`, `claimCommand`, `bindClaimTemplateId`, `completeClaim`
  - [ ] drop `TemplateClaimState`, `TemplateCommandClaim`, `TemplateClaimOutcome`
  - [ ] add `command_receipts` (`request_id` PK, digest, result, created_at)
  - [ ] `command()` becomes receipt-lookup → execute → record
  - [ ] drop `TemplateRecordState`, the `state` column, the `_ready` index
  - [ ] drop `markReady`, `deleteReservation`
  - [ ] drop `CHECK (resource_id = id)`
  - [ ] green
- [ ] **2. Runtime port**
  - [ ] delete `TemplateResourceAdapter`
  - [ ] add `ports/templatableResource.ts` — `duplicate`, `markAsTemplate`, `submit`, `load`, `logicalDelete`, `purge`
  - [ ] retype the registry in `1-init/create/templates.ts`
  - [ ] green
- [ ] **3. `template.register`**
  - [ ] wire: `source` → flat `kind` + `resourceId`
  - [ ] procedure: receipt → kind → name check → `duplicate` → `markAsTemplate` → `submit` bindings
  - [ ] catalog row + receipt in **one** transaction
  - [ ] green
- [ ] **4. `template.instantiate`**
  - [ ] drop `destinationResourceId` from the wire
  - [ ] reject unless every declared binding is supplied
  - [ ] `duplicate` → `submit` bindings, no `markAsTemplate`
  - [ ] return the resource ID the runtime allocated
  - [ ] green
- [ ] **5. `template.list` → search**
  - [ ] `kinds?`, `search?` over name + description
  - [ ] green
- [ ] **6. Pass-throughs**
  - [ ] `template.update` → `resource.submit`
  - [ ] `template.load` → `resource.load`
  - [ ] green
- [ ] **7. Docs** — `templates/docs/` ×6, `templates-design.md` section replaced

### Phase B — Document changes

Tracked in [`document-changes-design.md`](document-changes-design.md); repeated
here only as the ordering.

- [ ] **0. Relax `appliedRevision` validation** — allow `0`, decided
- [ ] **1. Remove `representationVersion`**
- [ ] **2. Context Variables**
- [ ] **3. Prompt Blocks take exactly one context**
- [ ] **4. `isTemplate` + sealing**
- [ ] **5. `duplicate`, `markAsTemplate`, `submit`, `load`**
- [ ] **6. Register Document's runtime with Templates** ← first end-to-end template

### Phase C — Deferred, tracked in `0-general-updates.md`

- [ ] **15.** Live project-scoped Context — unblocks exclusions in bindings
- [ ] **16.** Garbage collection for orphaned backing resources and outputs

## Sequencing note

Phase A completes and stays green with **no resource runtime registered**. Its
tests use a fake. That means Templates will still answer `unsupported_kind` to
every mutating command when Phase A finishes — which is exactly its state today,
not a regression, but worth expecting rather than discovering.

The first genuinely working template register happens at **B6**.
