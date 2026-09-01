# Shared Workspace State Methods

Lives at `methods/shared/shared.md`.

Nine modules. Seven are methods promoted because a second public method needed
them and they preserve an invariant spanning both. Two are not methods at all.

| File | Invariant it preserves | Used by |
| --- | --- | --- |
| [`apply.ts`](apply.ts) | One op, one effect — the only place an op becomes a change | `perform`, `undo`, `redo` |
| [`perform.ts`](perform.ts) | Nothing changes without leaving a record | every mutator, `land-on` |
| [`landing.ts`](landing.ts) | The `was` half of a landing is read the same way every time | `land-on`, `open` |
| [`defaults.ts`](defaults.ts) | A screen is permanent or it is not, and every tab starts the same width | `close`, `target-key`, `mint-view`, `index.ts`, the definition's constructor |
| [`rails.ts`](rails.ts) | The rail position is one this subscreen offers | `select-context`, `land-on`, `mint-view`, the definition's `context` getter, `index.ts` |
| [`compose.ts`](compose.ts) | A record and a view are read as one tab, in one place | `open`, `reopen-closed`, the definition's four read getters |
| [`land-on.ts`](land-on.ts) | A centre change takes its rail and its inspection with it | `show-subscreen`, `open` |
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

**The vocabulary is not here.** `Screen`, `Subscreen`, `ContextId` and
`InspectionKey` are what a stored tab names, so they belong to the `views` domain
under `representation/` — the unions in `data/types/workspace/`, their lists and
guards in `data/behavior/workspace/`. This object imports them like any other
consumer.

## `defaults.ts` — what a tab starts as

`SINGLETONS` names the screens that are one per project and always open, in the
strip's order, which runs from the project outward: where you are, then what is
working, then what it works from. Permanence is derived from that list rather
than stored on a tab — `isSingleton(tab.screen)` — which removes the one place a
boolean and a screen could disagree.

`DEFAULT_FRAME` is where a tab's four panel numbers start, frozen so that a tab
holding a reference rather than a copy fails loudly on the first drag.

Neither is representation. A row says what a tab *is*; these two say what a tab
that does not exist yet *will be*, and no reader of a stored row consults either.

**Preserves:** a permanent screen cannot be closed, and every tab is minted with
a complete frame.

**Fails when:** nothing here throws. `close` is what refuses a singleton, using
the guard.

**Touches state:** none.

## `rails.ts` — the transcribed map

`RAILS` says which context views a screen's rail offers, in order, and therefore
which one it opens on. **It is transcribed from
`docs/screen-panel-views/screens/<screen>/overview.md`, not derived.** Each
screen's "## Context panel" table is one row, in the table's order, and the first
entry is that subscreen's default. Nothing is inferred from the file tree,
because a view can exist without a rail offering it — so a rail that disagrees
with the specification is changed in the specification first and copied down here
after.

`Record<Screen, Partial<Record<Subscreen, …>>>`: total over screens, so a new
screen fails to compile until it has been given a rail; partial over subscreens,
because `Subscreen` is the union of every screen's members and no screen has all
of them.

Three functions read it. `railFor` returns what the rail offers, in order, and an
empty frozen array for a subscreen with no rail of its own. `defaultContext` is
its first entry, `undefined` only where the rail is empty. `offersContext` is the
test a caller selecting a context owes.

An overview leads every rail but two, and each of the two says something about its
screen. A deck opens on its list of slides, because the slide you are on is the
orientation a deck has instead of a summary. The launcher has no overview view at
all, since a blank tab has nothing to be an overview of.

A research thread's rail leads with its own overview for the same reason a
document's does — the tab was opened onto this line of enquiry, so landing on the
list of every other one would be the map arriving before the territory.
`library.threads` sits last on that rail and is how a different thread is reached,
which is a thing you do after this one.

**Preserves:** a tab's `contextId` is one its current subscreen offers, or that
subscreen's default. `mint-view` establishes it, `land-on` restores it after a
centre change, `select-context` refuses to break it, and the `context` getter falls
back if it has drifted anyway.

