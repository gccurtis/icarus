# Derived Output Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`derived-output.ts`](derived-output.ts) | `derivedInputValidator`, `inputRevisionValidator`, `derivedStateValidator`, the `DerivedOutput` contract, and the canonicalizers `derivedPrompt`, `derivedInputs`, and `derivedBlock` |

One file, because every type here is a part of one object and none of them is
read without the others.

## `DerivedInput` and `InputRevision` are not the same shape

The first is what an output is derived **from**; the second is where each of
those **stood** when it was generated. They deliberately do not correspond one to
one:

| Declared | Recorded | Because |
| --- | --- | --- |
| `resource` (document, slides, spreadsheet) | `resource` with a revision | the body is edited in place, so its revision is the comparison |
| `finding` | `resource` with a revision | a finding is a resource kind whose writeup is revised in place |
| `file` | `file`, id only | bytes are immutable; a replacement is a different row, so the id *is* the revision |
| `question` with `includeFindings` | one `finding` per linked finding | what a question contributes is which findings hang off it, and that membership is what moves |
| `question` without it, `lattice` | nothing | the asking is not the material, and a query is not a set |

That is why `InputRevision`'s resource member takes the whole `ResourceKind`
union where the declared one takes the three general resources, and why the
`finding` member carries no revision: it records membership, not content.

## The state validator has five members and the prompt block's has four

`idle` is a declaration nothing has been asked of yet. A block is written into a
body by asking for content, so it never has that state — the prompt block's four
are this list minus `idle`, written out in [`content`](../../content/types/block.ts)
rather than imported, because the union of a subset cannot be derived from a
validator without rebuilding it.

## The canonicalizers refuse rather than repair

`derivedPrompt` refuses a blank prompt, `derivedInputs` refuses a lattice input
that could retrieve nothing, and `derivedBlock` refuses a list. Each is a state
that would otherwise be stored and then silently do nothing at generation time —
a prompt that generates nothing, a query that matches nothing, and a body that
would have to be truncated to fit the one position it is going into.
