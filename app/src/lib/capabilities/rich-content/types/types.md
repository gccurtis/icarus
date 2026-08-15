# Types

Seven files, split by which side of two boundaries a type lives on: the remote
boundary, and the display boundary.

| File | Holds | Seen by |
| --- | --- | --- |
| [`raw-content.ts`](raw-content.ts) | `RawAtom`, `RawMark`, `RawContent`, `RawPosition`, `RawRange`, `RawLine` | **nobody outside this capability** |
| [`display-content.ts`](display-content.ts) | `DisplayContent` and everything in it | consumers, through `display` |
| [`formatting.ts`](formatting.ts) | `StyleProperties`, `ResolvedStyle`, `LinkTarget`, `ListPresentation` | both of the above |
| [`ids.ts`](ids.ts) | the five identifier aliases | everyone |
| [`inputs.ts`](inputs.ts) | the eleven functions' inputs | server callers |
| [`results.ts`](results.ts) | `ContentMutationResult`, `SplitContentResult` | everyone |
| [`requests.ts`](requests.ts) | the eleven browser-facing shapes | the browser, through the remote wrappers |

## Raw Content is private, and this is the reason

Neither door re-exports it. Not `index.server.ts`, not `index.ts`.

A consumer holding a `RawAtom` or a `RawMark` would depend on a representation
this capability reserves the right to change — which is the ordinary reason to
keep something private. The stronger reason is that it would be able to construct
a `RawPosition` the runtime never validated: an offset inside an atom that does
not exist, or one splitting a surrogate pair.

Consumers receive `DisplayContent` and hand back opaque handles, which
[`display-range`](../api/shared/display-range.ts) checks on the way in. A
two-door split makes it easy to widen a door by accident, so this is restated in
`overview.md` as well.

## Display Content is derived, never stored

Marks are overlapping ranges in `raw-content.ts` — a bold span and a link span
can cross without either being split. `DisplayContent` is the flattened form,
recomputed on every read.

That is what lets the private representation change without migrating anything,
and it is why line and segment ids **embed the content version**: a handle taken
from one revision cannot address a later one, so a stale selection is refused
rather than applied somewhere it does not belong.

## Input and request differ by one field

A request carries a **project token**; a procedure input does not.

A client instance must name which project it is talking about, because a remote
function cannot see the page that called it — kit serves them all from
`/_app/remote/…` with empty route params. But the token is a *reference*, not
authority: it is resolved within the asking user's own handles, and one that is
not there resolves to no project at all.

By the time a procedure runs the token is gone and a `Scope` has taken its place.
Writing that as two families rather than one optional field means the distinction
cannot be lost by someone adding a field to the wrong interface.

**Nothing here names a user.** That comes only from the session cookie.

## Every mutation input carries a revision

`expectedVersion` is on all nine mutation inputs, and it is what makes handing
out display handles safe at all: a handle names a position *in a revision*, and
the revision is checked before the position is used.
