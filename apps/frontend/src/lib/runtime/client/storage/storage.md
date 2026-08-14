# Storage

What survives a reload, and the only file that knows where it is kept.

`localStorage`, not a cookie. A cookie would only have been needed to be readable
during server rendering, and `/app` is client-rendered — see
[`client.md`](../client.md). `localStorage` has no 4KB limit, needs no server
load, and is read synchronously at construction, so the panels are their stored
width in the first paint rather than snapping to it afterwards.

## The split

| File | Holds |
| --- | --- |
| `types.ts` | The wire shape, importing nothing |
| `serialize.ts` | `decode` / `encode`. Pure — no DOM, no `$app/*`, no runes |
| `index.ts` | The object, the guarded accessor, and the two `localStorage` calls |

`serialize.ts` is where every decision actually lives, and being pure is what
lets it be tested directly rather than through a fake DOM. The browser half is
two lines around `window.localStorage`, wrapped in try/catch because
`localStorage` *throws* rather than returning null when site data is blocked —
and a panel width is not worth taking the application down over.

## Nothing here throws on bad input

What is read was written by an older build, edited by hand, or corrupted.
Absent and malformed are deliberately the same case: both mean "start from
defaults", and the next write repairs the store because the whole document is
rewritten each time.

A version mismatch **discards rather than migrates**. This is a cache of panel
widths and open tabs; being wrong costs one re-drag, and migration code for it
would outlive its usefulness.

## What is deliberately not stored

**Session ids.** They are minted by a counter, so a stored id is meaningless on
the next boot — and a restored `session-1` colliding with a freshly minted
`session-1` makes lookups return the wrong tab. Tabs are stored as resource refs
and replayed through `open()`, which is the same path a click takes and already
dedupes on kind and id. The permanent overview tab is reconstructed, not stored.

**`inspection` and `scrollTop`.** An inspection names block ids and character
offsets in a document that may have changed since. `SessionOptions`' own comment
already says what dies with the tab; this is that line, enforced.

## What it validates, and what it does not

Storage checks that a value *could be* what it claims — an integer width, two or
three strings for a tab — and drops what could not. It does **not** clamp to a
panel's minimum or maximum: that is policy, it belongs to the component that
enforces the drag, and putting it here would put the same number in two places.

It also does not know what a `ResourceKind` is. Doing so would make the stored
format follow every domain change; the workbench drops tabs whose kind it no
longer recognises.

## Writes are coalesced

Opening a tab touches the tab list and the active ref — two mutations, one user
action. Writes are batched with `queueMicrotask` so that costs one serialization
rather than two. A microtask rather than a timer means nothing is ever left
pending at unload, so there is nothing to close.
