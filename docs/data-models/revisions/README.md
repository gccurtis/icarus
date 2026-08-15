# Revisions

How Icarus stores what changed. Three needs, and keeping them apart is what
keeps the scheme affordable:

**Merging.** Two people edit a document at once. The second edit was authored
against a revision that is no longer current, and rejecting it purely because
the number moved is wrong when the two touched different paragraphs.

**History.** What did this say last Tuesday, and who changed it. Needed rarely,
needed indefinitely, and not worth paying for on every read.

**Undo.** Reverse what I just did. Needs the inverse of a change, not a copy of
the state before it.

## One mechanism

General resources — [document](../general-resources/document.md),
[slides](../general-resources/slides.md),
[spreadsheet](../general-resources/spreadsheet.md) — are stored as a head body
plus a sequence of [change sets](change-set.md). Everything above falls out of
that one structure:

- **current state** = leader head + recent change sets
- **any past revision** = base head + historical change sets up to that point
- **merging** = rebasing a set whose `baseRevision` is behind
- **undo** = inverting a set and submitting it as a new one

No object needs a bespoke history model, because replay already produces any
version anyone asks for. That is the reason the list of things with revision
models is as short as it is.

## Two tiers

| | Holds | Purpose | Bounded by |
| --- | --- | --- | --- |
| **hot** | leader snapshot + `recent` change sets | reads, CAS, rebase | consolidation interval |
| **cold** | base snapshot + `historical` change sets | reconstructing past revisions | retention depth |

The hot tier's size is a constant. A document edited for a year has the same
working set as one edited yesterday, because consolidation continuously folds
recent sets into the leader and re-tiers them.

Both bounds are
[configuration](../../../app/configuration/revisions.yaml), not model
decisions — they are numbers to tune against real editing sessions.

## Compare-and-swap without a version field

The resource row carries no `revision`. Current revision is the highest change
set revision, read from an index.

The change set table is uniquely indexed on `(resourceId, revision)`, so
inserting at an already-taken revision fails — and that failure *is* the CAS. No
version field to read, patch, and contend on, and no rewriting a large body just
to bump a counter.

## Undo

An undo is not a special operation. Every op is
[invertible](change-set.md#every-op-is-invertible), so undoing a change set means
inverting each op, reversing their order, and submitting the result as an
ordinary change set — subject to the same rebase rules as anything else. Undoing
a change someone has since edited around either merges cleanly or conflicts, and
both are correct.

**Undo only ever moves forward.** Nothing rewinds, so nothing downstream has to
unwind. An undo triggers a [lattice change](lattice-change.md) exactly like the
edit it reverses, which makes dependent [derived
outputs](../knowledge/derived-output.md) stale, which refreshes them. The chain
that would be hard to run backwards is never run backwards.

### Undo is per tab

Undo is a command sent to the focused tab, and what it means is the tab's
business. A general-resource editor inverts a change set. Every other tab does
nothing, for now — and doing nothing is a complete answer rather than a gap.

This is what keeps undo from needing a cross-object transaction model. An agent
that edits a document, files a finding, and updates a question has done one thing
from a person's point of view and three from the model's — but **agents do not
participate in undo at all.** Reverting an agent's work is a different affordance
on an [activity](../collaboration/activity.md) entry, with its own semantics and
its own design. Conflating the two is what made the boundary look hard.

Adding undo elsewhere later — reverting an accepted hypothesis, say — is an
addition to that tab, not a change to this model.

### Per tab means per user

Two people editing one document: my undo reverts *my* last change set, not the
most recent one. The stack filters on the change set's
[`actor`](../core/actor.md) — `kind === "user"` and a matching `userId`.

This is a designed property of that field rather than a filter added later. The
alternative — undoing whatever happened last — reverts a colleague's paragraph
because they typed more recently, and also reaches changes made by agents, which
is [not what undo is
for](../core/actor.md#the-user-behind-an-agent-is-not-the-actor).

### The stack is not stored

An undo stack is the change sets made in this tab, in this session. It is client
state with no model here; closing the tab discards it, as every editor does.

Redo needs nothing either. Ops are closed under inversion, so redo is inverting
the inverse.

## What has a revision model

| Object | Model |
| --- | --- |
| [document](../general-resources/document.md), [slides](../general-resources/slides.md), [spreadsheet](../general-resources/spreadsheet.md) | [snapshot](resource-snapshot.md) + [change sets](change-set.md) |
| [knowledge lattice](../knowledge/knowledge-lattice.md) | [version](lattice-version.md) + [change log](lattice-change.md) |
| [external file](../special-resources/external-file.md) | a `supersedes` pointer — not a model |
| everything else | none |

The two models exist for different reasons and should not be read as one scheme.
Resource history serves merging, replay, and undo — it is authored, and it is
reversible. **Lattice history serves none of those.** Lattice changes are
triggered rather than authored, so they are never an undo target and nothing
replays them; the log earns its place purely as explanation, and it is
[prunable without losing any state](lattice-change.md#retention).

### Why the rest have none

**Derived output** — a refresh replaces the body wholesale, so keeping previous
versions means storing the whole thing again each time. A partial store is
worse than none: a generation you cannot fully reconstruct cannot be trusted to
show what it was derived from, which was the only reason to keep it. So the
current generation records its own provenance — the input revisions and lattice
version it ran against — and prior ones are not kept.

**Finding, question, hypothesis** — the same argument. Their bodies are whole
values with no op log, so history would mean repeated full copies. Findings are
the closest call, since other things cite them, and the answer is that a
citation should record what it read rather than the finding carrying every state
it has ever been in.

**Comment** — a remark in a conversation, not a document. `editedAt` marks it as
changed and the prior text is not kept.

**Agent task, research messages** — already append-only. The message log *is*
the history.

**Project, user** — membership and profile changes are covered by activity.

**Persona, automation, intelligence, connector** — configuration. What matters is
who changed it and when, which is activity's job. Where a past execution needs
the configuration it ran under, the snapshot belongs on the execution — an
[agent task](../ai/agent-task.md) recording the persona it used — not as
configuration history.

**Template** — [instantiation is a
copy](../special-resources/template.md#instantiation-is-a-copy), so editing a
template cannot damage anything created from it.

**Content blocks** — no ids and no independent history. A block's history is its
resource's history.

## Files

[change set](change-set.md) · [resource snapshot](resource-snapshot.md) ·
[lattice version](lattice-version.md) · [lattice change](lattice-change.md)
