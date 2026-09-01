# Analysis

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

## The analysis

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

## Chart

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

## Bar chart

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

## Table

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

## X — across, Y — up, and Data

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

## Labels

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

## Placement

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

## Variable

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

## Relationship

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

## Filter

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

## Sort

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

## Limit

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

## Mark

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

## Bar, and several bars

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

## Row, and several rows

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

## Column, and several columns

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

## Cell, and several cells

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

## What is not here

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
