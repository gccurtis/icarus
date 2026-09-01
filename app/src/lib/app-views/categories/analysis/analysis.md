# Analysis

Lives at `src/lib/app-views/categories/analysis/analysis.md`.

One chart and the definition behind it, keyed by `resourceId`. Two analyses are
two tabs; one analysis reached from the library, from a mention and from the
work table is one tab, in the state it was left.

| Content | Shows |
| --- | --- |
| [`chart.svelte`](content/chart.svelte) | The picture, and the controls that shape it |

Nothing scrolls. A chart you have to scroll to is a chart you cannot read
against its own controls, which is the whole argument for this category
existing rather than an editor's inspector doing the job.

It carries the largest inspector vocabulary in the system: every part of a
chart — a mark, an axis, a filter, a limit — is something to select and read.

## Context

The context stack for the Analysis category: the four panels a person works down
while building a chart. Between them they answer what can be charted, where each
field has been put, what kind of picture is being drawn, and what all of that
compiled to. The order is the order of the work rather than an alphabet —
Variables offers the material, Fields is the builder itself, Chart chooses the
shape, and Formula is a diagnostic read afterwards when the picture is not what
was expected. The first three are places where a decision is made; Formula is
read-only on purpose and says so.

### analyses

Headed *Analyses*. Every chart built on this project's variables, searched, with
the chart type and when it last ran on the row. New, Open and Duplicate in the
action row.

The last-run time is said as "run 3 days ago" rather than as a date, because
nothing about a result is stored. The sentence is about an artefact that no
longer exists, and wording it as an age is what keeps it from reading as a link
to one.

Open and Duplicate act on a row, so they are dead until one is chosen. A control
that looks pressable and silently does nothing is worse than one that says it is
waiting for a selection. Nothing creates an analysis, so New lands the centre on
a blank id rather than inventing a row this panel would then fail to list.

Choosing a row opens its tab and inspects it, for the same reason `threads`
does.

Routes to `analysis.analysis`, opening the analysis category on the same press.

### chart

What kind of picture to draw. One band of thumbnails — table, bar, line, area,
scatter, pie — each card showing the shape it draws rather than only its word, so
a kind is picked by its picture. Under the cards, a single line saying what the
chosen kind draws with.

The one band is the whole panel, so the panel's title is the only heading it
needs; a collapsible section holding the entirety of a panel is a disclosure over
nothing.

Picking a kind that needs a field the analysis has not got opens an empty zone for
it in Fields rather than refusing. The category asks for what is missing instead of
blocking.

The minimum-field rule per kind is undefined, and until it exists an empty zone
cannot appear only when it is genuinely needed — so either every zone is always
shown or none is. The chosen kind is also held locally, because nothing writes the
chart definition; picking one moves the choice and opens the chart lens, which is
where the rest of the drawing is decided.

Choosing a kind opens `analysis.chart`.

### chartable-variables

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

One sentence covers the whole category and is said once, here: nothing is
drag-only. Every drop zone also has an Add menu and a keyboard path.

Table and value rows open `analysis.variable`.

### fields

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

### formula

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

### overview

The analysis itself: what it is called, whether it is saved, what it last
produced. One field — the title, editable and held here — and then three bands.

Under the title sits a gap rather than a field: the record has no description, so
the reason for the chart has nowhere to live. A chart needs one more than most
things do, because the title says what is plotted and a description says why, and
stating the absence is better than drawing an empty box for it.

Saved carries the state and the revision together, with a sentence about what
saving is: a check against the revision it started from, with undo covering
unsaved builder actions only. There is no history of changes behind it.

Result is rows kept of rows there were, the limit, and when it was evaluated.
Both numbers, always — a limit that does not bite still leaves a bare figure
reading as the whole answer. **Result describes a run rather than a definition**:
nothing about a result is stored, so this describes the most recent evaluation
and nothing before it.

Run again sits in the actions row as the panel's primary control, and it asks for
a fresh evaluation and saves nothing. It is the only control in the Analysis
subject that runs anything — every other panel there reads the definition, moves
a local choice, and waits.

Attribution arrives shut and says who last changed it; there is no creator on the
record.

Routes to `general.person`.

### variables

The project's Name Manager: every named table, value and function, and the only
place they are created.

A variable is stored as a *value*, not as an expression. What the panel shows is
exactly what a formula will get when it runs, so nothing here is ever stale and
no band carries a refresh.

