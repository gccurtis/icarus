# Rich Content API

Eleven functions. Ten write; one reads.

| Function | Effect | Remote form | Directory |
| --- | --- | --- | --- |
| [`create`](create/create.md) | mutator | `command` | `create/` |
| [`display`](display/display.md) | **reader** | `query` | `display/` |
| [`replaceText`](replace-text/replace-text.md) | mutator | `command` | `replace-text/` |
| [`applyStyle`](apply-style/apply-style.md) | mutator | `command` | `apply-style/` |
| [`removeStyle`](remove-style/remove-style.md) | mutator | `command` | `remove-style/` |
| [`setLink`](set-link/set-link.md) | mutator | `command` | `set-link/` |
| [`removeLink`](remove-link/remove-link.md) | mutator | `command` | `remove-link/` |
| [`setList`](set-list/set-list.md) | mutator | `command` | `set-list/` |
| [`removeList`](remove-list/remove-list.md) | mutator | `command` | `remove-list/` |
| [`split`](split/split.md) | mutator | `command` | `split/` |
| [`combineAsList`](combine-as-list/combine-as-list.md) | mutator | `command` | `combine-as-list/` |

## One read, and why that is the whole shape

`display` is the only function that returns content, and every mutation returns
only an id and a revision.

That is not parsimony. A mutation result carrying the new projection would be a
second way to obtain segment handles, and handles are the thing this capability
is careful about — they are what a caller uses to address a position, and they
are only safe because they name a position *in a revision*. One source for them
means one place that checks them.

It also makes the refresh behaviour right for free: kit re-runs queries after a
command resolves, so a view holding `display` gets the new projection without
arranging anything.

## The shape every mutation shares

```text
validate the input        ← before any read, so a bad payload costs no round trip
currentContent(...)       ← load, and refuse a revision the caller did not expect
resolve the display range ← the only inbound crossing of the display boundary
compute new marks/atoms   ← pure, over Raw Content
commit(...)               ← compare-and-swap, or stale-version
```

Only [`split`](split/split.md) and
[`combineAsList`](combine-as-list/combine-as-list.md) depart from it, because
they replace whole objects rather than revise one — and both do it inside a
transaction.

## The boundary, stated once

Every function has a `.remote.ts`, and all eleven wrappers are the same two
lines:

```ts
const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
return theProcedure(scope, request);
```

`resolveScope` looks the project token up **within the asking session's user**,
so a token that user does not hold resolves to no project and the call is a 404.
Below that line the token no longer exists and the procedure has a `Scope` it
cannot have been talked out of. Authentication and membership checking land on
`resolveScope`; nothing in this directory changes when they do.

`stated` wraps each body so a `RichContentError` reaches the browser as a `400`
carrying its code, rather than the `500` kit would otherwise produce.

## Admission

Remotes are declared `'unchecked'`, so **each function owns validating what it
receives.** The checks that matter most are in
[`shared/display-range.ts`](shared/display-range.ts), because every position a
browser sends comes through it: a stale or invented segment id, a non-integer or
out-of-bounds offset, an offset splitting a surrogate pair, and a reversed range
are all refused there.

## Where the SQL lives

In [`shared/revisions.ts`](shared/shared.md), because every function needs the
same four operations and they are one concern — reading a content object at a
revision and replacing it only if that revision still holds.

That is the ordinary promotion rule, not an exception to it. There is no store
class and no `queries.ts`.
