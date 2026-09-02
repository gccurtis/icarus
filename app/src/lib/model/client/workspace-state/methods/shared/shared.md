# Shared Workspace State Methods

Lives at `methods/shared/shared.md`.

Nine modules. Seven are methods promoted because a second public method needed
them and they preserve an invariant spanning both. Two are not methods at all.

| File | Invariant it preserves | Used by |
| --- | --- | --- |
| [`apply.ts`](apply.ts) | One op, one effect — the only place an op becomes a change | `perform`, `undo`, `redo` |
| [`perform.ts`](perform.ts) | Nothing changes without leaving a record | every mutator, `land-on` |
| [`landing.ts`](landing.ts) | The `was` half of a landing is read the same way every time | `land-on`, `open` |
| [`defaults.ts`](defaults.ts) | A category is permanent or it is not, and every tab starts the same width | `close`, `target-key`, `mint-view`, `index.ts`, the definition's constructor |
| [`rails.ts`](rails.ts) | The rail position is one this category offers | `select-context`, `land-on`, `mint-view`, the definition's `context` getter, `index.ts` |
| [`compose.ts`](compose.ts) | A record and a view are read as one tab, in one place | `open`, `reopen-closed`, the definition's four read getters |
| [`land-on.ts`](land-on.ts) | A centre change takes its inspection with it and leaves the rail | `show-content`, `open` |
| [`mint-view.ts`](mint-view.ts) | Every tab starts the same way | the definition's constructor, `open` |
| [`target-key.ts`](target-key.ts) | One definition of "already open" | `open` |

## Why a map and a set of defaults live in `shared/`

`rails.ts` is **transcribed** and `defaults.ts` is **decided**. Neither is a
method, and both would read more naturally at the object root — which is exactly
where neither can go: the standard admits only a document, an index, types, a
definition and a constructor there, and `lint:model` enforces it.

The model directory already covers this case. A module that is not a public
method is still the execution behind the surface — "a codec, a wire format, a
parser" — and the document beside it is where it names the caller it serves. That
is what the table above is.

Both are read by three or more methods and by the definition, so `shared/` is
where they would land on the promotion rule anyway.

**The vocabulary is not here.** `Category`, `ContentView`, `ContextView` and
`InspectorView` are what a stored tab names, so they belong to the `workspace` domain
under `representation/` — the unions in `data/types/workspace/`, their lists and
guards in `data/behavior/workspace/`. This object imports them like any other
consumer.

## `defaults.ts` — what a tab starts as

`SINGLETONS` names the categories that are one per project and always open, in the
strip's order, which runs from the project outward: where you are, then what is
working, then what it works from. Permanence is derived from that list rather
than stored on a tab — `isSingleton(tab.category)` — which removes the one place a
boolean and a category could disagree.

`DEFAULT_FRAME` is where a tab's four panel numbers start, frozen so that a tab
holding a reference rather than a copy fails loudly on the first drag.

Neither is representation. A row says what a tab *is*; these two say what a tab
that does not exist yet *will be*, and no reader of a stored row consults either.

**Preserves:** a permanent category cannot be closed, and every tab is minted with
a complete frame.

**Fails when:** nothing here throws. `close` is what refuses a singleton, using
the guard.

**Touches state:** none.

## `rails.ts` — the transcribed map

`RAILS` says which context views a category's rail offers, in order, and therefore
which one it opens on. **It is transcribed from the category's own document under
`app-views/categories/`, not derived.** Nothing is inferred from the file tree,
because a view can exist without a rail offering it — so a rail that disagrees
with the document is changed in the document first and copied down here after.

`Record<Category, readonly ContextView[]>`: total over categories, so a new
category fails to compile until it has been given a rail, and one level deep,
because the rail belongs to the category rather than to one of its centres. All
three surfaces are showing one subject from different angles, so moving between a
category's centres is a change of range rather than of subject, and a rail that
emptied itself there would be answering a question nobody asked.

Three functions read it. `railFor` returns what the rail offers, in order, and an
empty array for a category with no rail. `defaultContext` is its first entry,
`undefined` only where the rail is empty. `offersContext` is the test a caller
selecting a context owes.

`DEFAULT_CONTENT` is beside it and answers the other half: which of a category's
centres a fresh tab opens on. It is named rather than derived, because the tree
sorts `automation` before `library` and reading a default off that order would be
an accident. A category with no content view names none, and `mintView` refuses
to mint a tab that has nothing to paint.

An overview leads every rail but two, and each of the two says something about its
category. A deck opens on its list of slides, because the slide you are on is the
orientation a deck has instead of a summary. The launcher has no overview view at
all, since a blank tab has nothing to be an overview of.

A research thread's rail leads with its own overview for the same reason a
document's does — the tab was opened onto this line of enquiry, so landing on the
list of every other one would be the map arriving before the territory.
`library.threads` sits last on that rail and is how a different thread is reached,
which is a thing you do after this one.

**Preserves:** a tab's `contextId` is one its category offers, or that category's
default. `mint-view` establishes it, `land-on` carries it across a centre change,
`select-context` refuses to break it, and the `context` getter falls back if it
has drifted anyway.