The filter is four chips — All, Tables, Values, Functions — not the nine types a
variable can actually be. Nine is a storage taxonomy; the question a person asks
is whether a thing has rows, holds a value, or gets called. A scalar is short
enough to show, so it is shown outright. Anything else shows its type and hands
the value to a hover that reads a bounded prefix rather than the whole thing.

Two controls sit in the header. Create is primary, because defining a variable is
why a person opens this panel. Function Builder is the specialist path and opens
a modal over the whole screen.

**Create is a state of this panel, not a panel a person navigates to.** Choosing
Create swaps the Variables panel out in place for the create form; the form's
breadcrumb swaps it back. It is the only place in the panel tree where one panel
mounts another. The reason is that a variable is defined against the formulas and
fields you can see — a modal would cover exactly what you were looking at to
decide what to define. So the work surface stays where it is and the panel
becomes the form.

The form is three fields: Name, Type, Value. The name is checked against existing
names on the lookup form — lowercased, whitespace removed — because
`TargetMargin`, `targetmargin` and `Target Margin` are one variable; what is
shown back is the casing that was typed. A conflict is decided before the value
is looked at at all, and the note says so, so nothing else on the form is marked
wrong yet.

Value changes shape with type. Logic gets two options rather than a text field.
Record, List and Table get a pair editor, where a List's name column is ordinal
and cannot be renamed — positions are reordered, not renamed — while a Record's
can.

The commit sits at the end of the form it commits, not pinned. A panel has no
footer and should not gain one, but the objection is to a control buried under
content of unbounded length, and three fields are bounded. There is no Cancel:
the breadcrumb is the way out, and a Cancel beside the commit would read as the
more deliberate of two exits that are the same exit. A breadcrumb is itself
unusual for a context panel — a context panel is not normally inside anything —
and it is here precisely because the panel has entered a state that has to be
left.

What it deliberately does not do: the name manager evaluates nothing. There is no
preview band and nothing to refresh, because there is no expression to evaluate.
And leaving discards what has been entered — there is nowhere to park a
half-defined variable, and one that reappeared later against a project that had
moved on would be worse than one that did not.

Routes nowhere. The only things it opens are itself and the function-builder
modal.

## Inspector

The inspector stack for the Analysis category. Whatever is selected — in the
builder, in the strip under the chart, or on the picture itself — gets a lens
here, and together they answer one question in twenty-three shapes: what is this
thing, what decides it, and where do I go to change it. The subject falls into
five groups. There is the resting lens, shown while nothing is selected. There
are the lenses on the picture as a whole: one that is true of any kind, and one
per kind that is actually drawn, because a table makes no encoding decisions and
a bar chart is almost nothing but. There are the full-width versions of the
buttons in the strip under the chart — the two axes, the Data button and Labels.
There are the parts of the definition: a placement, a variable, a relationship, a
filter, a sort, a limit. And there are the lenses on a selection made on the
drawn result, which come as four pairs — a bar, a row, a column, a cell — each
with a plural lens beside it for when several are picked.

The plural lens is what one-of-many becomes when several are chosen, and it obeys
the same rules in all four pairs. A multiple selection is a thing in its own
right, not a list of things: the reason to open one is to change all of them at
once, so the bands are the properties they share. A property the members disagree
on is drawn as Mixed rather than as whichever one the panel read first, and
typing over Mixed sets every member — the only honest way to edit three values
through one control. Where they agree they say so rather than saying Mixed, since
Mixed is a claim about disagreement and using it for "several things" makes the
one state that matters unreadable. Mixed is computed from the members, never
assumed from their number. Units never mix: a combined total is refused when the
selection spans different ones, and the refusal takes an honest form — a subtotal
per column, per measure — instead of one number nobody can name. And each plural
lens opens on a default where the members deliberately disagree, because a
default where everything agrees hides the whole point of the panel.

### analysis

The lens the inspector shows while nothing inside the builder is selected. The
analysis's own title heads it, then its title and its saved state with the
revision beside it, a "Nothing selected" band, and a Result band that arrives
shut.

There are no crumbs. The analysis is the outermost thing the inspector can be on,
and a trail of one entry is a trail that leads nowhere. The head of the lens has
no heading either, because the title already names the analysis. The state and
the revision are shown together: either alone says nothing about staleness.

Nothing selected is a band, not a blank panel. An empty builder is the emptiest
category in the application, and without the sentence it offers no instruction at
all — so it says to drag a field from Variables onto X or Y, and to click a bar to
see what is underneath it.

