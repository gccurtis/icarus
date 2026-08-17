# Client model

What the browser holds, as [data models](../data-models/) is what the server
stores.

Three objects live in `app/src/lib/model/client/`, and the split between them is
one question asked three ways: **what is open**, **what is being changed**, and
**what has not been sent**.

| Document | Object | Owns |
| --- | --- | --- |
| [workbench](workbench.md) | `workbench` | Every tab and everything a tab is — target, view state, the context rail, inspection, panel geometry |
| [resource runtimes](resource-runtimes.md) | `resourceRuntimes` | One runtime per open general resource: the op buffer, the submit protocol, the undo stack |
| [copilot](copilot.md) | `copilot` | The unsent message — its text, mode, addressee, scope and attachments |

Two more objects exist and need no design of their own: `storage`, which persists
the workbench, and `commands`, which is a registry over the other three.

## The property they share

**One state object per concern, and the views are functions of it.** There is no
event bus, no store subscription and no surface-to-surface communication. The
model is `$state`; views read it directly and write back through its methods.

That is why the five shell surfaces — tab strip, context panel, work surface,
inspector, status bar — own almost nothing between them, and why a screen can be
built without touching any of them.

## The rule that decides where something lives

**A model object holds what the server does not yet know about.** Everything else
is a query.

Persona threads, agent tasks, messages, documents, activity — all rows, all read
with `useQuery`, which is already a live subscription that updates when anything
anywhere writes. A cache beside one of those is a second answer that can disagree
with the first.

So a resource runtime exists because an op buffer and an undo stack are not on the
server yet. The copilot exists because an unsent message is not either. The
workbench is the exception that proves it: what is open is genuinely client state,
which is why it is the one object with anything persisted.

## Reading order

Start with [workbench](workbench.md) — the other two are shaped by it, and the tab
lifecycle is what drives runtime attachment and release.

## Related

[data models](../data-models/) · [storage](../storage/) ·
[processes](../processes/) ·
[the model directory standard](../../app/docs/model-directory/model-directory.md)
