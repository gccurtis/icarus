# The copilot model

The client object behind the dock and the copilot inspector. Third of the client
model objects, beside [the workbench](workbench.md) and
[resource runtimes](resource-runtimes.md).

## What it holds

The message that has not been sent: its text, its mode, who it is addressed to,
what the response may draw on, and what the turn carries.

Everything a conversation already contains is read from the server. Persona
threads, agent tasks and the messages inside them are rows, read with `useQuery` —
live subscriptions that update whenever anything anywhere writes. The object holds
no conversation content, no thread list, and no unread count; each of those is a
query, and a cache beside a live subscription is a second answer that can disagree
with the first.

Nothing here is persisted. A half-composed message that outlived the browser would
be a message the user can neither see nor has chosen to keep.

Which conversation the inspector is showing is **navigation**, and navigation is an
inspection: it lives on the active tab as a `copilot.*` `InspectionKey`, set
through `workbench.inspect()` and replaced by whatever the user clicks next.

## The two surfaces

**The dock** — `views/copilot-dock/` — is deliberately small. It carries the
composer, the mode, and the persona, and nothing else. A user types, chooses
between ask, act and plan, chooses who answers, and sends.

**The inspector** is where a request is assembled. Every selector below is chosen
there, and so is every attachment. If the dock grows an attachment affordance it
opens the inspector rather than holding state of its own.

The split matters because the dock is always visible and the inspector is not. A
composer that grew a scope editor would take permanent vertical space for something
used occasionally.

## State

| Field | Type | Purpose |
| --- | --- | --- |
| `mode` | `"ask" \| "act" \| "plan"` | How the next message is treated. Global — a tab change does not alter it |
| `destination` | `Destination` | Where the next message goes |
| `personaId` | `Id<"personas"> \| undefined` | Who answers a new conversation. An existing thread carries its own |
| `draft` | `string` | The composer text. One draft, kept across a destination change |
| `scope` | `ResourceSetExpression` | What the response may draw on. Survives a send |
| `attachments` | `readonly Attachment[]` | What this turn carries. Written onto the message and cleared on send |

```ts
type Destination =
  | { kind: "new" }                                      // personaId decides who answers
  | { kind: "persona-thread"; id: Id<"personaThreads"> }
  | { kind: "agent-task"; id: Id<"agentTasks"> };        // sending steers it
```

## Selectors

`ResourceSetExpression` lives in `shared` and is used unchanged. It is one flat
include list and one flat exclude list, with no nesting and no recursion.

```ts
interface ResourceSetExpression {
  include: Selector[];
  exclude: Selector[];
}

type Selector =
  | { kind: "project" }
  | { kind: "resourceKind"; resourceKind: ResourceKind }
  | { kind: "resource"; ref: ResourceRef }
  | { kind: "part"; ref: ResourceRef; scopePath: string; label: string }
  | { kind: "web" };
```

A **resource set is a resource**, so one set is
`{ kind: "resource", ref: { kind: "resourceSet", id } }` and every set is a
`resourceKind` selector. There is no `set` arm.

### The three arms do three different things downstream

This is the part worth stating plainly, because the union is one list to the user
and three mechanisms to whatever executes the request.

| Arm | What it becomes |
| --- | --- |
| `project`, `resourceKind`, `resource` | Membership in the resolved **resource set**, which retrieval runs over |
| `part` | **Specific context** — carried into the request directly, or exposed as a tool the response can call to fetch it |
| `web` | A **capability grant**: the response may use web tools |

The client does not know or care about that split. It records what the user chose;
the capability decides what each arm means when it executes. Keeping the
interpretation server-side is what lets the dock, the inspector, a persona's
material and a prompt block's inputs all speak the same vocabulary.

### `scopePath` is opaque here

The model never parses a scope path, the same way a resource runtime never parses
an operation path. The screen that owns the selection produces it; the resolver
reads it.

Each resource is selectable whole — as a `resource` selector — and a `part` names
something inside it.

| Resource | Whole, as `resource` | Parts, as `part` |
| --- | --- | --- |
| document | the document | a selection — a range across display text |
| slides | the deck | a slide · an element |
| spreadsheet | the spreadsheet | a cell · a range |

**A scope path is not an operation path.** They overlap in shape where both address
a single node, and they diverge where a scope path names a span — an operation
addresses one cell or one atom, and a range is not something an op can target
today. Naming the field `scopePath` rather than `path` keeps the two from being
assumed interchangeable.

### Normalization

Applied on write, so one set has one representation and two sets can be compared.

