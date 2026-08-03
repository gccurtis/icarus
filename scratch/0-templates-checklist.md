# Templates + Document — checklist

## What this is

The single tracking list for the Templates rework and the Document changes that
follow it. Every box points at the plan section that specifies it; **no box
carries its own rationale**, because a second copy of a reason is a second thing
to keep true.

Tick boxes here. Change designs there.

| Document | Covers | Phase |
|---|---|---|
| [`templates-rework-plan.md`](templates-rework-plan.md) | Inverting Templates ↔ resource, receipts, search | **A** |
| [`document-changes-design.md`](document-changes-design.md) | Context Variables, sealing, copy, satisfying the port | **B** |
| [`0-general-updates.md`](0-general-updates.md) | Live project Context, orphan GC | **C** |

## What you need to know

- **Green after every step.** None of A1–A7 is a partial-migration checkpoint.
  If the suite is red between steps, the step was cut wrong.
- **The Templates database is cleared, not migrated.** Delete
  `apps/backend/data/templates.db` before the first manual run of Phase A, and
  `apps/backend/data/documents.db` before B1. Baseline is **297 tests**.
- **Phase A finishes green but still non-functional end to end.** No resource
  runtime is registered until B6, so Templates keeps answering
  `unsupported_kind` to every mutating command for the whole of Phase A. That is
  its state today, not a regression — but it means A's "done" is *the shape is
  right and a fake proves it*, not *you can make a template*.
- **The first genuinely working `template.register` is B6.**

## Status — 2026-08-02

**All three phases are complete.** 489 tests pass, typecheck clean.
`templateResources.register(document)` is one line in `startBackend.ts` with no
wrapper, so a Document can be registered as a template.

---

## Phase A — Templates rework

### A1 · Claims → receipts ✅ **DONE 2026-08-02**