Result reads the evaluator, not the record. Nothing about a result is stored, so
those two numbers are a fresh run rather than a saved answer, which is why the
band is provenance at the bottom and arrives shut.

It routes nowhere. It is instead where other lenses land: every panel that can
remove the thing it is on falls back here.

### bar-graph

The bar chart as a whole: how a number becomes a height, and which bar is which
colour. A person sees three figures first — how many bars, how many series, how
many groups — then what is across, the tallest value, and when it was evaluated.
Bands: Scale, Bars, Series, then Legend and "What a bar chart needs" shut.

This is the bar chart, not the chart. Which kind is drawn at all and what the axes
are called belong to the Chart lens; this one is only reached when bars are on
screen, and everything in it is about the bars. A button in the header goes across
to the chart settings.

Scale is first and zero-basing is at the top of it, with the reading beside it
rather than behind a disclosure, because zero-basing is a claim and not a
formatting preference: an axis starting at 400,000 draws a bar twice the height of
another whose value is a fifth larger. Whichever way the toggle sits, the sentence
under it says what the bars can and cannot be read as.

Bars holds stacking, orientation and spacing. Stacking is disabled with one series
— one series has nothing to stack against — and when two series are summarised
differently the panel says the chart would be adding customer-minutes to event
counts and the total would mean nothing.

Series lists each one with the colour it takes, as role-token swatches, and each
row opens the placement behind it. Legend, shut, warns when there are two series
and no legend that nothing on the chart says which colour is which.

Gaps: orientation and spacing have nowhere to live — a chart carries a kind, a
title, two labels, zero-basing, stacking, a legend position and a palette, and
nothing else. And nothing here writes back.

Routes: the header button to `analysis.chart`, series rows to
`analysis.placement`, crumbs to `analysis.analysis`.

### bars and bars-multi

One bar: what it is drawn as, and what it stands for. Head: the group, the series,
the value, and where it ranks among the bars drawn. Then a meter for its share of
the series, because a bar is read against its neighbours — 1,842,000 says nothing
on its own, and a third of everything drawn says what the eye is already claiming.
Bands: Series, Drawing, Actions.

A bar is a group and a series, never a group alone. Two measures make two bars
over the same substation, and a lens that named only the substation would be
identical for both while describing one. The Series band lets the reader move
between them and says what placement drew the one in view, along with the tallest
bar in that series against this one.

The mark lens answers what is underneath a bar; this one answers what the bar is.
Two questions, and one panel that tried to be both would open on three source rows
when the reader clicked a colour they did not recognise. The way from here to
there is a button rather than a merge.

Drawing offers a colour and a label, and its gap says why neither is really
offered: a colour belongs to a series and a label belongs to a value, so neither is
a property of one bar, and per-bar overrides would need somewhere to key them.
Actions carries the same warning as the mark lens — filter and exclude change the
definition from a click on the picture, and that has to be undoable in one step
before either can take it. Nothing writes back.

Several bars: Selection, In common, Together, Actions. The selection arrives as
group-and-series pairs, because a bar is a group and a series and neither
identifies one alone. In common offers series, colour and label — colour follows
the series, so two series is two colours, and labels are group names, so several
bars never agree unless one is selected twice. Summarised is shown and not
offered: changing it here would rewrite two placements from a selection made on
the picture, and that is a bigger act than this panel should take quietly.

Together is a band because it is why anyone shift-clicks bars in the first place —
four bars summing to two thirds of the chart is the answer somebody was after. It
is refused rather than printed when the members are summarised differently, since
customer-minutes and event counts do not add, and falls back to the largest and
the smallest. When the selection sits inside one series it also says what
percentage of that series it is.

Routes: the single bar's What is underneath, and every member row in the plural
lens, open `analysis.mark`. Both crumb to `analysis.analysis`.

### cell and cells-multi

One cell: a row and a column, and the rows that were collapsed to make it. Head:
the group, the column, the value, where it came from and how it was summarised.
Then a meter for its share of the column, which is what a share is a share of.
Bands: Show as, Underneath, Actions.

A cell is computed, so it has no properties of its own. There is nothing here to
set — the value came from a placement, a filter chain and a grouping — which is
why the panel is a reading of it and two ways out rather than a form.

Show as is this panel's own and says so. A per-cell format has nowhere to be
stored, and a control that silently reformatted the table would be claiming
otherwise; what it changes is what this panel prints, and the table still draws
the number it drew.

Underneath is the source rows the cell collapsed — a second query rather than a
property of the result, and whether they are computed on selection or carried in
the result changes what the evaluator has to return.

