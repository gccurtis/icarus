# API: `display`

The public projection of one content object. **The only function that returns
content.**

## Classification

- **Effect:** reader
- **Transaction:** none
- **Entry:** [`display.ts`](display.ts)
- **Browser-reachable:** yes, via [`display.remote.ts`](display.remote.ts) — the capability's only `query`

## Signature

```ts
export const display = async (
  scope: Scope,
  id: RichContentId
): Promise<DisplayContent>;
```

## Why every mutation goes through here for its handles

A mutation returns only an id and a revision, so this is the single place a
caller obtains segment handles.

That matters because handles are the thing this capability is careful about. A
handle is safe to give out only because it names a position **in a revision** —
segment ids embed the version they were rendered at, so one taken here and used
after someone else's write simply is not found, and
[`display-range`](../shared/display-range.ts) refuses it. One source for handles
means one place that checks them.

## Derived, never stored

Marks are overlapping ranges in storage, which is what lets a bold span and a
link span cross without either being split. The projection flattens them on every
read: segments are cut at each offset where formatting changes, so a segment's
style is uniform across its whole text.

The cost is recomputing on every read; the benefit is that the private
representation can change without migrating a stored projection.

## Output

`DisplayContent` — lines, each with optional list presentation and a list of
segments carrying text, resolved style, and links.

## Failures

| Error code | Cause |
| --- | --- |
| `content-not-found` | no content object has that id |

## Procedure Tree

```text
display(scope, id)
├── record("display", { contentId })     ../shared/record.ts
├── projectDatabase(scope.projectId)     $model/server/index.server
├── requiredContent(database, id)        ../shared/revisions.ts
│   └── loadContent(database, id)        ../shared/revisions.ts
└── renderDisplayContent(content)        ../shared/render-display.ts
    ├── rawLines(content)                ../shared/raw-lines.ts
    ├── listMarkForLine(content, line)   ../shared/raw-lines.ts
    └── rangeContains(content, a, b)     ../shared/ranges.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `revisions` | the read, and the `content-not-found` refusal every function shares |
| `render-display` | the projection itself |
| `record` | the id is recorded; not one word of the text is |
