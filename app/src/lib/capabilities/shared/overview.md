# Shared

The types every other capability's rows and bodies embed. **The one capability
with no public surface**: no `api/`, no deployment door, and no `schema.ts`,
because it stores nothing of its own.

## Why a capability rather than a loose file

Lint treats any directory under `capabilities/` holding a file as a capability,
and allows only `overview.md`, `errors.ts`, and `schema.ts` at a root — so
`shared/actor.ts` fails on sight. `types/` is where it belongs anyway: a
validator is a statement about the model, not a step in a procedure.

The alternative was putting `Actor` in whichever capability first needed it,
which is how the same question gets two answers. A change set, an activity
entry, an agent task's origin, and a document's `createdBy` all ask *who did
this*, and before this they each answered with their own union differing by a
case or two.

## Data Ownership

None. Everything here is embedded in someone else's row.

## Capability Invariants

- **Attribution is an `Actor`, never a bare user id.** The remaining
  `Id<"users">` fields in the application express human responsibility —
  a membership's `userId`, a thread's `resolvedBy` — which is not the same
  question as authorship and is not delegable to a process.
- **A reference is not a label.** `Actor` is small, exact, and what code
  compares; the display form is resolved for rendering and stored only where it
  must outlive its subject. That separation is what makes it affordable to
  attribute every one of the thousands of change sets a document accumulates.
- **Print dimensions are points, and a named paper size stays a name.** A pixel
  has no physical size, and A4 resolved to numbers cannot be told from a custom
  size that happens to match.
- **An agent actor is the task, not the user who dispatched it.** The
  dispatching person is recorded in the task's own `origin`. Undo filters on
  `kind === "user"` precisely so that reaching for Ctrl-Z does not revert a
  hundred edits an agent made on someone's behalf.

## Related

[actor](../../../../../docs/data-models/core/actor.md) — the model this
implements, and the reasoning in full.