The gap on Actions: filter and exclude narrow by the group rather than by the
cell. A condition on one cell has no meaning, because there is no stage that runs
after the grouping for it to sit in — and a rule that kept one measure of one
group and nothing else would leave the table with a hole in it.

Several cells, dragged or shift-clicked across the table: Together, Selection, In
common, Actions. The figures are the point, so Together is the first band rather
than a summary at the bottom — selecting a block of cells is how anyone asks what
these come to. It is refused when the members span columns with different units,
and a subtotal per column is the honest form of that refusal: it answers the
question for each unit separately instead of printing one number nobody can name.
The selection arrives as row-and-column pairs, because a cell is a row and a
column and neither identifies one alone.

Choosing a column in In common moves every selected cell into it, which is a
different block of cells rather than an edit to this one, and the panel says so.
Its gap: summarising is a property of the column, so setting it here changes every
cell in those columns and not only the selected ones, and whether a selection
should be able to do that at all is undecided. The Actions gap: a filter narrows
rows, so it acts on the groups these cells sit in rather than on the cells, and
there is no rule that keeps part of a row.

Routes: the single cell's What is underneath, and the plural lens's member rows,
open `analysis.mark`.

### chart

How the result is drawn, whatever kind it is: the kind, the picture's own title,
the axes, the legend and the colours. The panel is titled with the picture's
title. Bands in order: Kind, Title, Axes, then Legend, Colours and "Not yet
modeled" shut.

Kind is first because every band under it changes meaning once it changes. What
the chosen kind draws with is stated under it as guidance rather than as a rule —
the minimum-field rules are undefined, so picking a kind that wants another field
opens an empty zone for it in the builder rather than refusing.

The title here is the picture's, not the saved thing's. The analysis has one of
its own, edited in its own lens: one is what the chart says, the other is what the
saved thing is called. Two titles is one too many if nobody ever sets them
differently, and that is stated as a gap rather than resolved.

The two axis labels and the two flags — Y starts at zero, Stacked — are one band
because they are one decision: what the axes say, and what they imply. A Y axis
that does not start at zero is a claim about the shape of the bars, not a
formatting preference.

Colours are shown as role tokens rather than values, so a chart pasted into a
slide comes out in the deck's palette instead of carrying four colours from
another document.

The closing gap: colour, size, detail, label and tooltip are not persisted
encodings. The empty Colour zone the builder shows is a proposal, not something
that can be saved.

Crumbs go back to `analysis.analysis`.

### column and columns-multi

One column of the table: the placement behind it, and what it does to the rows.
Head: the key, the role, the position, and where it came from with its type.
Bands: Heading, Summarise by, Order, Values for a measure, then Drawing shut, then
Actions.

A column is a placement wearing a heading. Everything that decides what is in it —
the field, the summarising — belongs to the placement, so this lens edits those
rather than inventing a parallel set beside them, and a button in the header opens
the placement directly.

The group column is not a measure and is not offered one. Summarising the column
that names the rows would collapse the rows themselves, so the band says what the
column is instead of showing a control that must not be used.

Order by this column is the sort, not a column property. A table with two columns
each claiming their own order has no order at all — so when another column holds
the order, this one says so: one table, one order. The preview under Values is
re-ordered by whatever the Order band claims, because the band sits directly above
it and an order it claims and the preview ignores is a claim the reader can see is
false.

Gaps: the total under Values is a sum of sums, which is the wrong answer for an
average or a count of distinct values, and the evaluator would have to return it
rather than the panel adding a column up. Alignment and width are not properties a
column can hold — figures are drawn trailing and names leading because of the
type, which is a rule rather than a setting. And nothing writes back.

Removing the column removes the placement that produced it, and leaves nothing to
inspect, so the panel falls back to the analysis.

Several columns: Selection, a two-figure count of measures against group columns,
In common, Actions. The offered aggregations are the intersection, not the union —
three columns of three types share only what all three permit, and offering Sum
because one of them is a number would set it on two that cannot take it; the panel
says how many are left and why. Alignment is mixed here because it follows the
role — names lead, figures trail — and the panel says so rather than picking one
and calling it the answer. A selection holding both a group column and a measure
gets a sentence saying summarising applies to the measures and would collapse the
group column.

The gap: one heading across several columns makes them indistinguishable. The
field is offered because a shared prefix is the common case, and there is no way to
edit part of a value through a control that replaces the whole of it.

