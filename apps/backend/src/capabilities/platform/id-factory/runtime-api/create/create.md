# API: `create`

Lives at `runtime-api/create/create.md`.

Returns one identifier value. Called by a capability's own semantic factory —
Rich Content's `contentId()`, `atomId()`, `markId()`, and `listId()` each call
it once and prefix the result — rather than by a procedure directly. A procedure
that called this itself would be minting identity outside the one object its
capability made responsible for identity.

## Classification

- **Owner:** `IdFactory`
- **Execution:** accessor
- **Transaction:** none
- **Entry:** [`create.ts`](create.ts)

## Inputs

None. A caller that wants a kind, a prefix, or a namespace applies it to the
returned value; passing one in would move that decision here.

## Output

`string`

A value distinct from every value this or any other runtime has returned. Its
shape is a v4 UUID today and is not part of the contract: a consumer stores it,
compares it for equality, and never parses it.

## Failures

None. `randomUUID` draws from the platform CSPRNG and does not fail in normal
operation; a failure of the entropy source throws and the process is already
lost.

## Effects

None. The call reads no state, writes no state, and leaves nothing behind — two
consecutive calls differ only in the value returned, not in anything observable
about the object.

## Procedure Tree

```text
1. Return randomUUID().
```

The procedure is one line and still lives in its own directory. That is the
template working as intended rather than ceremony: the file is where a reader
looks for the generation scheme, and the day it stops being one line — a
node-prefixed sequence, a sortable ID — the change lands in the place the
document already points at.

## Supporting Procedures

None.

## Shared Procedures Used

None.