**Fails when:** nothing here throws. `undefined` from `defaultContext` is a real
state — a category the documents gave no context panel — and `Tab.contextId` is
optional for exactly that reason.

**Touches state:** none.

### The views no rail reaches

65 of the 92 context views appear in `RAILS`. Twenty-seven do not, and that is the
map behaving correctly: a transcribed map cannot invent a home for a panel the
specification gives none to, and quietly hanging an orphan off the nearest rail
would turn a question for the specification into a wrong answer nobody could see.

They fall into four groups, and only the last two are unresolved:

**Views of a category the shell has not got.** `overview.context` and the five
`scope.*` views are a Context category's rail, and there is no Context category.
They are files awaiting deletion, not rows awaiting a rail.

**Views their category's rail does not offer.** The Overview rail carries four
entries, because resources, people, tasks and health each repeat a band already on
the plane and a map that repeats the territory is not a map — so seven `project.*`
views sit outside it. Four `analysis.*` and six `library.*` are outside their
categories' rails for the same kind of reason. They are in the trees because nothing
has deleted them. **The four `analysis.*` are the group worth a second look**: a
chart being authored plausibly needs its fields and its formula in the rail, and
the specification is where that is decided.

**`project.variables-create`**, a push-in reached from inside the Variables panel
rather than from the rail. That is probably correct as it stands.

**`slide-deck-editor.layout-layouts`, `slide-deck-editor.layout-objects` and
`slide-deck-editor.layout-theme`** are the deck's **layout rail**, and they are
in the vocabulary with no row of their own. The deck has one centre and editing a
layout is a state of it rather than a second centre, so there was never a key to
hang a second rail on.

The shape of `RAILS` is what settled this. It is keyed on the category alone, so
there is one rail for the deck and these three are not on it. Reaching them is
`selectContext`'s to answer, which it cannot do while the rail is also what
`offersContext` tests against — so today they are named and unreachable, and this
is where that is written down rather than discovered from a blank panel.

## `apply.ts` — one op, one effect

```ts
export const apply = (state: WorkspaceStateData, op: WorkspaceOp): void => ...;
```

The only place a `WorkspaceOp` becomes a change to `tab-list` or `tab-views`. Seven
arms, one per member of the union, and each is the smallest write that member
describes: `open` stores a view and inserts a record, `close` takes both out,
and the other five write fields on one view.

**It does not choose anything.** `open` does not activate the tab it adds and
`close` does not pick a neighbour, because both of those are moves and a move is
an `activate` op of its own. That is what makes `open` and `close` exact mirrors:
an arm that reached for a neighbour would be an effect with nothing in the op to
undo it from.

**It does not record.** Applying and recording are separate because `undo` and
`redo` need the first without the second — replaying history is not making
history.

**Preserves:** every op means one thing, wherever it came from — a gesture, an
inversion, or a change set read back off the wire.

**Fails when:** it does not, on its own. A `land` naming a tab with no view is
`tab-views` refusing one call down.

**Touches state:** both collaborators, and nothing else.

## `perform.ts` — apply, and remember

```ts
export const perform = (state: WorkspaceStateData, op: WorkspaceOp): void => ...;
```

Apply the op, push it onto the log, and drop whatever was waiting to be redone.
Every public mutator ends in exactly one or two of these, which is what makes the
log complete: there is no other way to change a tab.

**A new gesture drops the redo stack**, because the alternative is a redo that
replays an op against a state it was never authored over.

**Preserves:** the log is every change, in order.

**Fails when:** it does not.

**Touches state:** the log and the undone stack, plus whatever `apply` touches.

## `landing.ts`

```ts
export const landing = (view: TabView): Landing => ...;
```

The five fields a landing writes, picked off a stored view. It exists because
both halves of a `land` op are a whole `Landing` and the `was` half has to be a
copy: `tab-views` replaces its entries rather than editing them, so a reference
held across the write would still be the old value — but a `Pick` of the live
object would be a shape nobody had decided on. This decides it, once.

**Preserves:** `was` and `now` are the same shape, so inversion is a swap.

**Fails when:** it does not.

**Touches state:** none.

## `compose.ts`

```ts
export const compose = (record: TabRecord, view: TabView): Tab => ...;
```

A `Tab` is not stored anywhere. It is a `TabRecord` from `tab-list` and a
`TabView` from `tab-views` read together, and this is the one place they meet —
four getters on the definition and two methods that return a tab all go through
it, so there is a single answer to what a tab looks like from outside.

**It is also where `null` becomes `undefined`.** A stored view spells "nothing"
as `null`, because an absent JSON key and a null are two spellings of one state
and a stored shape may have only one. The read surface spells it `undefined`,
because that is what every consumer already narrows against. Translating in one
function is what keeps the two conventions from meeting anywhere else.

**Preserves:** one shape for a tab, wherever it is read from.

**Fails when:** it does not. A missing view is `tab-views`' refusal, one call
earlier.

**Touches state:** none.