Routes: the single column's header button and the plural lens's member rows open
`analysis.placement`; its Sort button opens `analysis.sort`; both removals fall
back to `analysis.analysis`.

### filter

One rule about which rows are kept. The head names the field by its variable,
because two variables can both have a `name` column; then the operator and the
value; then Effect, Actions, and Types shut.

It is phrased as *keep rows where*, not as a condition. A filter stated as a bare
comparison leaves the direction ambiguous, and a reader who guesses the wrong way
reads every number under it backwards. The title is derived from the operator and
the value, so it follows the edit above it.

Effect is a band rather than a caption. A filter with no visible effect is usually
a mistake, and the panel cannot say so without both counts — so it prints rows in
and rows kept, and says outright when the rule removed nothing. The gap under it:
per-filter counts take a run with the rule and a run without it, and whether that
is affordable needs checking before the band is promised.

The Types band, shut, carries the other gap: the field has a type and the value
above is still edited as text. A date picker for a date and a range for a number
wait on a column-schema and type-inference contract for heterogeneous table
values.

Remove falls back to `analysis.analysis`.

### labels

Everything the Labels button offers: what the picture says, and what is drawn at
all. Bands: Show, Text, Series, Replace, with a Revert action in the header that
puts everything back to the saved labels.

A label toggle is the text going away, not a flag. What a chart holds is strings
and a legend position; nothing in it says "hidden". So switching a label off
empties it and switching it back on restores what was there — one value with one
meaning, rather than a flag and a string that can disagree about whether an axis
is labelled. What the text was before it went off is remembered, because otherwise
switching back on hands back the saved value rather than the one just typed, which
reads as the panel throwing an edit away.

Show also carries value-on-each-bar and gridlines, and that is where its gap sits:
those two have nowhere to live. Text holds the chart title and the two axis
labels, and repeats the division — this title is what the picture says, the
analysis carries another that is what the saved thing is called. Series names each
one as the legend calls it, starting from the field name, which is rarely what a
chart should say.

Replace is one find-and-replace across every label at once, because the labels are
written by four different things — the chart, the two axes and each series — and a
name that was wrong is wrong in all of them. It reports how many labels changed,
or that nothing on the chart says that.

Replace acts on the labels, never on the data. The names along the axis are values
in a column, and rewriting them here would be a chart quietly disagreeing with the
table it came from — so the band prints the first few of those tick names to make
the point about something visible. The gap under it: renaming a category for
display has nowhere to be stored, being either a change to the source or a
per-chart alias table, and neither exists. And nothing here writes back.

Crumbs go to `analysis.analysis`.

### limit

How much of the result is shown: keep top so many, of so many groups. Then a Note
band and Actions. When nothing limits the result the panel is one sentence saying
every group it produces is drawn.

Both numbers, always. How many are kept without how many there are says nothing: a
bar chart of the top ten looks exactly like a bar chart of everything. The word
"top" is prose around the control rather than part of it — the number is what is
edited, and the word is what the number means.

The Note band says what "top" means rather than leaving it to the reader. It names
the sort the limit falls back to, and says plainly when there is none that which
rows survive is arbitrary. It also records that the limit is shown next to the
chart as well as here, so a truncated view is never mistaken for the whole.

The gap: whether a limit should require a sort, rather than name the order it
falls back to, is undecided.

Remove falls back to `analysis.analysis`.

### mark

One mark on the chart: what it stands for, and the rows underneath it. This is the
way from the picture back to the data, and it is what makes a chart investigable
rather than decorative. Two bands and an Actions band.

The first band is named for the kind of mark it is — this bar, this point, this
slice. A bar, a point and a slice are the same selection wearing three shapes, and
a panel that calls all three "this bar" is wrong two times in three. It lists
every encoded value, each named by the placement that put it there.

Underneath lists the source rows the mark collapsed. Those rows do not open
anything: a source row has no lens of its own here, and a row that looks clickable
and is not is worse than one that does not.

Filter to this and Exclude are stated before they are taken. Both change the
definition from a click on the picture, which is the right gesture and one that
has to be undoable in a single step — so the panel says what the click would add
rather than adding it silently.

The gap: the rows underneath are a second query rather than a property of the
result, and whether they are computed on selection or carried in the result
changes what the evaluator has to return.

### placement

One field on an axis: which field, how it is summarised, what it is called on the
chart. This is the most common selection while building. The head names the source
variable, the field and the type — naming the variable matters, because two
variables can both have a `name` column. Bands: Summarise by, Label, Actions.

