# API: `setLink`

Points a display selection at one or more link targets.

## Classification

- **Effect:** mutator
- **Transaction:** none — one compare-and-swap
- **Entry:** [`set-link.ts`](set-link.ts)
- **Browser-reachable:** yes, via [`set-link.remote.ts`](set-link.remote.ts) — a `command`

## Signature

```ts
export const setLink = async (
  scope: Scope,
  input: SetLinkInput
): Promise<ContentMutationResult>;
```

## Links replace; styles layer

Unlike [`applyStyle`](../apply-style/apply-style.md), this cuts out any link
already covering the range before appending the new one.

Text pointing at two places at once is not something a reader can act on. Styles
compose — bold and italic together mean something — and links do not.

## A resource target stores the reference, not a rendered href

`{ kind: "resource", resourceKind, resourceId, locator? }` keeps what the link
*means*. A stored href would be wrong the moment the route it was rendered
against changed, and this capability has no business knowing that route.

## Targets are copied

`validateAndCopyTargets` rebuilds each target field by field. That drops anything
extra a payload carried, and severs the reference to the caller's array — a
stored mark sharing it could change under the content.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-link` | no targets, an empty href, or a resource target missing its kind or id |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller |
| `invalid-display-range` | the selection is stale, invalid, splits a character, is reversed, or is empty |

## Procedure Tree

```text
setLink(scope, input)
├── record("setLink", { contentId, targetCount })          ../shared/record.ts
├── validateAndCopyTargets(input.targets)                  ../shared/link.ts
├── projectDatabase(scope.projectId)                       $model/server/index.server
├── currentContent(database, contentId, expectedVersion)   ../shared/revisions.ts
├── resolveDisplayRange(current, input.range)              ../shared/display-range.ts
├── requireNonEmptyRange(current, range)                   ../shared/display-range.ts
├── setLinkMark(current, range, targets)                   ../shared/link.ts
│   ├── removeLinksFromRange(current, range)               ../shared/link.ts
│   └── markId()                                           ../shared/ids.ts
├── nextRevision(current, { marks })                       ../shared/revisions.ts
└── commit(database, current, candidate)                   ../shared/revisions.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `link` | `setLink` and `removeLink` must agree on what covering a range means |
| `display-range` | every position a browser sends is checked in one place |
| `revisions` | the revision gate and the compare-and-swap |
| `record` | the target count is recorded; no href and no text is |
