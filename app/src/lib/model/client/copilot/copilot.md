# Copilot

Lives at the object root as `copilot.md`. It is the entry point: a reviewer reads
this, then follows the file tree into the document that answers their question.

## Description

The copilot holds **the message that has not been sent**: its text, its mode, who
it is addressed to, what the response may draw on, and what the turn carries.

Everything a conversation already contains is read from the server. Persona
threads, agent tasks and the messages inside them are rows, read with `useQuery`
— live subscriptions that update whenever anything anywhere writes. This object
holds no conversation content, no thread list, and no unread count; each of those
is a query, and a cache beside a live subscription is a second answer that can
disagree with the first.

## Ownership Boundary

The copilot owns:

- The draft, the mode, the persona and the destination
- The scope — one normalized `ResourceSetExpression`
- The attachments this turn carries
- The focus request count

Consumers own:

- **Sending.** The dock calls the mutation and reports the result
- **Every selector's meaning.** The client records what the user chose; the
  capability decides what each arm does when it executes
- **Which conversation is showing.** That is navigation, and navigation is an
  inspection — a `copilot.*` key on the active tab
- **Every scope path.** The category that owns the selection produces it; the
  resolver reads it

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`, after the workbench
- **Released by:** nothing — it holds nothing releasable

**Nothing here is persisted.** A half-composed message that outlived the browser
would be a message the user can neither see nor has chosen to keep.

## The two surfaces

**The status bar** — [`views/status-bar/`](../../../views/status-bar/status-bar.md)
— is deliberately small: the composer, the mode and the persona, and nothing
else. It is the middle of three parts, under the work surface, which is where the
floating dock ended up once it was clear that hovering over the work meant being
translucent over it.

**The inspector** is where a request is assembled. Every selector and every
attachment is chosen there. If the composer grows an attachment affordance it
opens the inspector rather than holding state of its own.

The split matters because the composer is always visible and the inspector is
not. A composer that grew a scope editor would take permanent vertical space for
something used occasionally.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `mode` | `Mode` | How the next message is treated. Global |
| `destination` | `Destination` | Where the next message goes |
| `personaId` | `string \| undefined` | Who answers a new conversation |
| `draft` | `string` | The composer text |
| `scope` | `ResourceSetExpression` | What the response may draw on |
| `attachments` | `readonly Attachment[]` | What this turn carries |
| `blocked` | `Blocked` | Why the message cannot be sent, or nothing |
| `focusRequests` | `number` | Monotonic; the dock acts on a number it has not seen |

## Construction

```ts
export const createCopilot = (workbench: WorkbenchModel): CopilotModel => ...;
```

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `workbench` | BORROWED | Resolving the active tab into selectors, for the scope editor |

Built after the workbench. Nothing reads it yet — the category describes its own
selection as a `part` selector and the inspector passes it in — but the
dependency is declared because it is what the scope editor will resolve through.

## Terminal Behaviour

None. It holds nothing releasable, so `ClientModel.close()` passes it by.

## Two departures from the design document

**`Attachment`'s ref arm is wrapped.** The document has
`ResourceRef | { kind: "link"; … }`, and that is not a discriminated union:
`ResourceRef` carries an **open** `kind: string`, so `"link"` is a perfectly
legal resource kind and nothing could tell the arms apart at a type level or at
runtime. Wrapping it as `{ kind: "resource"; ref }` makes the discriminant this
object's own — the same move `Selector` already makes for the same reason.

**Ids are plain strings**, not `Id<"personaThreads">`. Neither table exists, and
the type would have to be loosened to admit a third destination anyway.

## Concurrency and SSR

- Every method is synchronous and nothing awaits, so no two can interleave.
- **The model never calls a capability.** That keeps it testable without a
  network and puts an error where it can be seen.
- It touches no browser API. `focus()` counts; the dock calls `.focus()`, because
  the model owns no elements.

## Invariants

- **Nothing here is persisted.**
- **The model never sends.** `sent()` is past tense.
- **The model never parses a `scopePath`.**
- **A selector is in `include`, in `exclude`, or in neither** — never both.
- **The expression is normalized on every write**, so one set has one
  representation and two scopes can be compared.
- **Scope survives a send; attachments do not.** Attachments are written onto the
  message; scope is a standing decision about what the next one may draw on.
- **An attachment is complete when it is added.** A link carries its fetch
  result, so nothing in the list is pending.
- **The copilot holds no conversation content.**

## File Tree

```text
copilot/
├── copilot.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── set-mode.ts · write.ts · select-persona.ts · address.ts
│   ├── include.ts · exclude.ts · drop-selector.ts · clear-scope.ts
│   ├── attach.ts · detach.ts · clear-attachments.ts
│   ├── blocked.ts · sent.ts · focus.ts
│   └── shared/
│       ├── shared.md
│       ├── same-selector.ts
│       └── same-attachment.ts
└── test/unit/
```