What the row reads is derived, not stored. Changing the aggregation changes the
name of the thing being inspected, so the title and the trail follow the control
rather than lagging a revision behind it. The zone is in the trail too, so moving
the placement is visible where it happened.

Summarise by offers only what the field's type permits, and says why the set is
short so a missing option does not read as a missing feature. Label starts from
the field name, which is rarely what a chart should be labelled.

Actions are the two moves and then the destructive one: move to the other axis,
move to Filters, remove. Move to Filters is refused while the placement is
summarised — moving an aggregated placement to Filters has no obvious meaning, and
refusing is the half of that question this panel can answer honestly. Whether it
should instead drop its aggregation on the way is undecided, and the panel refuses
rather than guessing.

Removing leaves nothing to inspect, so the panel falls back to
`analysis.analysis`.

### relationship

Two variables that need relating before a chart can be drawn, and the fix. The
panel is titled for the problem, not the feature. This is what a join step becomes
here: it appears only when two variables are actually in play, and it is stated as
a problem to solve rather than as a modelling stage to get through first. Bands:
Why you are seeing this, Currently matching on, Other ways they line up, Actions.

The key is presented as a guess, because it is one. The match count sits beside it
and the alternatives keep the order the inference gave them — re-ranking a list of
guesses by coverage makes it look like analysis, and a high count is not on its
own a good key. That is also the gap on the alternatives band: a ranked list of
guesses is more dangerous than one guess, because it looks like analysis.

Either side of the key can be chosen by hand, in place, in the same band rather
than in a second one. A hand-made pair shows no coverage: nothing has counted it,
and a blank where a number belongs is more honest than a number nobody computed.

What happens to rows that do not match sits with the key rather than behind a
further disclosure, because it is the part that changes the answer. The gap there:
the modes are in plain words rather than inner, left, right and full — right for
reading, ambiguous for anyone who knows the standard names, and whether both
should appear is a review question.

Committing sends the reader back to the chart, which is the thing that changed:
`analysis.analysis`.

### row and rows-multi

One row of the table: the group it names, and every measure under it. Head: the
group and its position — and the position carries the ordering that produced it,
or says there is none, because third of six means nothing without saying third by
what. Then a meter for its share of the first measure. Bands: Measures, Drawing,
Actions.

A row is a group, not a source record. Six rows came back from 4,182 events, so
"this row" is a substation and the events are underneath it — which is why What is
underneath is a button rather than the body of the panel. Each measure names the
placement that produced it, so a figure opens the field behind it.

Drawing offers a label and a hidden flag. Hidden means hidden from the table and
still in the totals, which is the reading a filter would not give. Neither
survives a reload: a row is a group the evaluator produced, so a label or a hidden
flag on one needs a per-value alias table nobody has designed.

Several rows: Selection, Together, In common, Actions. Together comes before In
common here, because a set of rows is usually picked in order to be added up. It
sums each measure separately — customer-minutes and event counts are different
units, and a single combined figure across them would be a number with no name —
then gives the share of the first measure, how many of all the rows are selected,
and the span of positions with the ordering that produced them.

Visibility is kept per row rather than as one answer for the selection. Nothing
stores a row's visibility, so every member reads Shown until told otherwise; but a
selection that later covers rows this panel set differently is genuinely mixed,
and one shared value could never report that. One control over several rows means
nothing unless it sets every one of them, so it does, and the member rows show
their own state, so setting the whole selection hidden is visible row by row.

The gap on Actions: a rule over several values needs an *is one of* operator. The
filter model has is, is not, ≥, ≤ and between, so this would arrive as one rule per
member or not at all.

Routes: the single row's measure rows open `analysis.placement` and its What is
underneath opens `analysis.mark`; the plural lens's member rows open
`analysis.mark`.

### sort

What the result is ordered by: a target, a direction, and a sentence saying how the
result comes back. When nothing orders the result, the panel is that one sentence
and nothing else.

The target is a placement, never a bare source field. Sorting by `customerMinutes`
when the chart shows `sum of customerMinutes` means something else entirely, so
the control offers what is on an axis and nothing beyond it.

The gap sits with the destructive action at the bottom: only one sort is offered,
and whether a second as a tiebreak is ever wanted is undecided — the model would
need an ordered list rather than a single value.

Remove falls back to `analysis.analysis`.

### table-graph

The table as a whole: what it holds, how much of it, and in what order. Three
figures first — columns, rows drawn, groups in all — then the title and when it
was evaluated. Bands: Contents, Columns, Rows, then Drawing shut.

