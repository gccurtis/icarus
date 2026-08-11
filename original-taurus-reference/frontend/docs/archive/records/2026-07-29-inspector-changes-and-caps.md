# 2026-07-29 — Real before/after, in-place expansion, and caps on activity

A live-review pass over the Overview inspector. The lenses were showing the right *things* in the
wrong shape: an edit you clicked told you its result but not what it replaced, activity lists grew
without bound, and clicking a neighbouring edit threw away the panel you were reading.

## The prior text is reconstructable, so "Result" is gone

The biggest change. Omega returns a change set's forward ops, which carry the **new** text only. The
previous value is computed and stored — the change set's `InverseOps` is exactly it — but withheld:

```go
// InverseOps is the server-computed compensation stored with this revision.
// It is private persistence state used by undo, not part of the public response.
InverseOps []ChangeOp `json:"-"`
```

Two earlier attempts to cope with that were both wrong. The first pushed the literal word `"text"`
into `before`, which rendered as a diff while saying nothing. The second dropped Before entirely and
labelled the survivor **Result** — honest, and useless: a reader cannot tell what changed from the
new value alone, and "Result" does not even say what it is the result *of*.

The fix is `systems/documents/change-detail.ts`, which recovers the old value the one way a client
can: **an atom's text before change set N is whatever the most recent change set older than N set it
to.**

```ts
for (const olderId of olderChangeSetIds.slice(0, LOOKBACK_BUDGET)) {
  if (prior.size === wanted.length) break;
  const olderOps = await fetchChangeSetOps(documentId, olderId);
  for (const atomId of wanted) {
    if (prior.has(atomId)) continue;
    const text = atomTextInChangeSet(olderOps, atomId);
    if (text !== null) prior.set(atomId, text);
  }
}
```

Each hop is a request, so the walk is bounded at 12 and stops as soon as every edited atom is
resolved — in practice one or two hops, because that is what typing looks like. A fetch that fails
is skipped rather than aborting; a pruned change set costs recall, not correctness.

`atomTextInOp` covers **both** ways an atom's text is established — a direct `set_atom_text`, and
the atom payload inside an insert (`row.blocks[].atoms[]`, `block.atoms[]`, `atom`). That second
branch is not an edge case: it is where the first edit after a paragraph was created finds its prior
value, which is the most common lookup in a fresh document. The e2e exercises exactly that path —
its seed inserts a row containing `"Draft"` and then sets the atom to `"Quarterly outline"`, and the
lens now renders both.

When the walk genuinely fails, `priorUnknown` renders `Not recoverable` plus one line saying the
earlier text is older than the retained history. That is deliberately distinct from `—`, which means
there was nothing before. Distinguishing the two is why it is a flag rather than an empty string.

`fetchChangeSetDetail` was deleted, and the document editor's own history modal now renders through
the same loader, so the two surfaces cannot disagree about what a change looked like. Sixteen unit
tests cover the pure parts (`change-detail.test.ts`); the four `accessSummary` tests went with the
function below.

## Activity lists expand in place, and are shared

Both lenses had an activity list, and both invited the same gesture — you read "edited" and want to
know what the edit was. They are now one component, `lenses/ActivityList.svelte`, whose rows expand
inline.

Previously those rows *selected* that event, swapping the whole lens. Wrong twice: it discarded the
panel you were reading, and it implied navigation over a list that can only reach already-loaded
events.

```ts
const loaded = entries ?? (await fetchDocumentHistory(documentId, HISTORY_DEPTH)).entries;
entries = loaded;
```

History is read **once per list**, on the first expansion, and reused. Per-row fetching would re-read
the same 50 entries each time; fetching on mount would pay for a panel that may never be opened.
`documentId` is the expandability switch — only documents have change detail, and a chevron that
always answered "nothing matches" is worse than no chevron.

## Caps, and a container

Activity lists were unbounded: the feed paged forever on scroll, and a busy document could push a
lens to arbitrary length.

```ts
export const FEED_EVENT_CAP = 100;     // matches Omega's activity.MaxLimit
export const RESOURCE_EVENT_CAP = 25;  // one resource's list, inside a panel
```

`FEED_EVENT_CAP` matches Omega's own `activity.MaxLimit`, so the client agrees with the backend's
ceiling rather than inventing one — **no backend request was needed; the cap already existed.** On
reaching it the feed says *Showing the latest 100 events*, which is deliberately different from
*You're all caught up*: "there is more, we stopped" and "that is everything" are different facts.

The lists sit in a height-capped, **bordered** scroller. The border is what makes clipping read as
deliberate rather than as content that ran out, and the scrollbar is left native rather than hidden
the way the main feed hides its own — inside a short nested section, an invisible scrollbar makes
the rest undiscoverable.

## The activity lens reordered; the resource lens lost two rows

The activity lens now runs **document → change → who and when → other activity**. Attribution moved
below the change because the feed row you clicked already named the actor; spending the top of the
panel on it repeats what you just read. `Edited by` also folds the action into the attribution
label, which removed a real ambiguity from the first cut — a heading "Created" (the action) sitting
above a field "Created" (the creation date).

The resource lens dropped **Created** and **Access**. Created sat directly above Updated and was
rarely the interesting one; two timestamps competing for the same glance is noise. Access answers a
permissions question, and this lens answers "what is this and what has been happening to it" —
it is also read-only here while the settings dialog can actually change it. Removing it retired
`accessSummary`, which nothing else used.

## Gates

`pnpm check` 0/0 · `pnpm test` **385 passed** (32 files; +16 change-detail, −4 accessSummary) ·
`pnpm build` clean · companions OK for all 13 touched/added sources · **e2e 26/26**.

## Follow-up: a Sharing section in the resource lens

The one-line *Access* row this pass removed came back as something better: **owner → Share → who has
access**, between the identity block and Recent activity, in the same shape the library's asset
details use so the two read as one convention.

The Share button appears only when the user can actually share:

```ts
const canShare = $derived(
  !!resource && resource.kind === 'document' &&
    (!resource.creatorId || resource.creatorId === currentUserId())
);
```

Omega permits only a resource's owner to change access (`SetAccess` → `ErrNotOwner`), so for anyone
else the control would be a button that fails — they get the owner and the reach as facts instead.
The e2e asserts both halves: the owner sees it, and a non-owner inspecting a resource they *can* see
does not.

The editor behind it is a new `stages/shared/ResourceSharing.svelte`, extracted from
`ResourceSettingsDialog` rather than written twice. That dialog's inline access block — ~85 lines of
markup plus its state and three handlers — is now one line, and both surfaces render the same
component. It is the arrangement `ProjectSharing` already has with project Share / settings, chosen
for the same reason: two copies of a permissions editor is how they drift, and drift in a
permissions editor is a security bug.

Member and organization names are resolved only for a restricted resource; a project-wide one reads
"Everyone in the project" and needs no roster.
