# Shared View State Methods

Lives at `methods/shared/shared.md`.

Four modules. Two are methods promoted because a second public method needed them
and they preserve an invariant spanning both. Two are not methods at all.

| File | Invariant it preserves | Used by |
| --- | --- | --- |
| [`keys.ts`](keys.ts) | Every key names a file in the panel trees | `inspect`, `show-subscreen`, `rails`, `mint-tab`, `types.ts`, `index.ts` |
| [`rails.ts`](rails.ts) | The rail position is one this subscreen offers | `select-context`, `show-subscreen`, `mint-tab`, the definition's `context` getter, `index.ts` |
| [`mint-tab.ts`](mint-tab.ts) | Every tab starts the same way | the definition's constructor, `open` |
| [`target-key.ts`](target-key.ts) | One definition of "already open" | `open` |

## Why a vocabulary and a map live in `shared/`

`keys.ts` is **generated** and `rails.ts` is **transcribed**. Neither is a method,
and both would read more naturally at the object root — which is exactly where
neither can go: the standard admits only a document, a door, types, a definition
and a constructor there, and `lint:model` enforces it.

The model directory already covers this case. A module that is not a public
method is still the execution behind the surface — "a codec, a wire format, a
parser" — and the document beside it is where it names the caller it serves. That
is what the table above is. The generator says the same in its own comment, at the
line that decides where it writes.

Both are read by three or more methods and by the definition, so `shared/` is
where they would land on the promotion rule anyway.

## `keys.ts` — the generated vocabulary

```text
pnpm view-state-keys
pnpm view-state-keys -- --check
```

A key is a path. `context/project/variables.svelte` is `"project.variables"`;
`workspaces/research/workspace-one-question.svelte` is the `research` screen's
`"one-question"`. Nothing outside the four trees gets a vote, which is what makes
a key naming no file a compile error rather than a blank panel. `--check` exits
non-zero when the written file and the trees disagree, and that is the part worth
running in CI.

It exports 90 `CONTEXT_IDS`, 89 `INSPECTION_KEYS`, 11 `SCREENS`, and `SUBSCREENS`
— 17 centres across those screens, with the `workspace-` prefix stripped, so a
screen with one centre has the single subscreen `workspace`.

**`"empty"` is deliberately absent.** Nothing being inspected is a state of the
model rather than a file in the tree, so it belongs to the hand-written
`Inspected` in [`../../types.ts`](../../types.ts) that unions the two.

`SUBSCREENS` is `as const satisfies Record<Screen, readonly string[]>` rather than
a plain annotation: the members stay literal, because `Subscreen` is read back off
the table, while a screen missing from it still fails to compile. That literalness
is why `show-subscreen` widens its lookup to `readonly string[]` before calling
`includes` — narrowed, `includes` would refuse the screen-spanning union the
method takes, which is the question being asked rather than an error.

**Preserves:** every key any method accepts names a file that exists.

**Fails when:** nothing here throws — it is data plus three narrowings.
`isContextId`, `isInspectionKey` and `isScreen` are what a method calls to refuse
a string, and the build-time failure is `--check`.

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

Overview leads every rail but a deck's, where the list of slides is the
orientation instead.

**Preserves:** a tab's `contextId` is one its current subscreen offers, or that
subscreen's default. `mint-tab` establishes it, `show-subscreen` restores it after
a change, `select-context` refuses to break it, and the `context` getter falls
back if it has drifted anyway.

**Fails when:** nothing here throws. `undefined` from `defaultContext` is a real
state — a subscreen the specification gave no context panel — and `Tab.contextId`
is optional for exactly that reason.

**Touches state:** none.

### Four views no rail reaches

86 of the 90 context views appear in `RAILS`. Four do not, and they are two
different situations.

`project.variables-create` is a push-in reached from inside the Variables panel
rather than from the rail. That is probably correct as it stands.

`resource.layout-layouts`, `resource.layout-objects` and `resource.layout-theme`
are the slide deck's **layout rail**, and there is nothing to hang them on.
`workspaces/slide-deck-editor/` holds one `workspace.svelte`, so
`SUBSCREENS["slide-deck-editor"]` is `["workspace"]`, and editing a layout is a
prop on that one centre rather than a state the rail can be keyed on. The
specification carries the rail; this map has no row for it, and `rails.ts` says so
in a comment where the row would be.

**The specification is where this is unresolved, and it disagrees with itself.**
`screens/slide-deck-editor/overview.md` opens by naming two subscreens — editing
a slide and editing a layout, "the same tab in two states", with a rail that
"changes completely between them" — and gives each its own context-panel table.
`screens/slide-deck-editor/workspace.md` says the opposite: one region, and
editing a slide, editing a layout and choosing a new one are "all states of this
one editor". Subscreens are generated from workspace files, so the second
document is the one that decided it, and the first document's second rail has no
row to sit in.

Two ways out, and neither is chosen here: the deck gains a second workspace file,
which makes the layout a subscreen and its rail an ordinary row; or the rail is
keyed on something other than a subscreen, which changes the shape of `RAILS` for
every screen. The fourth member of the specification's layout rail,
`project.variables`, is already reachable from the deck's main rail and is not
affected either way.

## `mint-tab.ts`

```ts
export const mintTab = (id: TabId, target: Target): Tab => ...;
```

The only place a tab is minted: the definition's constructor calls it for the
seven singletons and `open` calls it for everything else, so every tab in the
application starts the same way. The subscreen defaults to the screen's first,
and the rail is chosen here rather than left empty — a tab with no context id
would make every reader handle a state that exists for one tick, and the
specification already says which view each screen opens on.

**The frame is copied, not shared.** `DEFAULT_FRAME` is frozen, and a tab holding
a reference to it would throw the first time anyone dragged an edge.

**Preserves:** every member of `frame` is present from the moment a tab exists —
no optionality, so no read path reports a default it never stored — and the rail
position is one the subscreen offers.

**Fails when:** it does not. Its inputs are already narrowed: `Screen` and
`Subscreen` are the generated unions, and `nextId()` is the definition's.

**Touches state:** none — it computes a whole tab from its arguments, and the
caller decides where it goes.

## `target-key.ts`

```ts
export const targetKey = (target: Target | Tab): string | undefined => ...;
```

The whole definition of "already open". `open` calls it twice — once for the
target and once per tab it compares against — and nothing else calls it, so there
is one answer to a question three surfaces ask. A second definition anywhere would
be a second answer, and the two would disagree the first time a screen gained an
identity.

Three cases, and the third is the interesting one. A singleton is one per project,
so its screen is the whole key. A resource tab is keyed by what it edits, so two
documents are two tabs and one document reached from a mention, from the work
table and from a search is one tab, in the state the person left it. A launcher —
`new-tab`, which is neither a singleton nor resource-bearing — has no identity at
all and returns `undefined`, so it never dedupes: open five and get five, which is
what a launcher is for.

**Preserves:** at most one tab per identity, and no deduplication of the things
that have none.

**Fails when:** it does not. `undefined` is an answer, not an error.

**Touches state:** none.

## Demotion

`mint-tab` and `target-key` follow the ordinary rule: one that lost its second
caller would move back into the directory of the method that still uses it, or a
later reader would take it for a rule when it is only history. `target-key` is
already close to that line — `open` is its only caller — and it stays because the
invariant is the object's rather than `open`'s: it is what makes two tabs on one
document impossible, wherever a tab comes from.

`keys.ts` and `rails.ts` cannot be demoted. Neither is a method, and neither
belongs under any one method's directory: a vocabulary with a single caller would
still be the vocabulary, and the object root is closed to it.
