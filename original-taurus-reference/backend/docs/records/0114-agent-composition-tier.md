# 0114 — `agent` as the composition tier (COH-1)

Resolves the one architectural question the review left open
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md) `COH-1`): whether
`agent`'s dependencies on other capabilities are a defect to remove or an
architecture to declare.

## The question

Every capability is supposed to be decoupled — a capability declares a *port* for
behaviour it needs, and the composition root supplies an adapter, so no capability
imports another. Seventeen of the twenty obey that strictly.

`agent` does not. It imports `document`, `intelligence`, `knowledge`,
`notification`, and `persona`. For four of those the coupling is only value
types, with behaviour reached through agent-owned ports (`Reasoner`, `Retriever`,
`PersonaResolver`, `Notifier`). For `document` it went further: `Workflows` held a
`*document.Documents` and called `Get`/`SubmitChanges` on it at seven sites.

What made this feel wrong was the inconsistency. Wiring goes to the trouble of a
`documentAuthorizer` adapter so agent can honour resource access *without*
importing `resource` — and then agent imports `document` outright.

## What decided it

Counting what `agent` actually uses from `document` in production code: **25
distinct symbols, of which exactly one is the service.** The other 24 are the
document *model* — `ChangeOp`, `Row`, `Block`, `BlockKind*`, `SubKind*`, `Op*`,
`ChangeSubmission`, `BlockContext`, `PromptData`, and the markdown helpers.

That is not incidental coupling. An agent's document tools **author document
content**: they build change operations against the block tree and submit them.
Speaking the document model is the job. Hiding it behind agent-owned duplicates
would mean re-modelling the block tree in a second place — guaranteed to drift,
and worse than the coupling it removes.

So the original rule was not describing a defect; it was stated imprecisely. The
distinction that matters is not *imports* but *behaviour*: reaching into another
capability's service is what must stay invertible.

## The decision

The invariant is now stated in two halves, both load-bearing
([runtime model §6](../architecture/runtime-model.md#6-phase-4--the-capability-meta-model)):

> Leaf capabilities never import each other. `agent` is the sanctioned
> composition tier and may depend on the capabilities it composes — but even
> there, every *behavioural* dependency goes through a port `agent` declares; a
> direct import carries shared value types only.

## What changed in code

`Workflows` no longer holds `*document.Documents`. `agent` declares the port it
needs:

```go
type DocumentEditor interface {
	Get(projectID, documentID string) (document.Document, error)
	SubmitChanges(projectID, id, authorID string, submission document.ChangeSubmission, actorNames ...string) (document.ChangeSet, error)
}
```

Two operations — the two it actually uses — instead of the whole service. The
signature keeps `SubmitChanges`'s variadic `actorNames` so the canonical
`*document.Documents` satisfies the port **directly**: wiring passes the service
unchanged and needs no adapter, exactly as `notification.Notifications` already
satisfies agent's `Notifier`. So this is a narrowing with no added indirection.

The gains are least privilege (agent can no longer reach arbitrary document
service methods), testability (a fake editor replaces a real service plus store),
and internal consistency with agent's own `DocumentAuthorizer` pattern.

## Tests

Written first, both red before the change:

- `TestDocumentToolsUseTheDeclaredPort` — a fake `DocumentEditor` drives the
  `document.get` tool, proving the tool reads through the port rather than a
  concrete service.
- `TestDocumentsServiceSatisfiesThePort` — a compile-time assertion that the
  canonical service still satisfies the port, so wiring never needs an adapter.

Existing agent tests were untouched: they pass `*document.Documents`, which
satisfies the port, so the refactor is invisible to them.
