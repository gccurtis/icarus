# API: `create`

Creates one content object from plain text. This is the only way a content
object comes into existence from nothing; `split` and `combineAsList` also
produce objects, but from ones that already exist.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single insert
- **Entry:** [`create.ts`](create.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `initialText` | `string` (optional) | Plain text. Newlines become logical line boundaries. Omitted or `""` yields one object with a single empty line. |

There is no `expectedVersion`: nothing exists yet to be stale.

## Output

`ContentMutationResult` — the new `contentId` and `version`, which is always
`1`. The caller reads the content back with `display(contentId)`.

## Failures

None specific to this method. Any text is accepted, including text with no
newlines, only newlines, or none at all.

## Effects

- Inserts one `rich_content` row at revision 1.
- Allocates one content ID and one atom ID per line, plus one per line break.

## Procedure Tree

```text
receive initialText
  1. ids.contentId()
  2. createRawContent(id, initialText, ids)
     2.1. split the text at "\n"
     2.2. append one TextAtom per resulting line
          || not the last line
             2.2.a.1. append a LineBreakAtom after it
     2.3. return version-1 content with no marks
  3. store.create(content) — a single INSERT
  4. return resultOf(content)
```

Every line gets a text atom even when it is empty, which is what keeps "each
line has at least one addressable atom" true for blank lines and for a trailing
newline.

## Supporting Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `createRawContent` | Turns plain text into version-1 atoms. | [create-raw-content.ts](create-raw-content.ts) |

It stays here rather than in `shared/` because `create` is its only caller
inside the capability. The store's own tests also use it, to build fixture
content without going through the runtime.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `resultOf` | Reports identity and revision only, like every other mutation. |