A table makes no encoding decisions, which is what this lens is for. A bar chart's
panel is full of questions about how a number becomes a height; a table's is about
shape — which columns, how many rows, what order — so those are the bands and
there is no colour band at all.

Rows and order are the same band. A limit without a sort keeps an arbitrary ten,
and separating the two lets a reader set one and never see the other. The order
and the limit are applied to the preview rather than described, because the rows
they act on are on screen directly above the controls: a band naming an order the
table below it did not follow is the one reading a reader can check and catch. It
says so plainly when nothing orders the rows — which of them survive the limit is
then arbitrary — and reports how many of how many are being kept.

A column is a placement wearing a heading, so each row in Columns opens the
placement. The group column names each row; the measures are what was counted
under it.

Drawing — header row, banded rows, totals row — is shut and gapped: none of the
three is a property a chart can hold, and a totals row is the one that also needs
an answer from the evaluator, because a sum of sums is not always the sum. And
nothing here writes back.

Routes: the header button to `analysis.chart`, column rows to
`analysis.placement`, the two buttons in Rows to `analysis.sort` and
`analysis.limit`, crumbs to `analysis.analysis`.

### variable

A variable as the Analysis category sees it: what is in it, how it lines up with the
others, and where to put it. It drops the authoring detail a variable carries
elsewhere — lookup key, order — and adds the one thing only this category cares
about. Head: name, type, and a row count. Bands: the value itself, Relates to,
Use.

Rows are printed for tables and nothing else. A value has no row count, and a lens
that prints one for it is inventing a shape. A table shows a short prefix of
itself, which carries its own "3 of 4,182 rows" so the heading does not say it
twice; a value simply shows its value.

Relates to lists the other variables this one lines up with, each with its pairing
and either "Used by this chart" or a match count, the one in use marked. A
variable that lines up with nothing says so, and says that only tables relate to
other variables. The gap: these pairings are inferred, and without a real
key-inference contract they are guesses presented as facts — the chart one
produces is silently wrong when the guess is wrong.

Use is the keyboard path to what dragging does: pick a field, then Put on X or Put
on Y. The buttons act on a field and not on the variable, because putting a table
on an axis is not meaningful — so a table picks a field first, and a value instead
gets a sentence saying it is a reference line or a filter value and that an axis
takes a field from a table. The gap: whether those buttons should exist only on
field rows instead is still open.

Relation rows open `analysis.relationship`.

### x-axis, y-axis and data-button

These three are one set and are best read as one. Each is the full-width version
of a button in the strip under the chart, and all three ask the same questions in
the same bands: select data, create join, sort, set condition. Y says so outright
— an axis is an axis, and two panels that answered the same four questions in two
shapes would be two things to learn.

The axis is the subject, not the placement. The strip has one button per axis, so
the lens it opens has to be about the axis: which field is on it is the first
thing the lens *asks*, not the thing it was opened on. The placement lens is the
other one, for a field already placed.

**Select data** offers the variable, then the field, with the field's type beside
it. Changing the variable clears the field, because a field name carried across
from the previous table usually names a column that is not there — and where it
does exist it is worse, because a key like `regionId` sits on both tables and the
axis would quietly re-point at another table's column under the same name. The
band closes with what the choice means: what the bars stand for on X, how tall
they are on Y.

**Create join** appears because of what is on the other axis. Two variables in
play is what makes a join necessary, so switching the source above opens or closes
the band rather than leaving it standing there permanently as a modelling stage to
get through — which is exactly the interface this category exists to avoid. When
both axes read the same variable it says there is nothing to join and what would
make a pairing appear. When they differ it names both variables, offers the
pairing to match on and what to do with rows that do not match, reports how many
rows the pairing matches, and offers a way through to the relationship itself.

**Sort** is a toggle, a target and a direction. The target is always a placement
and never a bare field: `customerMinutes` and `sum of customerMinutes` order the
bars differently. Unordered says the groups arrive in whatever order they group
in.

**Set condition** lists the conditions already narrowing this axis's variable —
the rest belong to another axis — then offers an operator and a value, and states
the rule it would add rather than adding it.

What each one adds on top of that shared shape:

X holds one field, so it has no list at the top. Y is the axis that stacks: it
opens on a list of series and asks which one the bands below are about, because
writing it as a single hidden subject would make the second series unreachable
from the button that owns it. Y also offers to add a series, stated rather than
taken.

