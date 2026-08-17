# Change set

One accepted mutation to a general resource: a group of operations, coalesced so
that what remains is the minimal set of changes actually made.

A change set is the unit of everything. It is what gets validated, what gets
accepted, what becomes a revision, and what gets undone.

```ts
interface ChangeSet {
  projectId: Id<"projects">;
  resourceType: "document" | "slides" | "spreadsheet";
  resourceId: string;
  revision: number;            // this set's index; unique per resource
  baseRevision: number;        // the revision it was authored against
  tier: "recent" | "historical";
  ops: Op[];
  touched: string[];           // every id these ops address
  actor: Actor;
  at: number;
}

type Op =
  | { op: "set";    target: OpTarget; path: string; value: unknown; was: unknown }
  | { op: "insert"; target: OpTarget; path: string; after: string | null; values: unknown[] }
  | { op: "remove"; target: OpTarget; path: string; ids: string[]; after: string | null; values: unknown[] }
  | { op: "move";   target: OpTarget; path: string; id: string; after: string | null; wasAfter: string | null }
  | { op: "text";   target: "atom";   path: string; at: number; insert: string; remove: string };

type OpTarget =
  | "row" | "block" | "atom" | "mark"            // document, and content anywhere
  | "slide" | "element" | "section"              // slides
  | "sheet" | "cell" | "range" | "mergedCells"   // spreadsheet
  | "field";                                     // a structural field: page setup, styles, theme
```

## Sets, not individual operations

Typing a sentence, deleting half of it, and pasting a replacement is dozens of
operations and one change. The client accumulates operations as they happen and
folds them before submitting:

- consecutive `text` ops on one path merge into a single splice
- an `insert` later undone by a `remove` of the same values cancels to nothing
- repeated `set` ops on one path collapse, keeping the first `was` and the last
  `value`
- any op inside a subtree that the same set later removes is dropped