→ [step 1](templates-rework-plan.md#step-1--clear-the-database-and-drop-the-claim-machinery)

- [x] delete `apps/backend/data/templates.db`
- [x] drop `command_claims`, `claimCommand`, `bindClaimTemplateId`, `completeClaim`
- [x] drop `TemplateClaimState`, `TemplateCommandClaim`, `TemplateClaimOutcome`,
      and their `index.ts` exports
- [x] add `command_receipts` — `request_id` PK, `request_digest`,
      `command_type`, `result_json`, `created_at`
- [x] `TemplateService.command` becomes receipt-lookup → execute → record
- [x] drop `TemplateRecordState`, the `state` column, the `_ready` partial index
      (replaced by a plain `(kind, created_at, id)` index)
- [x] drop `markReady`, `deleteReservation`; `reserve` → `create`
- [x] drop `CHECK (resource_id = id)`
- [x] `requireReady` → `requireTemplate`
- [x] tests: deleted pending-claim resumption, frozen-ID reuse, `reserving`
      invisibility; rewrote the crash-window test and the `observedState` probe
- [x] **green — 302 tests, typecheck clean** (from 297)

**One thing landed earlier than planned.** The catalog row, its receipt, and its
Activity transaction commit in **one** `store.create` transaction — which the
plan had at A3.

It could not wait. With the receipt written after the row, a crash between them
leaves a retry that re-runs the whole command and then collides with the name it
wrote itself a moment earlier, reporting a `name_conflict` against the caller for
the store's own half-finished write. The old claim made that window survivable by
freezing the ID; removing the claim without closing the window would have traded
a working mechanism for a broken one. `update` and `delete` commit their receipts
the same way, for the same reason.

`instantiate` and `purge` change no local state, so their receipts come from the
generic write after `execute`. That path now has its own two tests.

### A2 · Runtime port ✅ **DONE 2026-08-02**

→ [step 2](templates-rework-plan.md#step-2--replace-the-adapter-port-with-a-resource-runtime-port)

- [x] delete `ports/resourceAdapter.ts`
- [x] add `ports/templatableResource.ts` — `duplicate`, `markAsTemplate`,
      `applyBindings`, `submit`, `load`, `logicalDelete`, `purge`
- [x] `TemplateDependencies.adapters` → `resources`
- [x] `1-init/create/templates.ts` — `createTemplateAdapterRegistry` →
      `createTemplateResourceRegistry`, and the type it holds
- [x] `startBackend.ts` follows the rename
- [x] `TemplateUnsupportedKindError`'s message says *runtime*, not *adapter*
- [x] `index.ts` exports the new port types, not the old ones
- [x] **green**

**A2 could not be a pure type swap.** Changing the port changes what every
command *does*, so the service's procedures moved here too. A2 and A3 differ by
exactly one thing in the end: A2 rewired the procedures, A3 changed the wire
shape. Each was green on its own.

`destinationResourceId` was dropped here rather than in A4, because `duplicate`
allocating the ID made it dead the moment the port landed. Leaving a decoded,
silently-ignored field for one step would have been worse than removing it in the
step that killed it.

### A3 · `template.register` ✅ **DONE 2026-08-02**

→ [step 3](templates-rework-plan.md#step-3--rework-templateregister)

- [x] wire: `source: { kind, resourceId }` → flat `kind` + `resourceId`
      (`TemplateResourceRef` survives as the *result* shape only)
- [x] procedure: receipt → `registry.get(kind)` → `nameTaken` → `duplicate` →
      `markAsTemplate` → `applyBindings`
- [x] `resourceId` on the record is what `duplicate` returned, not the template ID
- [x] catalog row + receipt + transaction in **one** SQLite transaction (A1)
- [x] **green**

### A4 · `template.instantiate` ✅ **DONE 2026-08-02**

→ [step 4](templates-rework-plan.md#step-4--rework-templateinstantiate)

- [x] drop `destinationResourceId` from the wire and the command (A2)
- [x] reject unless the bindings name **exactly** the declared parameters
- [x] `duplicate` → `applyBindings`, and **no** `markAsTemplate`
- [x] return the resource ID the runtime allocated
- [x] **green**

**Stricter than planned, in one direction the plan did not mention.** The plan
said "reject unless every declared binding key is supplied". Undeclared keys are
now refused too: a variable the template never declared is baked-in content, and
binding it would edit the instance rather than configure it. `TemplateBindingMismatchError`
carries both lists → 400 `binding_mismatch`.

### A5 · `template.list` → search ✅ **DONE 2026-08-02**

→ [step 5](templates-rework-plan.md#step-5--rework-templatelist-into-a-search)

- [x] `kinds?: string[]` (any-of), `search?` over name + description,
      `limit?`, `cursor?`
- [x] result carries `nextCursor`, mirroring `document.listed`
- [x] `%` and `_` escaped in the search term; `kinds: []` matches nothing
- [x] `InvalidTemplateCursorError` → 400 `invalid_cursor`
- [x] **green**

### A6 · Pass-throughs ✅ **DONE 2026-08-02**

→ [step 6](templates-rework-plan.md#step-6--templateupdate-and-templateload-become-pass-throughs)

- [x] `template.update` → `resource.submit` for `resourceOperations`,
      `resource.applyBindings` when the declaration changed
- [x] `template.load` → `resource.load`
- [x] `template.delete` / `template.purge` → `logicalDelete` / `purge`
- [x] every call addressed by `resourceId`, never `templateId`
- [x] **green**

### A7 · Docs ✅ **DONE 2026-08-02**

→ [step 7](templates-rework-plan.md#step-7--documentation)

- [x] `templates/docs/README.md`
- [x] `templates/docs/{concepts,types,runtime,flows,invariants}.md`
- [x] [`templates-design.md`](templates-design.md) — superseded sections
      **replaced**, not annotated
- [x] `templates-implementation-plan.md` deleted — it planned the build that this
      rework replaced, and described claims, adapters, and a design file that no
      longer exist
- [x] tick A1–A7 here

---

## Phase B — Document changes ✅ **DONE 2026-08-02**

→ [`document-changes-design.md`](document-changes-design.md)

- [x] **B0** [Allow `appliedRevision: 0`](document-changes-design.md#change-0--allow-appliedrevision-0)
      — `isPositiveInteger` → non-negative at `validation.ts:196`, plus the
      `appliedRevision` consumers in `documentService.ts`
- [x] **B1** [Remove `representationVersion`](document-changes-design.md#change-1--remove-representationversion)
      — delete `data/documents.db`
- [x] **B2** [Context Variables](document-changes-design.md#change-2--context-variables)
- [x] **B3** [A Prompt Block takes exactly one context](document-changes-design.md#change-3--a-prompt-block-takes-exactly-one-context)
- [x] **B4** [`isTemplate` and sealing](document-changes-design.md#change-4--istemplate-and-sealing)
- [x] **B5** [Copy](document-changes-design.md#change-5--copy)
- [x] **B6** [Satisfy `TemplatableResource`](document-changes-design.md#change-6--satisfying-the-templates-resource-port)
      ← first end-to-end template

B0 and B1 are independent and can land in any order. B2 → B3 → B5, and B4 before
B5. **B5 and B6 land together** — a copy path with nothing calling it is
untested surface.

---

## Phase C ✅ **DONE 2026-08-02**

- [x] [**15** · Live project-scoped Context](0-general-updates.md#15--live-project-scoped-context)
      — `{ kind: "project" }` expands at resolve time, `excludes` on the record,
      and `composeNamed` stores a rule rather than a snapshot. *"Everything
      except these"* now works in a binding
- [x] **15's knock-on** — `Knowledge.resolveScope` no longer reads `[]` as the
      whole project, and a Derived Output naming nothing is refused instead of
      answered from everything
- [x] [**16** · Garbage collection for orphaned resources](0-general-updates.md#16--garbage-collection-for-orphaned-resources)
      — 16a shipped with Phase A; 16b is the `derived-outputs-orphans` retention
      port

**One defect found and fixed on the way.** `duplicate` named the command's
idempotency key as `creationAttemptId`, which is a foreign key into the attempts
table — so every copy of a Document containing a Prompt Block failed, *after*
declaring one Derived Output per block. 16b's leak was therefore certain on every
template instantiation of a Document with a prompt, not the rare crash window it
was recorded as. It was invisible because `seedDocument` builds no Prompt Block,
so the whole `duplicate` suite skipped the loop that declares outputs.

**Two things came out narrower than written.** 16b must never diff "every output
minus everything claimed" — outputs declared through the Derived Outputs API
legitimately have no owner, and a diff deletes all of them. And its claim set has
to be a list of claimants rather than Document, because Slides owns a
byte-identical ownership table and would have started losing outputs the day it
was wired in.

---

## Corrections folded into the plans on 2026-08-02

Recorded here because each one closed a gap that would have surfaced mid-build.

| What was wrong | Where | Now |
|---|---|---|
| `submit` was to apply context bindings, but it takes `operations: unknown` and Templates cannot construct a resource operation | rework plan steps 3, 4, 6 | `applyBindings` is its own port method, typed in Templates' own vocabulary |
| Instantiation took a `title`, which read as the template's | all three plans | It is the **instance's** `name`. Three names meet at instantiation and none is the other |
| Instantiation accepted an argument with no `target`, leaving the instance with an unbound variable | all three plans | A `target` is required at instantiation and optional at registration — the same shape meaning two different things |
| I claimed a declared `target` is "never consulted at instantiation" | my report, 2026-08-02 | Wrong. It is what the backing copy holds, so `duplicate` copies it verbatim and `applyBindings` then replaces it. What it is not is a *fallback* for an omitted argument, because omitting one is refused |
| The register walkthrough still allocated the template ID first and called `createTemplateCopy` | document design | Rewritten against the inverted model |
| `document.listTemplates` named as the one exception to sealing | document design change 4, general-updates 16a | Removed everywhere — `template.list` is the only template listing |
| A blockquote asked to confirm that an unbound variable grounds a Prompt on the whole project | document design change 3 | Deleted — it contradicted the *complete bindings required* rule three paragraphs above it |
| Item 17 listed as tracked in general-updates | document design closing section | Moved into rework plan step 1 |
