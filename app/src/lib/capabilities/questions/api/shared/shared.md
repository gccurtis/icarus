# Shared Questions Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-question.ts`](require-question.ts) | that a question id names a question in the caller's project, and that a caller learns nothing from the answer when it does not |
| [`resolve-parent.ts`](resolve-parent.ts) | that a parent is a question in the same project, and that no question sits below itself |

## `requireQuestion`

Every function taking a question id starts with it. **It throws "not found",
never "forbidden"** — a question in another project answers exactly as one that
never existed, because telling them apart confirms what somebody else is trying
to find out.

Its return type is the stored row: its callers are inside this capability and
want the fields they are about to patch, check, or log.

## `resolveParent`

`ask` and `revise` both set a parent, and it is promoted rather than copied
because the invariant spans them: the tree either stays a tree or it does not.

**It walks the whole line of ancestors** rather than comparing the parent alone.
A cycle further up makes a subtree with no root — invisible in a tree view, and a
traversal that does not end — and only `revise` can create one, which is why the
child id is optional: nothing new can be its own ancestor.
