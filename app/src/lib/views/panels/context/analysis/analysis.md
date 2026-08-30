# Analysis

The context stack for the Analysis screen: the four panels a person works down
while building a chart. Between them they answer what can be charted, where each
field has been put, what kind of picture is being drawn, and what all of that
compiled to. The order is the order of the work rather than an alphabet —
Variables offers the material, Fields is the builder itself, Chart chooses the
shape, and Formula is a diagnostic read afterwards when the picture is not what
was expected. The first three are places where a decision is made; Formula is
read-only on purpose and says so.

## Variables

Everything in the project that could be charted, with each table's fields listed
underneath it. A search box across the top narrows both the variables and the
fields inside them, and reports how many of the total survived — searching for
`customerMinutes` has to find the column and not merely the table it sits in,
because the column is what gets dropped. Three bands: Tables, Values, and
Functions. That is the same set of names the name manager shows, arranged
differently, because here a person is picking a *field* rather than referring to a
name — which is why the fields have to be visible at all and why a type sits
beside each one. The type is what decides where a field is allowed to go.

Tables come first, with every field indented under its table and each row carrying
its type glyph; then Values, each with its value and type; then Functions, which
arrives shut. A function is never an answer to "what shall I chart?" — it is
listed so that meeting the name later is not a surprise.

A field row does not select. The lens is on the variable that holds the field,
because there is nothing to inspect about a column on its own, so field rows are
not buttons and offer no hover fill. Function rows do not select either, for the
same reason: a function is not a value, so it cannot be charted.

Two things are named as unsound rather than hidden. A field's type is inferred by
looking down the column, so a column that is mostly numbers with three strings in
it has no single type and the row shows one anyway. And a scalar value is a
reference line or something to filter against, never an axis — what dropping one
on a zone should do is undefined, so until that has an answer these should not be
draggable at all.

One sentence covers the whole screen and is said once, here: nothing is
drag-only. Every drop zone also has an Add menu and a keyboard path.

Table and value rows open `analysis.variable`.

## Fields

The builder. Each band is a drop zone and each row in it is a placement, so the
panel reads top to bottom the way the query reads: what is across, what is up,
what is kept, what order, how much. The bands are X — across, Y — up, Filters,
Sort, Limit.

The zones are named for what they do to the picture rather than for the query
operation behind them. Somebody putting a field on X is deciding what the bars
stand for, not writing a grouping clause. X holds one field; Y allows several and
each one is a series, so it carries a count.

An empty zone says it is empty. A zone that draws nothing is indistinguishable
from one that failed to load, and picking a chart kind that wants another field
opens exactly such a zone — so "Nothing across yet" is a line of text rather than
a blank. Filters says every row is kept, Sort says the result comes back in the
order the grouping produced it, Limit says every group is drawn.

Two rows carry numbers for a reason. A filter row shows how many rows it kept out
of how many it saw, and is drawn as wanting attention when those two are equal,
because a rule that removes nothing is usually a mistake and the row cannot say so
without both figures. The sort row names a placement and not a bare source field —
it reads `sum of customerMinutes`, never `customerMinutes`, because those two
order the bars differently.

Nothing here can be added or removed: there is nothing that writes a placement
yet. Filters and sorts also carry no stable identifiers, so a selection on one
cannot survive a reload and cannot be collaborated on.

Rows open `analysis.placement`, `analysis.filter`, `analysis.sort` and
`analysis.limit` according to the band they sit in.

## Chart

What kind of picture to draw. One band of thumbnails — table, bar, line, area,
scatter, pie — each card showing the shape it draws rather than only its word, so
a kind is picked by its picture. Under the cards, a single line saying what the
chosen kind draws with.

The one band is the whole panel, so the panel's title is the only heading it
needs; a collapsible section holding the entirety of a panel is a disclosure over
nothing.

Picking a kind that needs a field the analysis has not got opens an empty zone for
it in Fields rather than refusing. The screen asks for what is missing instead of
blocking.

The minimum-field rule per kind is undefined, and until it exists an empty zone
cannot appear only when it is genuinely needed — so either every zone is always
shown or none is. The chosen kind is also held locally, because nothing writes the
chart definition; picking one moves the choice and opens the chart lens, which is
where the rest of the drawing is decided.

Choosing a kind opens `analysis.chart`.

## Formula

The diagnostic: what the builder compiled to, and what the last run of it cost. It
is the answer to "why did I get that" when the chart is not what was expected.

Two bands. Compiled shows the expression the builder produced from the fields,
filters, sort and limit as they stand. Evaluation arrives shut and holds when it
ran, how many rows came back out of how many there were, and how long it took —
cost rather than answer, which is why it is closed. Rows carries both numbers
because the limit does not bite here, and a bare "6" on its own would read as the
whole result.

The expression is read-only deliberately. There is no parser from the formula
language back into the definition, so editing here would break the round trip to
the builder. Read-only is the whole of it: this is a way of reading the definition
rather than a second way of authoring it.

Nothing about a result is stored, so the Evaluation band describes the most recent
run and nothing before it.

## What is not here

Nothing in this stack writes. There is no path that adds a placement, a filter, a
sort or a limit, so every panel reads the definition, moves a local choice, and
waits. The consequences run through all four: a chart kind that is picked but not
saved, zones that cannot be added to, filters and sorts with no identity that
survives a reload, and a compiled expression that can be read but never edited.
