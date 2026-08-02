# Context ↔ Persona — questions from the Context migration

The Context migration (`scratch/context-migration.md`, implemented, uncommitted)
replaced the anonymous `compose` endpoint that `scratch/persona-design.md`
assumes. `persona-design.md` needs updating to match; the questions below are
the decisions needed before I make that edit.

## What actually changed, precisely

`persona-design.md` says:

```text
caller picks includes and excludes
  → POST /project/contexts/compose { op: "difference", a, b }
  → anonymous ~uuid context record
  → persona.context = { id: thatRecord.id, kind: "context" }
```

citing `context.ts:208` and `registerContextEndpoints.ts:276`. Current code
(`apps/backend/src/3-capabilities/context/context.ts:198`,
`apps/backend/src/4-job-wiring/context/registerContextEndpoints.ts:141,160`):

- There is no `/contexts/compose`. Two endpoints exist instead:
  `POST /contexts/union` and `POST /contexts/difference`, each taking
  `{ a: ContextOperand, b: ContextOperand, displayName: string, description?: string }`.
- **`displayName` is required and must be non-empty.** `composeNamed` throws a
  plain `Error("displayName is required")` if it's missing — mapped to generic
  `400 bad_request`, not one of the typed Context errors.
- **The name must be unique.** `composeNamed` calls `getByName` first and
  throws `ContextConflictError` (409) on collision. There is no upsert /
  find-or-create path.
- The created record is **not anonymous**. Nothing auto-prefixes `~`. It is a
  normal, permanent, listable record — it shows up in `GET /contexts` like
  anything else. The `~`-prefix / `includeAnonymous` filtering mechanism still
  exists in `list()`, but nothing generates `~`-prefixed names anymore unless a
  caller deliberately chooses one.
- Response is still just `{ contextId: string }` (that part of the design
  holds).

## Questions

**Q1 — Naming convention for persona-generated scopes.**
Every time an author shapes a persona's `context` field via union/difference,
it now needs a real, unique, catalog-visible name. Three options:

- (a) No convention — the author picks a name, same as naming any other
  context. Simple, but the catalog fills up with one-off scopes over time and
  "which contexts are actually reusable vs. persona-scaffolding" isn't
  distinguishable.
- (b) The persona-authoring UI auto-generates a name in a recognizable pattern
  (e.g. `~persona:<slug-or-id>:context`), so it's hidden from the default
  `GET /contexts` listing via the existing `includeAnonymous` filter, keeping
  the "anonymous" spirit alive at the UI-convention layer even though the
  backend has no real anonymity anymore.
- (c) Something else you have in mind.

**Q2 — Collision handling.**
`composeNamed` hard-fails on a duplicate `displayName` with no upsert. If an
author re-saves a persona and the UI recomputes the same composed scope with
the same auto-generated name, that's a guaranteed 409 unless the name is made
unique per attempt (e.g. embeds a hash or timestamp) or the flow does
get-by-name-first-then-reuse. Do you want a defined convention here, or is
this purely a caller/UI concern that Persona's design doesn't need to say
anything about?

**Q3 — Rewrite of the "known limitation" about anonymous contexts.**
`persona-design.md`'s Known Limitations section says: *"Anonymous contexts
referenced by a persona are a retention root... Context documents a future
housekeeping job that sweeps unreferenced anonymous (`~`-prefixed)
contexts."* Since compose no longer auto-creates anonymous records, this
limitation is now conditional on an author manually choosing a `~`-prefixed
name (relevant if Q1 → (b)). Should I keep this section but reframe it as
conditional, or drop it entirely and only reintroduce it if Q1 lands on (b)?

**Q4 — Workflow text and diagram.**
Straightforward once Q1–Q3 are answered: rewrite the "The context reference"
section's example flow to show the real two-endpoint, named-record shape
instead of the old anonymous one-endpoint shape. No design decision here,
just confirming you want this folded into the same edit rather than a
separate pass.

## Aside — not a persona question, a Context correctness note