What arrives is a minimal set of orthogonal changes. That matters for storage,
but it matters more for **merging**: fewer touched paths means a higher chance
that [nothing intersects](#touched) and a concurrent edit applies instead of
being rejected. Coalescing is a correctness-adjacent optimization, not just a
size one.

The folding is client-side. The model's obligation is to make it possible — the
set is validated and accepted atomically, and nothing depends on seeing the
intermediate states that were folded away.

## Revision is an index

`revision` is the change set's position in the resource's sequence. Not a
timestamp, not a hash — the first accepted set is 1, the next 2, and the
resource's current revision is the last one.

`baseRevision` is what its author was looking at when they made it. For an
uncontended edit the two differ by one.

A conventional CAS stores only the base and compares it to current, answering
"has anything changed". Keeping both turns it into "has anything *conflicting*
changed", which is the entire reason this model exists.

## The resource has no revision field

Current revision is the highest change set revision for that resource, read from
an index. It is deliberately not stored on the resource row.

If it were, every edit would have to patch the resource — and a Convex patch
rewrites the whole document, including the body. A large document would be
rewritten on every keystroke batch. Keeping revision out of the row means a
mutation writes one small change set row and nothing else.

**Concurrency is handled by the transaction, not by a version field.** Convex
mutations are serializable with optimistic concurrency control: read the current
maximum revision, insert one above it, and either the transaction commits against
the state it read or it is re-run against the state that beat it.

There is no unique index doing this — [Convex has
none](../../storage/README.md#there-are-no-unique-indexes) — and there is no
retry loop to write. The isolation level is the guarantee.

## Reading the current resource

Read the [head](resource-snapshot.md), read the change sets after its revision,
apply them in order.

The head is not current, by design. It advances only on consolidation, so the
number of sets to apply is bounded by the consolidation interval rather than by
how long the resource has existed.

## `target` says what kind of thing, `path` says which one

`path` alone under-specifies an op. `insert` after `#r4m1` with some `values` is
not self-describing: whether those values are rows, blocks, or slides can only be
learned by resolving the path against the body.

`target` names the kind directly, and three things depend on it:

**Validation.** `values` is `unknown[]` without it. With it, the stored shape is a
discriminated union — `target: "row"` means `DocumentRow[]`, `target: "block"`
means `ContentBlock[]` — so a malformed op is rejected at the boundary rather
than when something later tries to render it.

**Conflict checks.** The [check ladder](../../processes/change-conflicts.md)
pre-filters intervening ops by target and op kind. A row insert cannot conflict
with a mark edit, and knowing that without parsing paths is what makes the cheap
checks cheap.

**Reading a change set.** An op is legible on its own — "inserted an element after
`#e4`" — which matters for an audit log nobody can query their way out of.

Only certain pairings are legal:

| Target | `set` | `insert` | `remove` | `move` | `text` |
| --- | :-: | :-: | :-: | :-: | :-: |
| `row` | ● | ● | ● | ● | |
| `block` | ● | ● | ● | ● | |
| `atom` | ● | ● | ● | | ● |
| `mark` | ● | ● | ● | | |
| `slide` | ● | ● | ● | ● | |
| `element` | ● | ● | ● | ● | |
| `section` | ● | ● | ● | ● | |
| `sheet` | ● | ● | ● | ● | |
| `cell` | ● | | ● | | |
| `range` | ● | | | | |
| `mergedCells` | | ● | ● | | |
| `field` | ● | | | | |

`cell` takes no `insert` or `move` because cells are keyed by address rather than
ordered — setting `B7` is how a cell comes into being, and its address is its
position. `field` only takes `set`, because a structural field is replaced, never
reordered. `range` is a target because a path can address one: a formula's
operands and a print area both name a rectangle rather than a cell.

**`mergedCells`, not `merge`.** Every other target is a noun naming a thing;
`merge` read as the verb for the operation being performed on it.

**There is no `chart` target yet.** A chart needs a data range, an anchoring
model, and a rendering surface, none of which exists — so the target returns with
them rather than describing something that cannot be built. When it does, it
takes no `move`: a chart anchors to a cell with an offset and floats above the
grid, so repositioning it is a `set` on its anchor and there is no `after` for it
to move past.

**`text` targets literal atoms only.** A formula atom is changed by `set`ting its
`formulaId` — the expression is [a row of its
own](../../stage-0/0-foundation-design.md#formula--ids-and-immutability) and is
not in any block's display string, so there is nothing for a `text` op to reach
even by accident. That keeps the only in-place string edit in the system to one
kind of string, which is what makes [offset
shifting](../../processes/change-conflicts.md#the-precondition-reject-unless-it-is-plainly-text-on-text)
safe to attempt at all.

## The resource key is the pair, named once

**`(resourceType, resourceId)` is the full key, always.** Never the id alone —
two resources of different kinds may carry the same id, and every index, every
lookup, and every scope check uses both.

Ops carry neither. The change set names them once, and every op in it addresses
that one resource — a set spanning two resources is not a thing, because it could
not be applied atomically to either.

That is also why ids only need to be unique [within a
resource](../content/content-block.md#one-id-space-per-resource): the pair
supplies the outer scope, so `#b7x2` is unambiguous inside it.

## Paths

A `path` is `/`-separated segments. A segment is a field name, an array index, or
an **id reference** written `#id`:

| Path | Addresses |
| --- | --- |
| `page/margins/top` | a structural field |
| `#r4m1/proportions` | a row's column widths |
| `#b7x2/atoms/#a91` | one atom in one block |
| `#b7x2/marks/#m03` | one mark in one block |
| `#s12/elements/#e4/frame` | a slide element's position |
| `sheets/#sh1/cells/B7` | a cell, keyed by its address |
| `rows` | the ordered row list, for `insert`/`remove`/`move` |

Because ids are unique within the
[resource](../content/content-block.md#one-id-space-per-resource), an `#id`
segment resolves on its own and needs no path above it. `#b7x2/atoms/#a91` is
complete whether that block sits in a document row, a table cell, or a slide
element.

A string rather than an array of segments, so it can be compared and
prefix-matched directly — which is what the [removal containment
check](../../processes/change-conflicts.md#3--removal-containment) needs.

### Index transformation is gone

Positional paths made every concurrent insert a rewrite: an `insert` at index 2
shifted `blocks/4` to `blocks/5`, so applying an incoming change meant renumbering
it first.

With ids, inserting above `#b7x2` does not change the path to `#b7x2`. And since
the ordering ops [address positions by
id](#the-same-five-ops-serve-all-three-resources) rather than by index,
there is no index anywhere left to renumber. This transformation is not rare
now — it does not exist.

### Offset shifting is the one transformation left

Two people typing **inside the same atom** cannot be separated by identity — both
name the same id. That case is transformed rather than rejected: the later edit's
offset shifts by the earlier one's length delta, and genuinely overlapping
replacements still conflict.

The same arithmetic serves marks, whose offsets index the block's display string
and move when any text in the block does.

It runs **only where the delta is stated by the ops themselves** — literal text
edited against literal text. Anything that moved the string by an unstated amount,
a formula re-resolving above all, disqualifies the shift and the change is
rejected instead.

One function, fully specified in [change
conflicts](../../processes/change-conflicts.md#shifting-offsets), guarded by a
precondition, and the only thing anywhere that rewrites an incoming op.

## The same five ops serve all three resources

Ops address a location in a JSON tree and edit it. The three bodies are different
trees, and none of the operations knows or cares which:

| Intent | Op |
| --- | --- |
| Insert a document row | `insert` at `rows`, index 3 |
| Type in a paragraph | `text` at `#b7x2/atoms/#a91` |
| Bold a phrase | `set` at `#b7x2/marks/#m03` |
| Change a page margin | `set` at `page/margins/top` |
| Add a slide | `insert` at `slides`, index 2 |
| Move a slide element | `set` at `#e4/frame` |
| Set a cell | `set` at `sheets/#sh1/cells/B7` |
| Resize a column | `set` at `sheets/#sh1/columnWidths/B` |
| Merge cells | `insert` at `sheets/#sh1/merges` |
| Restyle every heading | `set` at `styles/heading1/fontSize` |
| Change the deck accent colour | `set` at `theme/colors/accent` |

The last two matter as much as the content edits. Restyling a document and
recolouring a deck are edits people expect to undo, and they work here for free
because the style set and theme are [inside the
body](resource-snapshot.md#body-is-a-union-on-resource-type) rather than on the
resource row.

Nothing needed a fourth resource-specific operation, and the reason is structural
rather than lucky: every body is a tree of records, arrays, and scalars, and
`set`/`insert`/`remove`/`move`/`text` is a complete edit vocabulary over that.

**The path already says what is being changed**, so the ops do not need to. A
typed vocabulary — `rowInsert`, `blockSet`, `atomEdit`, `themeSet` — would encode
in the op name what `rows/3/blocks/0/atoms/1` encodes in the path, and every new
field added to any body would need a new op type. Five untyped ops over a path
cover fields that do not exist yet.

Not every type uses every op. Sheets barely use `insert` and `move`, because
`cells` is a keyed map rather than an array. Uniformity means the op set covers
all three, not that all three exercise it evenly.

### The one case that fits awkwardly

Inserting a row into a spreadsheet rekeys every populated cell below it — `B6`
becomes `B7`, and so on. There is no single op for that.

It comes out as many per-key `remove` and `set` ops in one change set: large, but
bounded by *populated* cells below the insertion point rather than by the sheet's
declared extent, and coalesced before it is sent.

The coarse alternative — one `set` replacing the whole `cells` map — is smaller
on the wire and worse everywhere else. Its path is `sheets/0/cells`, a prefix of
every cell path, so it conflicts with every concurrent edit anywhere in the
sheet. The fine-grained version keeps cells *above* the insertion point on
disjoint paths, so someone editing there merges cleanly.

That is the trade the [conflict
checks](../../processes/change-conflicts.md) exist to exploit, and it is
worth paying a large op list for.

## Every op is invertible

Undo is a first-class requirement, so the op set is closed under inversion. Each
operation carries enough to reverse itself:

| Op | Inverse |
| --- | --- |
| `set` | `set` with `value` and `was` swapped |
| `insert` | `remove` with the same `values` and `after` |
| `remove` | `insert` with the same `values` and `after` |
| `move` | `move` with `after` and `wasAfter` swapped |
| `text` | `text` with `insert` and `remove` swapped |

This is why `remove` carries `values` rather than a count, why it carries the
`after` it was removed from, and why `text` carries the removed string rather
than a length. Undoing a delete has to reproduce what was deleted *and put it
back where it was*, and the alternative — reconstructing that by replaying from
the head — makes the cost of an undo depend on how long ago the change was.

Inverting a change set is inverting each op and reversing their order. The
result is an ordinary change set, submitted like any other, subject to the same
conflict checks. An undo is not a special operation; it is a change.

## `touched`

Every change set stores `touched` — the ids its ops address, each op contributing
the **deepest** id in its path:

| Op path | Contributes |
| --- | --- |
| `#b7x2/atoms/#a91` | `#a91` |
| `#b7x2/marks/#m03` | `#m03` |
| `#b7x2/style` | `#b7x2` |
| `page/margins/top` | `page/margins` |

Deepest, not every id along the way. Two people editing different atoms of one
paragraph would both list `#b7x2` if ancestors were included, and they do not
conflict — including ancestors would report a collision on every shared
container.

It is derivable from the ops and stored anyway: it is small, and it makes the
first conflict check a set intersection over short strings rather than a pass of
path parsing.

## Deciding a change

An incoming set applies unmodified, applies with its **string offsets shifted**,
or is rejected. Nothing else is ever rewritten.

The decision runs as an escalating ladder — identity intersection, removal
containment, then offset shifting — written out in [change
conflicts](../../processes/change-conflicts.md).

Rejection costs one round trip and loses no work: the client re-reads, reapplies
its pending edits, and resubmits.

Rules 1–3 stop deliberately short of a full operational transform. Overlapping
edits to the same text range conflict rather than being resolved by a tiebreak,
because silently merging two people rewriting the same sentence produces text
neither of them wrote.

**Rule 5 is the one that is expected to change.** Whether two edits conflict is
a question about paths, not about time, and rule 5 rejects on age alone. It
exists now because evaluating conflict requires the intervening sets to still be
in the hot tier, and keeping every set there forever is what the two-tier split
avoids. The window is
[configuration](../../../app/configuration/revisions.yaml), so it can be widened
without a model change while a better answer is worked out.

## Tier

Which side of the consolidation boundary the set sits on. `recent` sets are the
rebase window and are read on contended writes and on every resource read;
`historical` sets are the archive, read only when reconstructing a past
revision.

A field rather than two tables, so consolidation is a flag flip rather than a
copy-and-delete, and so reconstructing a revision spanning the boundary is one
indexed range read.

## Marks are not carried with text edits

A `text` op changes the display string, and [marks index that
string](../content/content-block.md#marks-index-the-display-string) — so every
mark after the edit moves.

That shift is a **consequence of applying the op**, computed by the server, not
something the change set carries. A text op contains no marks payload.

An earlier draft bundled a whole-array marks `set` with every text edit so the
two stayed consistent. It worked, and it made rebasing a text op mean rewriting
that payload too — turning a one-integer adjustment into a rewrite of a list.
Deriving the shift on apply removes it, and leaves [one
function](../../processes/change-conflicts.md#shifting-offsets) called in two
places: once when applying, once when rebasing.

Undo still works, because inverting a text op inverts its delta, and applying the
inverse shifts the marks back by the same rule.

## Actor

The shared [`Actor`](../core/actor.md) type, not a user id, because agents,
automations, and connectors edit resources too. An agent change points at its
task, so "why did this paragraph change" is one hop away.

It is the reference form and never the label — a display string on every change
set would be duplicated thousands of times per document and would go stale the
moment someone is renamed.

Two things depend on this field:

**Undo** reverts sets where the actor is the person undoing, and no others. See
[undo scopes on the actor](../core/actor.md#undo-scopes-on-the-actor).

**Attribution** survives consolidation. Change sets move to the `historical`
tier rather than being discarded, so who wrote a given paragraph stays
answerable for as long as history is retained.

Actor is here as well as in [activity](../collaboration/activity.md) because
activity is deliberately coarse: a burst of editing is one activity entry and
many change sets.

## Related

[resource snapshot](resource-snapshot.md) · [revisions](README.md) ·
[document](../general-resources/document.md) ·
[activity](../collaboration/activity.md)
