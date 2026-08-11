# `ContextSpace.svelte` — set algebra as the work surface

The center of the screen when the space is Context: the context's **definition** over the
**resolved leaf set** it produces. This mirrors Omega exactly — a context is a
`Definition{Includes, Excludes}` that `contexts.Resolve` flattens to leaf refs, readable at
`GET /contexts/:contextID/resolved`.

## Two parallel sets, one snippet

```svelte
{@render setPanel('Included', 'include')}
{@render setPanel('Excluded', 'exclude')}
```

Included and Excluded are the same object aimed at opposite sides of the definition, so they are
one snippet: a panel-toned header strip over a work-toned body of rows, a green `Plus` or a red
`Minus` beside the heading, and one line of plain prose saying what the section does. "Left out,
even when something above brings it in" replaced "exclusion always wins after expansion" — the
first is English, the second is set theory.

**Excluded keeps Included's full height even holding one member.** The empty space is not waste:
the two sides are equally important, parity says so, and the room is where you add more.

Excluded rows are **not struck through**. The strike read as "deleted" rather than "subtracted,"
which is a different claim.

## Rows follow the app's list idiom

Tinted kind tile via `iconTileClass`, `rounded-control` hit target, `text-body-sm text-secondary`,
`hover:bg-elevated` — the shape `ResourcesPanel` already uses, so a list here is recognisably the
same thing as a list there. A nested `context` member gets a disclosure that expands to what it
contributes, which is what makes nesting legible while editing.

## The resolved list

```svelte
<h2>Resources <span class="font-normal text-muted">({formatCount(context.resolved.length)})</span></h2>
<button class="grid grid-cols-[minmax(0,1fr)_12rem] … border-b border-border last:border-0">
```

Borrowed from `features/stages/shared/ResourceTable.svelte`, including its best decision: **no Type
column** — the tinted tile carries the kind, with the label in a `title`. There is **no header
row** either; with two columns, one of which is names, it was chrome explaining the obvious, so the
count moved into the heading. `formatCount` renders it `1.2k` / `340k` / `1.4M`, because a
whole-project context resolves to as many resources as the project has.

The second column shows only `via[0]` — the top-level member the leaf arrived through, so every
row maps to something visible in Included above. A chain of three names turned a scannable table
into a wall. **Double-click opens** the resource; single click selects it and nothing more.

The body is capped at `max-h-56` — exactly five rows (44px each plus a rule), so it never cuts a
row through the middle, and the sets above keep the room. Editing membership is the work; the
resolved set is a readout.

**Two things this needs before it is real:** the row body must be **virtualised** (a whole-project
context resolves to thousands, and the mock renders every row only because its fixtures are tiny),
and this markup should not stay a third hand-rolled table — the frame and row grammar want
extracting out of `ResourceTable` into a shared primitive. `components/Table.svelte` cannot serve:
it bakes in a header row, takes only string cells, and has no icon column.

## Adding a member is a modal

Picking searches the whole library plus every resource, which does not fit beside the list it
feeds. One modal serves both sets — only the title, the explanation, and the confirm verb change,
because including and excluding are the same act.

## Room for the AI bar

The outer column carries `pb-24` so [`LibraryQuarterback`](LibraryQuarterback.svelte.md), which
anchors to the foot of the work surface, never covers this space's last row.
