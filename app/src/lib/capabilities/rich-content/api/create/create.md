# API: `create`

Creates a content object, optionally from plain text.

## Classification

- **Effect:** mutator
- **Transaction:** none — one insert
- **Entry:** [`create.ts`](create.ts)
- **Browser-reachable:** yes, via [`create.remote.ts`](create.remote.ts) — a `command`

## Signature

```ts
export const create = async (
  scope: Scope,
  initialText?: string
): Promise<ContentMutationResult>;
```

Positional rather than an input object: there is one thing to pass, and an object
would only give it a second name.

## Every line gets exactly one text atom

Newlines in `initialText` become line-break atoms, and a text atom is emitted on
both sides of each — including trailing and empty lines.

That uniformity is a load-bearing invariant, not tidiness. `rawLines` derives a
line from atom order and `lineRange` needs a first and last text atom to produce
a range; a line with none has no range and `lineRange` throws rather than guess.

## Output

`ContentMutationResult` — id and version `1`. A caller that wants to render it
asks [`display`](../display/display.md).

## Failures

None. Any string is content, including an empty one.

## Procedure Tree

```text
create(scope, initialText)
├── record("create", { textLength })    ../shared/record.ts
├── projectDatabase(scope.projectId)    $model/server/index.server
├── contentId()                         ../shared/ids.ts
├── createRawContent(id, initialText)   create-raw-content.ts
│   └── atomId()                        ../shared/ids.ts
├── insertContent(database, content)    ../shared/revisions.ts
└── resultOf(content)                   ../shared/revisions.ts
```

## Supporting Procedures

| Procedure | Responsibility | File |
| --- | --- | --- |
| `createRawContent` | builds version-1 content from text, one text atom per line | [create-raw-content.ts](create-raw-content.ts) |

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `ids` | a content object and its atoms need identity before they can be stored |
| `revisions` | the insert, and the one result shape every mutation reports |
| `record` | the text length is recorded; the text never is |
