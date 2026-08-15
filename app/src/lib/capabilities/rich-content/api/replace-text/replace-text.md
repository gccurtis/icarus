# API: `replaceText`

Replaces a range of text within one atom.

## Classification

- **Effect:** mutator
- **Transaction:** none — one compare-and-swap
- **Entry:** [`replace-text.ts`](replace-text.ts)
- **Browser-reachable:** yes, via [`replace-text.remote.ts`](replace-text.remote.ts) — a `command`

## Signature

```ts
export const replaceText = async (
  scope: Scope,
  input: ReplaceTextInput
): Promise<ContentMutationResult>;
```

## The only function taking an atom range

Every other mutation takes a `DisplayRange`. This one takes an `atomId` and an
`AtomTextRange`, because text editing is inherently per-atom — and a display
segment already reports the atom and offsets it came from, so a caller has both
without learning anything new.

## The atom keeps its id

An edit rewrites the atom's text in place rather than replacing the atom. That is
what lets a display handle for a *neighbouring* atom stay meaningful across the
edit, and what lets a list mark keep covering its whole line.

Mark boundaries inside the edited atom move in three cases: before the replaced
span they do not move, after it they shift by the length difference, and inside
it they collapse to an edge — start to the beginning of the replacement, end to
the end of it. Without that last case a mark would keep pointing into text that
no longer exists.

A list mark covering the whole atom is re-stretched instead, because it means
"this line" rather than a character range.

## A line break in the replacement is refused

Splitting an atom into two around a new break means deciding what happens to
every mark spanning the new boundary. That is not settled, and `unsupported-text`
is honest about it rather than guessing.

## Failures

| Error code | Cause |
| --- | --- |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller — re-read `display` and retry |
| `atom-not-found` | no atom in this content has that id |
| `invalid-atom-range` | the range is not integral, is reversed, is out of bounds, splits a surrogate pair, or the atom is not text |
| `unsupported-text` | the replacement contains a line break |

## Procedure Tree

```text
replaceText(scope, input)
├── record("replaceText", { contentId, atomId, textLength })  ../shared/record.ts
├── projectDatabase(scope.projectId)                          $model/server/index.server
├── currentContent(database, contentId, expectedVersion)      ../shared/revisions.ts
├── replaceAtomText(current, input)                           replace-atom-text.ts
│   ├── reject a line break as unsupported-text
│   ├── validate the atom and its range
│   └── move every displaced mark boundary
├── nextRevision(current, changes)                            ../shared/revisions.ts
└── commit(database, current, candidate)                      ../shared/revisions.ts
```

## Supporting Procedures

| Procedure | Responsibility | File |
| --- | --- | --- |
| `replaceAtomText` | rewrites one atom and moves every mark boundary the edit displaced | [replace-atom-text.ts](replace-atom-text.ts) |

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `revisions` | the revision gate and the compare-and-swap every mutation shares |
| `record` | the replacement length is recorded; the text never is |