| Rule | Effect |
| --- | --- |
| `project` in `include` | Drops every other `project` · `resourceKind` · `resource` include |
| A `resourceKind` in a list | Drops `resource` selectors of that kind from the same list |
| A selector in both lists | `exclude` wins; the include is dropped |
| Duplicates | Collapse |

**`part` and `web` are exempt from absorption.** They are not narrower statements
of set membership — they are different mechanisms, so a whole document being in
scope does not make a selected paragraph redundant. Retrieval over the document may
never surface that paragraph; naming it as a part is what guarantees the response
sees it.

## Attachments

What the user pointed at, as opposed to what the response may search.

```ts
type Attachment =
  | ResourceRef
  | { kind: "link"; url: string; triedAt: number;
      ok: boolean; fileId?: string; error?: string };
```

Attachments are written onto the message, so they outlive the composer and the
conversation. Scope does not — it is a standing decision about what the next
message may draw on.

A link carries the result of its fetch, so it is added once that fetch resolves
rather than before. The chip appears already knowing whether the link worked, which
is the only moment the user can act on it.

## Public methods

**Composing** — `setMode(mode)`, `write(text)`, `selectPersona(id?)`,
`address(destination)`. Addressing keeps the draft, the scope and the attachments:
changing where a message goes is redirecting it, not starting a new one.

**Scope** — `include(selector)`, `exclude(selector)`, `dropSelector(selector)`,
`clearScope()`. All three writers normalize, and a selector is in one list, the
other, or neither.

**Attachments** — `attach(attachment)`, `detach(attachment)`,
`clearAttachments()`. Idempotent by kind and id.

**Sending** — `blocked` reports why the message cannot be sent, or nothing: an
empty draft, or a `new` destination with no persona. `sent(destination)` clears the
draft and the attachments, keeps mode, persona and scope, and addresses whatever
the message landed in.

**Focus** — `focus()` bumps a counter the dock watches. That is the whole of the
`copilot.focus` command.

### The model does not send

`sent()` is past tense. The dock calls the mutation and reports the result. A
refused mutation leaves the draft in the composer, because `sent()` was never
called, and the failure is the dock's to render.

That keeps the object testable without a network and puts an error where it can be
seen.

## Who assembles a request

| | |
| --- | --- |
| **The screen** | Describes its own current selection as a `part` selector — `{ref, scopePath, label}` — or nothing. Only the screen knows that "this element" is a particular element of a particular slide |
| **The inspector** | Offers the choices and calls the model. It builds no selector itself |
| **The model** | Assembles and normalizes one `ResourceSetExpression`, and holds the attachments |
| **The capability** | Resolves it: expands `project` and `resourceKind`, follows set references, applies exclusions, injects parts, grants web tools |

## Construction

```ts
// Built after the workbench, which it borrows to resolve the active tab's
// resource and selection into selectors.
const copilot = createCopilot(workbench);
```

It holds nothing releasable, so `ClientModel.close()` passes it by.

## File architecture

```text
model/client/copilot/
├── copilot.md
├── index.ts
├── types.ts               CopilotModel · Destination · Mode
│                          ResourceSetExpression, Selector, Attachment and
│                          ResourceRef are imported from shared
├── definition.svelte.ts   $state: mode · destination · personaId
│                                  draft · scope · attachments
├── constructor.ts         createCopilot(workbench)
├── methods/
│   ├── methods.md
│   ├── set-mode.ts · write.ts · select-persona.ts · address.ts
│   ├── include.ts · exclude.ts · drop-selector.ts · clear-scope.ts
│   ├── attach.ts · detach.ts · clear-attachments.ts
│   ├── blocked.ts · sent.ts · focus.ts
│   └── shared/
│       ├── shared.md
│       ├── normalize.ts   the four expression rules, one writer
│       └── same-ref.ts    ref identity, used by the scope and attachment writers
└── test/unit/
```

## Invariants

- **Nothing here is persisted.** An unsent message does not outlive the session.
- **The model never calls a capability.** The dock sends and reports.
- **The model never parses a `scopePath`.** The screen produces it; the resolver
  reads it.
- **A selector is in `include`, in `exclude`, or in neither** — never both.
- **The expression is normalized on every write.**
- **Scope survives a send; attachments do not.**
- **An attachment is complete when it is added.** A link carries its fetch result,
  so nothing in the list is pending.
- **The copilot holds no conversation content.**

## Related

[workbench model](workbench.md) ·
[resource runtimes](resource-runtimes.md) ·
[model directory](../../app/docs/model-directory/model-directory.md)
