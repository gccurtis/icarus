# `ActivityLens.svelte`

The lens for one inspected activity event — reached by clicking an entry in the Overview activity
feed. It answers, in this order: **which document, what changed, who and when.**

## The order is the design

1. **The document**, with the way back to it. What the event happened to comes first because it is
   what orients you.
2. **The change** — the reason the click happened, answered without a second gesture.
3. **Who and when** — `Edited by`, then the timestamp. Attribution comes *after* the change because
   the feed row you clicked already named the actor; repeating it at the top spends the most
   valuable position on something you just read.
4. **Other activity on this resource**, last.

An earlier cut led with the action and actor and put a timeline where the change now sits. That was
the wrong emphasis: you click one edit to learn what *that* edit was, and you are already looking at
a feed, so a second timeline competes with the answer.

## Three states for the target

```ts
const live = $derived($resources.find((r) => r.id === event.target.id) ?? null);
const deleted = $derived(!redacted && !live);
```

Present in the access-filtered catalog means it still exists and is visible. Absent but **not**
redacted means the feed proved it was deleted, so there is nothing left to query. Redacted means the
user is not entitled to know what the target was — that branch replaces the document block entirely
and stops there: no change, no other activity.

The lens takes `redacted` as a prop rather than deciding for itself. `ActivityFeed` owns the access
rule, and one owner means the row and its lens can never disagree about whether a name is safe. This
file imports only `REDACTED_LABEL` — the word to draw — and it comes from
[`features/shared/activity-access.ts`](../../../shared/activity-access.ts.md) since 2026-07-29, when
the rule moved there for the context rail's History lens (the shell cannot import from a stage).

## The change

```ts
if (target.kind !== 'document') return;
change = { state: 'loading' };
void loadEventChange(target.id, current).then(…)
```

A document `edited` event is exactly one change set (see
[`change-lookup.ts`](../change-lookup.ts.md) for why), so this shows *the* change rather than a list
of the document's recent ones. Rendering is delegated to
[`ChangeDetail`](ChangeDetail.svelte.md), which the expandable rows below also use, so the same
change looks the same wherever it appears.

`{#if change}` guards the whole section, so non-document kinds get no empty "Change" heading.

## Attribution

```svelte
<span>{actionTitle(event.action)} by</span>
```

Reads "Edited by" / "Renamed by" / "Created by" — the action and the attribution in one label rather
than a standalone action heading. That also removed a genuine ambiguity from the first cut, where a
heading "Created" sat above a field "Created": the event's action and the resource's creation date,
two meanings under one word.

## Other activity, last and expandable

Capped at `RESOURCE_EVENT_CAP` and rendered through [`ActivityList`](ActivityList.svelte.md), with
the inspected event filtered out — it is the subject of everything above. Rows **expand in place**
rather than swapping the lens to that event: the panel is about the event you chose, and the list
can only reach events already loaded, so treating it as navigation would promise reach it does not
have.