`composeNamed`'s empty-`displayName` check throws a bare `Error`, which the
job-wiring `contextErrorResponse` ladder catches only via its generic
fallback (`400 bad_request`, message from `e.message`). Every other Context
failure mode (`ContextNotFoundError`, `ContextConflictError`,
`StaleContextError`) is a typed class. This isn't wrong, just inconsistent
with the house convention (`08-conventions.md`: "one typed class per
distinguishable failure") and with Review 001's Tier-1 fix for exactly this
coercion-defect shape elsewhere in Context. Worth a one-line
`ContextValidationError` at some point — not blocking, just flagging since I
was in the file.

Also: there is still no `context.test.ts`. `composeNamed`, the new
`description` field, and the whole union/difference path are currently
untested. Not a persona-design question, but Persona is about to build on
top of this contract, so I'd want this covered before or alongside Persona's
own test suite.

## Resolved

**Q1/Q2 — not a naming-convention question after all.** The premise was
wrong: Persona doesn't need the *author* to pick a name for anything. Persona
itself creates a second, private Context record wrapping whatever the author
handed it, named deterministically from the persona's own immutable `id` —
`persona:<personaId>`. That's collision-proof (UUID) without any convention
to agree on, and it means the union/difference naming question the author
faces is unrelated to Persona at all — it's just how *they* choose to shape
what they hand to Persona in the first place, same as naming any other
context. Full design in `scratch/persona-design.md` → "The private wrapper."

**Q3 — resolved by scope, not by policy.** The "sweep job" framing was the
wrong mental model — there was never a sweep job built (grep confirms: `docs/
invariants.md` lists "automatic anonymous-context cleanup" as a non-goal,
and there's no code for it anywhere). The actual ask was **"not generally
accessible via list."** Decision: replace the fragile `~`-prefix nomenclature
with an explicit `private` column on Context — see the diff below. Persona
then owns its wrapper's full lifecycle symmetrically with its own
(create → declare, update → update, delete → delete), so there's no
retention problem left for anything else to solve. One narrow gap remains
and is accepted: a Context write that succeeds followed by a Persona write
that fails leaves an orphaned *private* (never listed) row. Not worth
building delegated-claim durability for.

**Q4 — yes, folded into the same edit.** Done in `persona-design.md`.

## The Context change

Small, self-contained, no migration burden (dev data, drop-and-recreate
precedent already set by the union/difference migration itself).

**Schema** (`apps/backend/src/3-capabilities/context/sqlite-store.ts`):

```sql
ALTER TABLE ctx_${prefix}_contexts ADD COLUMN private INTEGER NOT NULL DEFAULT 0;
-- (in practice: add to the CREATE TABLE IF NOT EXISTS block directly, no
-- migration needed — see context-migration.md's own "drop and recreate" note)
```

Drop the `NOT LIKE '~%'` filter in `list()`; replace with `private = 0`.

**Types** (`context/types.ts`): `ContextRecord` gains `readonly private:
boolean` (default `false`).

**Store** (`context/store.ts`): `list(includeAnonymous: boolean)` →
`list(includePrivate: boolean)`. `insert`/`update` persist the new column.

**Service** (`context/context.ts`):

```ts
declare(
  displayName: string,
  entries: ContextEntry[],
  options?: { description?: string; private?: boolean }
): Promise<ContextRecord>;

composeNamed(
  op: "union" | "difference",
  a: ContextOperand,
  b: ContextOperand,
  displayName: string,
  options?: { description?: string; private?: boolean }
): Promise<ContextRecord>;

list(opts?: { includePrivate?: boolean }): Promise<ContextRecord[]>;
```

Collapsing `description` (and now `private`) into a trailing options object
instead of stacking more positional params — small breaking change to the
two current call sites (`registerContextEndpoints.ts` and the union/
difference handlers), worth doing now while there are only two of them.

**Wire** (`4-job-wiring/context/registerContextEndpoints.ts`): rename
`includeAnonymous` query param to `includePrivate` on `GET /contexts`.
Overridden below — `private` **is** exposed on the wire, on all three
mutating endpoints.

**Docs** (`context/docs/invariants.md:24`, `context/docs/runtime.md:25`):
replace the `~`-prefix / anonymous-naming description with the `private`
column; drop "automatic anonymous-context cleanup" from non-goals only if a
real retention story replaces it (it doesn't need to — Persona's symmetric
lifecycle is the retention story for its own records; the non-goal can stay
worded generally for any *other* future private-record owner).

## Status: implemented

One correction from the original proposal: **`private` is exposed on the
wire**, not runtime-only. Reasoning from the follow-up conversation: there's
no reason an external caller composing a scope for their own purposes
shouldn't be able to mark it private too — it's just an optional field,
defaulting to `false` (not private) when omitted, and the response always
returns the record/id regardless of the flag. `parsePrivate` in
`registerContextEndpoints.ts` is intentionally strict — only a literal JSON
`true` counts, anything else (missing, `null`, `"true"` as a string) is
`false` — matching the coercion-safety lesson from Review 001 rather than
`String(x ?? "")`-style loose parsing.

Landed:

- `context/types.ts` — `ContextRecord.private: boolean`.
- `context/store.ts` — `list(includePrivate: boolean)`.
- `context/sqlite-store.ts` — `private INTEGER NOT NULL DEFAULT 0` column,
  `list()` filters on it instead of `NOT LIKE '~%'`, `insert`/`update`
  persist it.
- `context/context.ts` — new `ContextWriteOptions = { description?: string;
  private?: boolean }`; `declare`/`composeNamed` take it as a trailing
  options object instead of a positional `description?: string`;
  `list(opts?: { includePrivate?: boolean })`.
- `4-job-wiring/context/registerContextEndpoints.ts` — `parsePrivate` helper;
  `POST /contexts`, `/contexts/union`, `/contexts/difference` all read
  `body.private`; `GET /contexts` reads `includePrivate`.
- `context/docs/{types,runtime,concepts,invariants,flows}.md` — updated to
  describe the `private` column in place of the `~`-prefix/anonymous
  convention throughout.

Verified: `pnpm typecheck` (via `nix develop`) shows only the pre-existing,
unrelated Slide error (`slideService.ts` missing); `pnpm test` — 155/155
still pass. No test exercises `private` yet — there is still no
`context.test.ts` (see the aside above); that gap is now slightly more
consequential since there's a real column to regress on.

`scratch/persona-design.md`'s "Ports" section describing
`PersonaContextPort.declare(..., { private?: boolean })` is unaffected by
the wire-exposure change — Persona still calls the in-process
`ContextManager`/port either way, it just happens that the same flag is now
also reachable from outside.
