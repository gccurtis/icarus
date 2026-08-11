# service.go

The slim core of the `Documents` service: the struct and its ports, the
`Options` it is built from, `New`, the two setters wired after construction, and
the helpers every other part of the service shares (actor selection, Activity
fact construction, content-ID assignment, id minting).

The service's behaviour lives in siblings that hang off this same struct, all in
package `document`:

| file | surface |
| --- | --- |
| `service_crud.go` | create, rename, duplicate, list/summaries, `Get` |
| `service_lifecycle.go` | trash, restore, purge, `PurgeStale` |
| `service_anchors.go` | external anchors and their rebase |
| `service_history.go` | `GetAtRevision`, `Diff`, `Undo`, `Redo` |
| `service_submit.go` | submission admission, formula ops, `Rebase` |

This file also carries the **package doc comment** for `document`.

## Code breakdown

### The service struct: a store plus optional ports

`Documents` holds one `Store` and a set of tuning knobs resolved at
construction (`rebaseThreshold`, `historyLimit`, `trashRetention`,
`pageLayout`, `layoutRules`, `promptTopK`, `promptMaxQueries`). Everything else
on it is an optional port — `enqueuer`, `promptModel`, `retriever`,
`personaResolver`, `scopeResolver`, `scopeReferences`, `formulaEvaluator`,
`referenceIndexer`. Each may be nil, and every consumer is written to degrade
rather than panic: no enqueuer means re-base is never scheduled (reads still
resolve pending sets), no prompt model means `ResolveBlock` reports "not
configured", no reference indexer means link extraction is skipped.

`now func() time.Time` is the clock seam. It is set to `time.Now` by `New` and
overridden by tests; every timestamp in the capability goes through it.

### FormulaEvaluator — the formula port declared here

```go
type FormulaEvaluator interface {
	Evaluate(ctx context.Context, expression string, deps []FormulaDep) (FormulaResult, []FormulaDep, error)
}
```

One expression evaluated against the current dependency snapshot, returning the
typed result and refreshed dependency timestamps. Satisfied over the formula
capability at composition, so `document` never imports it. `service_submit.go`
is the only caller.

### Defaults for the zero-valued knobs

`defaultPromptTopK` (5), `defaultPromptMaxQueries` (4) and
`defaultTrashRetention` (720h — thirty days) back the `Options` fields a caller
leaves zero.

### Options: the composition-root shape

`Options` is documented field by field in the source; the theme is that every
field is optional. Re-base threshold, history limit, page layout, row metrics,
the capability ports, prompt template overrides, retrieval knobs, and trash
retention. A zero `Options` yields a working service that stores documents,
resolves reads, and simply does less.

### New: normalize the knobs, then freeze them

`New` is where "invalid config" becomes "documented default" rather than an
error. Sub-1 values for the threshold and prompt knobs fall back to the
defaults; a non-positive `TrashRetention` falls back to thirty days; the page
layout and row metrics are normalized and then **validated together** —

```go
opts.PageLayout = normalizePageLayout(opts.PageLayout)
opts.LayoutRules = normalizeLayoutRules(opts.LayoutRules)
if !validPageLayout(opts.PageLayout, opts.LayoutRules) {
	opts.PageLayout = defaultPageLayout()
}
```

— because a page whose margins leave no room for a row of the configured
metrics is not a page. Prompt templates are parsed once here, not per request.
Note that `scopeResolver` and `scopeReferences` are deliberately *not* set from
`Options`.

### The two post-construction setters

`UseScopeResolver` and `UseScopeReferences` exist because both ports compose
over the contexts capability, which is built *after* the document service —
a constructor argument would be a wiring cycle. Nil (the default) keeps the
narrower behaviour: origin-level scope, and a direct-origin-only dependency
cascade.

### System actor identity

`SystemActorID` / `SystemActorName` are the `"system"` strings used when a
mutation has no human author — a purge sweep, a job-driven edit.

### selectedActor: the variadic-actor convention

Several methods take `actors ...Actor` so callers can omit attribution.
`selectedActor` reduces that to exactly one actor: no actor, or a blank ID after
trimming, yields `SystemActor`; a blank name falls back to the ID. Every
Activity fact goes through it, so a fact can never carry an empty actor.

### newActivityFact: one shape for every emitted fact

Builds an `ActivityFact` with a fresh id, the document's project/id/name as the
target, and the caller's `sourceKind`/`sourceID` pair identifying what produced
it (`"document"`, `"document.rename"`, `"document.change_set"`, …). Facts are
handed to the store alongside the mutation so both land in one transaction.

### assignIDs / normalizeBlock: stable identifiers before storage

`assignIDs` walks the rows of a `Base`, gives every row a fresh id if it lacks
one, and normalizes each block. This runs on `Create` (and, via `assignOpIDs`,
on incoming ops) because change operations address content by id — content
stored without ids could never be edited.

`normalizeBlock` fills a block's id and default `Kind`, applies the
text-block-only `SubKind` rule (`SubKindBody` when blank; cleared for non-text
kinds), normalizes style and style-ref, and then walks atoms and marks giving
each a fresh id and default kind. It also carries one semantic rule worth
stating:

```go
if b.Kind == BlockKindPrompt {
	b.Inferred = true
	if b.Data == nil {
		b.Data = PromptData{}
	}
}
```

A prompt block's content is *generated*, so it is always marked inferred and so
kept out of the source text fed to knowledge; and it always carries a
`PromptData`, so resolution never has to nil-check.

### newID

16 random bytes, hex encoded. `crypto/rand.Read` cannot fail on the platforms
targeted, so the error is deliberately discarded rather than propagated through
every construction path.

### `Attributor` — naming the block a resolution's model calls belong to

A resolution makes two model calls (plan and synthesis), and until now they were
indistinguishable in the log from any other call in the run. `Attributor` tags
the context with `document:<documentID>#<blockID>` so both are charged to the
block that caused them, which is what makes per-block latency and cost readable
rather than blended into a per-run total.

It is a **function type, not an interface**, because it is one operation and an
interface would be ceremony around a single method. It is a **port at all**
because this capability imports neither intelligence nor telemetry, and must not
start doing so merely to say which block it is resolving — the composition root
supplies `intelligence.WithSubject` and the dependency stays where it belongs.

A nil `Attributor` leaves calls unattributed. That costs only the ability to sum
one block's spend, so it is a legitimate configuration rather than a failure, and
`attribute` returns the context unchanged so no call site needs a guard.