## `land-on.ts`

```ts
export const landOn = (
  state: WorkspaceStateData,
  record: TabRecord,
  content: ContentView,
  focus?: string
): void => ...;
```

Putting a tab on a centre, with the three things that have to follow. Two public
methods need it and neither may borrow the other: `showContent` is a person
moving inside a category they are already on, and `open` is a target naming a
centre arriving at a tab that is already open. Same consequences, different
question — and a second copy of them would be a second answer to "what happens
when the centre changes", which is the kind of pair that drifts silently because
both halves keep working.

The three: **the rail is carried across**, because it belongs to the category and
a change of centre leaves the category alone; it is re-derived rather than
assumed, so a position written in from outside is still corrected here. **The
inspection clears**, because what was selected belongs to the centre the tab is
leaving. **`focus` is assigned from the argument**, including when the argument
is nothing — there is no switcher in the shell, so choosing a persona and
switching to the persona centre are one act, and passing nothing is how a library
is returned to.

It refuses a content view another category owns. That refusal living here rather
than in `showContent` is why `open` inherits it for free.

**Preserves:** a tab's `contextId` is one its category offers, and no inspection
outlives the centre it was about.

**Fails when:** the content view is not one of this category's. That is a caller
naming a centre a category has not got, which is a mistake rather than drift, so
it throws where the two rail asymmetries fall back.

**Touches state:** one view, through `tab-views` — the active tab's when
`showContent` calls it and the target's own when `open` does. It reads the
held rail position first, which is why it takes the coordinator's state rather
than a bare view.

## `mint-view.ts`

```ts
export const mintView = (target: Target): TabView => ...;
```

The only place a view is minted: the definition's constructor calls it for the
three permanent tabs and `open` calls it for everything else, so every tab in the
application starts the same way. The centre defaults to the category's own —
`DEFAULT_CONTENT`, which names it rather than deriving it — and the rail is
chosen here rather than left empty, because a tab with no context id would make
every reader handle a state that exists for one tick.

**A record is not minted here.** `tab-list.mint` does that, and it needs none of
this: an id, a category and a resource id are what a tab *is*, and everything
chosen from a default is what it is *showing*.

**The frame is copied, not shared.** `DEFAULT_FRAME` is frozen, and a tab holding
a reference to it would throw the first time anyone dragged an edge.

`focus` comes straight off the target, so a tab opened onto a subject arrives on
it: a thread opened at a question shows that question, and nothing has to make a
second call to say so.

**Preserves:** every member of `frame` is present from the moment a tab exists —
no optionality, so no read path reports a default it never stored — the rail
position is one the category offers, and no two tabs share a mutable value.

**Fails when:** the category names no centre at all. `ContentView` is the union
of *every* category's centres, so a target naming another category's centre still
type-checks and is minted unchecked; `landOn` refuses exactly that, which means
`open` refuses it for a tab already open and accepts it for one it is about to
mint. **The two branches of one method disagree**, and the check belongs here as
well.

**Touches state:** none — it computes a whole view from its arguments, and the
caller decides which id it is stored under.

## `target-key.ts`

```ts
export const targetKey = (target: Target | Tab): string | undefined => ...;
```

The whole definition of "already open". `open` calls it twice — once for the
target and once per tab it compares against — and nothing else calls it, so there
is one answer to a question three surfaces ask. A second definition anywhere would
be a second answer, and the two would disagree the first time a category gained an
identity.

Three cases, and the third is the interesting one. A permanent category is one per
project, so its category is the whole key. A tab that is *for* something is keyed by
what it is for, so two documents are two tabs, two research threads are two tabs,
and one of either reached from a mention, from the work table and from a search is
one tab, in the state the person left it. A launcher — `new-tab`, which is neither
permanent nor resource-bearing — has no identity at all and returns `undefined`,
so it never dedupes: open five and get five, which is what a launcher is for.

**Preserves:** at most one tab per identity, and no deduplication of the things
that have none.

**Fails when:** it does not. `undefined` is an answer, not an error. A target on
an identity-bearing category that carries no `resourceId` therefore reads as a
launcher and mints every time, which is the one way a caller can turn a keyed
category into an unkeyed one.

**Touches state:** none.

## Demotion

`apply`, `perform`, `landing`, `compose`, `land-on`, `mint-view` and `target-key`
follow the ordinary rule: one that lost its
second caller would move back into the directory of the method that still uses
it, or a later reader would take it for a rule when it is only history.
`target-key` is already close to that line — `open` is its only caller — and it
stays because the invariant is the object's rather than `open`'s: it is what makes
two tabs on one document impossible, wherever a tab comes from.

`land-on` is the furthest from it. `showContent` is a one-line wrapper around
it, so demoting it would mean inlining it into that method and leaving `open` to
call across into `show-content.ts` — a sibling method directory importing
another, which is the one path this directory exists to prevent.

`defaults.ts` and `rails.ts` cannot be demoted. Neither is a method, and neither
belongs under any one method's directory: a map with a single caller would still
be the map, and the object root is closed to it.