**Fails when:** nothing here throws. `undefined` from `defaultContext` is a real
state — a subscreen the specification gave no context panel — and `Tab.contextId`
is optional for exactly that reason.

**Touches state:** none.

### The views no rail reaches

65 of the 92 context views appear in `RAILS`. Twenty-seven do not, and that is the
map behaving correctly: a transcribed map cannot invent a home for a panel the
specification gives none to, and quietly hanging an orphan off the nearest rail
would turn a question for the specification into a wrong answer nobody could see.

They fall into four groups, and only the last two are unresolved:

**Views of a screen the shell has not got.** `overview.context` and the five
`scope.*` views are a Context screen's rail, and there is no Context screen. They
are files awaiting deletion, not rows awaiting a rail.

**Views their screen's rail does not offer.** The Overview rail carries four
entries, because resources, people, tasks and health each repeat a band already on
the plane and a map that repeats the territory is not a map — so seven `project.*`
views sit outside it. Four `analysis.*` and six `library.*` are outside their
screens' rails for the same kind of reason. They are in the trees because nothing
has deleted them. **The four `analysis.*` are the group worth a second look**: a
chart being authored plausibly needs its fields and its formula in the rail, and
the specification is where that is decided.

**`project.variables-create`**, a push-in reached from inside the Variables panel
rather than from the rail. That is probably correct as it stands.

**`resource.layout-layouts`, `resource.layout-objects` and
`resource.layout-theme`** are the slide deck's **layout rail**, and there is
nothing to hang them on. `workspaces/slide-deck-editor/` holds one
`workspace.svelte`, so `SUBSCREENS["slide-deck-editor"]` is `["workspace"]`, and
editing a layout is a prop on that one centre rather than a state the rail can be
keyed on. The specification carries the rail; this map has no row for it, and
this document is where that is written down.

**The specification is where this is unresolved, and it disagrees with itself.**
`screens/slide-deck-editor/overview.md` opens by naming two subscreens — editing
a slide and editing a layout, "the same tab in two states", with a rail that
"changes completely between them" — and gives each its own context-panel table.
`screens/slide-deck-editor/workspace.md` says the opposite: one region, and
editing a slide, editing a layout and choosing a new one are "all states of this
one editor". Subscreens are generated from workspace files, so the second
document is the one that decides it, and the first document's second rail has no
row to sit in.

