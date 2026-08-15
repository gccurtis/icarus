# API: `applyStyle`

Applies style properties across a display selection.

## Classification

- **Effect:** mutator
- **Transaction:** none — one compare-and-swap
- **Entry:** [`apply-style.ts`](apply-style.ts)
- **Browser-reachable:** yes, via [`apply-style.remote.ts`](apply-style.remote.ts) — a `command`

## Signature

```ts
export const applyStyle = async (
  scope: Scope,
  input: ApplyStyleInput
): Promise<ContentMutationResult>;
```

## Styles layer

This **appends** a mark rather than merging into what is already there, and later
marks win at render time.

That is what makes [`removeStyle`](../remove-style/remove-style.md) reveal the
older style underneath rather than leaving unstyled text — the earlier
instruction is still recorded, so removing the newer one uncovers it.

## Admission before the read

`validateStyle` runs before the content is loaded, so an invalid payload costs no
database round trip and reports the property that was wrong. It also drops
`undefined` entries: `{ bold: undefined }` from a caller spreading an object
would otherwise store a property claiming to say something and saying nothing.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-style` | no properties, an unknown property, or one whose value has the wrong type |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller |
| `invalid-display-range` | the selection is stale, invalid, splits a character, is reversed, or is empty |

## Procedure Tree

```text
applyStyle(scope, input)
├── record("applyStyle", { contentId, expectedVersion })   ../shared/record.ts
├── validateStyle(input.properties)                        ../shared/style.ts
├── projectDatabase(scope.projectId)                       $model/server/index.server
├── currentContent(database, contentId, expectedVersion)   ../shared/revisions.ts
├── resolveDisplayRange(current, input.range)              ../shared/display-range.ts
├── requireNonEmptyRange(current, range)                   ../shared/display-range.ts
├── addStyleMark(current.marks, range, properties)         ../shared/style.ts
│   └── markId()                                           ../shared/ids.ts
├── nextRevision(current, { marks })                       ../shared/revisions.ts
└── commit(database, current, candidate)                   ../shared/revisions.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `style` | `applyStyle` and `removeStyle` must agree on what a style property is |
| `display-range` | every position a browser sends is checked in one place |
| `revisions` | the revision gate and the compare-and-swap |
| `record` | the id and expected revision are recorded; no text is |