Y shows how the series is summarised and does not set it. `sum of` versus `count
of` is what the Data button decides, and repeating the control would give one
value two owners and let them disagree — so the band prints it and says why it is
printing rather than offering. That division of ownership is the whole reason Data
is a separate panel.

Data is the measure, and a measure is a field plus a way of collapsing it. That is
the entire difference between it and the two axis lenses: an axis decides what a
bar stands for, and Data decides how tall it is. Its extra band is Select
aggregation, and the permitted set comes from the field's type — a text field
cannot be summed, so the set shrinks when the field changes rather than offering
six options and failing on four of them. When the set is short the panel says why,
so a missing option does not read as a missing feature. The chosen aggregation is
kept legal: switching to a text field while Sum was on would otherwise leave a
control showing a value its own set no longer contains.

What Data reads is derived, not stored. Changing the aggregation changes the name
of the column it produces, so the heading follows the control instead of lagging a
revision behind it — and that same string is what a zone row reads, what a result
column is keyed by, and what a sort names its target by. When the combination is
not in the current result the panel says so, and notes that the chart still draws
the saved one. Its list of measures aims the bands below at whichever is pressed;
opening the placement is the way *out* of the panel, so it is a button under the
list where it cannot be hit by accident.

The gaps differ by panel. On X's join band: the pairings are inferred and listed
in the order the inference gave them, and a high match count is not on its own a
good key — a region reaches every substation and is still wrong. On Y's join band:
every series on this axis shares the one relationship, so two series from two
different variables would need two, and there is one. On X's condition band: the
value is typed as text whatever the field's type is, and a date picker for a date
and a range for a number wait on a column-schema contract. On Y's and Data's
condition bands: a condition narrows the rows before they are summarised, which is
the only stage there is, so filtering on the summarised value instead — bars over
a million — would need a rule that runs after grouping and there is no such stage.
All three close with the same sentence: nothing here writes back.

Routes: all three crumb to `analysis.analysis`; condition rows open
`analysis.filter`; the join band opens `analysis.relationship`; Data's list opens
`analysis.placement`.

## What is not here

Nothing in this stack writes. There is no path that adds a placement, a filter, a
sort or a limit, so every panel reads the definition, moves a local choice, and
waits. The consequences run through all four: a chart kind that is picked but not
saved, zones that cannot be added to, filters and sorts with no identity that
survives a reload, and a compiled expression that can be read but never edited.

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

**Attribution is thin, and thin differently on each panel.** The project records
neither a creator nor an updater and says its dates are dates only. A document
and a template record a creator and no creation time. An analysis records who
last changed it and no creator at all. Each panel says which half it has instead
of drawing an empty pair, and none of them guesses.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.

**Almost nothing here creates.** Nothing counts template uses, starts a thread,
creates an analysis, or mints a template. Where a New button exists it opens a
lens, lands the centre on a blank id, or reaches for an existing row it has not
already opened — it does not make a record this panel would then fail to list.

**Nothing writes back.** Every lens on the picture, on the strip and on a
selection closes with the same sentence: each control holds its answer locally
until an analysis definition exists to save it into. The lenses on the parts of the
definition — placement, filter, sort, limit — end instead on their own particular
gap, but they are in the same position.

**There is no stage after the grouping.** Three panels run into it from three
directions: a rule about a summarised value (bars over a million) has nowhere to
run, a condition on one cell has no meaning, and a totals row needs an answer only
the evaluator can give because a sum of sums is not always the sum.

**There are no per-value overrides.** A row label, a hidden row, a per-bar colour,
a renamed category on an axis: each needs a table keyed by a value the evaluator
produced, and no such table has been designed. Every one of them is offered
locally and gapped in the same terms.

**Drawing properties have nowhere to live.** Orientation, bar spacing, gridlines,
values on bars, header rows, banded rows, column alignment and width. A chart
carries a kind, a title, two axis labels, zero-basing, stacking, a legend position
and a palette, and nothing else.

**Types are not honoured in the inputs.** Every filter value is typed as text
whatever the field is. A date picker for a date and a range for a number wait on a
column-schema and type-inference contract for heterogeneous table values.

**The relationship is inferred, and there is one.** Pairings are guesses listed in
the order the inference gave them; coverage is reported and deliberately not used
as a ranking; and an analysis holds one relationship, so two series from two
different variables would need two.

**Filters have no *is one of*.** A rule over several selected values arrives as
one rule per value or not at all.

**Two titles.** The analysis has one and the picture has one. That is one too many
if nobody ever sets them differently, and which of them a reader is editing has to
be said in both places.