Two ways out, and neither is chosen here: the deck gains a second workspace file,
which makes the layout a subscreen and its rail an ordinary row; or the rail is
keyed on something other than a subscreen, which changes the shape of `RAILS` for
every screen. The fourth member of the specification's layout rail,
`project.variables`, is already reachable from the deck's main rail and is not
affected either way.

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
  subscreen: Subscreen,
  focus?: string
): void => ...;
```

Putting a tab on a centre, with the three things that have to follow. Two public
methods need it and neither may borrow the other: `showSubscreen` is a person
moving inside a screen they are already on, and `open` is a target naming a
centre arriving at a tab that is already open. Same consequences, different
question — and a second copy of them would be a second answer to "what happens to
the rail when the centre changes", which is the kind of pair that drifts silently
because both halves keep working.

The three: **the rail follows**, because two centres of one screen frequently
offer disjoint rails and a remembered context that survives the move points the
panel at a view the new rail does not offer. **The inspection clears**, because
what was selected belongs to the centre the tab is leaving. **`focus` is
assigned from the argument**, including when the argument is nothing — there is
no switcher in the shell, so choosing a persona and switching to the persona
centre are one act, and passing nothing is how a library is returned to.

It refuses a subscreen the screen does not have. That refusal living here rather
than in `showSubscreen` is why `open` inherits it for free.

**Preserves:** a tab's `contextId` is one its current subscreen offers, and no
inspection outlives the centre it was about.

**Fails when:** the subscreen is not one of `SUBSCREENS[tab.screen]`. That is a
caller naming a centre a screen has not got, which is a mistake rather than
drift, so it throws where the two rail asymmetries fall back.

**Touches state:** one view, through `tab-views` — the active tab's when
`showSubscreen` calls it and the target's own when `open` does. It reads the
held rail position first, which is why it takes the coordinator's state rather
than a bare view.

## `mint-view.ts`

```ts
export const mintView = (target: Target): TabView => ...;
```

The only place a view is minted: the definition's constructor calls it for the
three permanent tabs and `open` calls it for everything else, so every tab in the
application starts the same way. The subscreen defaults to the screen's own —
`DEFAULT_SUBSCREEN`, which names it rather than deriving it — and the rail is
chosen here rather than left empty, because a tab with no context id would make
every reader handle a state that exists for one tick.

**A record is not minted here.** `tab-list.mint` does that, and it needs none of
this: an id, a screen and a resource id are what a tab *is*, and everything
chosen from a default is what it is *showing*.

**The frame is copied, not shared.** `DEFAULT_FRAME` is frozen, and a tab holding
a reference to it would throw the first time anyone dragged an edge.

`focus` comes straight off the target, so a tab opened onto a subject arrives on
it: a thread opened at a question shows that question, and nothing has to make a
second call to say so.

**Preserves:** every member of `frame` is present from the moment a tab exists —
no optionality, so no read path reports a default it never stored — the rail
position is one the subscreen offers, and no two tabs share a mutable value.

**Fails when:** it does not — and `Subscreen` is not narrow enough to make that
safe. It is the union of *every* screen's centres, so a target naming a centre
its own screen has not got type-checks, and minting gives the tab that subscreen
with no rail behind it. `landOn` refuses exactly this, which means `open` refuses
it for a tab already open and accepts it for one it is about to mint. **The two
branches of one method disagree**, and the check belongs here as well.

**Touches state:** none — it computes a whole view from its arguments, and the
caller decides which id it is stored under.

## `target-key.ts`

```ts
export const targetKey = (target: Target | Tab): string | undefined => ...;
```

The whole definition of "already open". `open` calls it twice — once for the
target and once per tab it compares against — and nothing else calls it, so there
is one answer to a question three surfaces ask. A second definition anywhere would
be a second answer, and the two would disagree the first time a screen gained an
identity.

Three cases, and the third is the interesting one. A permanent screen is one per
project, so its screen is the whole key. A tab that is *for* something is keyed by
what it is for, so two documents are two tabs, two research threads are two tabs,
and one of either reached from a mention, from the work table and from a search is
one tab, in the state the person left it. A launcher — `new-tab`, which is neither
permanent nor resource-bearing — has no identity at all and returns `undefined`,
so it never dedupes: open five and get five, which is what a launcher is for.

**Preserves:** at most one tab per identity, and no deduplication of the things
that have none.

**Fails when:** it does not. `undefined` is an answer, not an error. A target on
an identity-bearing screen that carries no `resourceId` therefore reads as a
launcher and mints every time, which is the one way a caller can turn a keyed
screen into an unkeyed one.

**Touches state:** none.

## Demotion

`apply`, `perform`, `landing`, `compose`, `land-on`, `mint-view` and `target-key`
follow the ordinary rule: one that lost its
second caller would move back into the directory of the method that still uses
it, or a later reader would take it for a rule when it is only history.
`target-key` is already close to that line — `open` is its only caller — and it
stays because the invariant is the object's rather than `open`'s: it is what makes
two tabs on one document impossible, wherever a tab comes from.

`land-on` is the furthest from it. `showSubscreen` is a one-line wrapper around
it, so demoting it would mean inlining it into that method and leaving `open` to
call across into `show-subscreen.ts` — a sibling method directory importing
another, which is the one path this directory exists to prevent.

`defaults.ts` and `rails.ts` cannot be demoted. Neither is a method, and neither
belongs under any one method's directory: a map with a single caller would still
be the map, and the object root is closed to it.
