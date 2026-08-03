# Structured Analytic concepts

## Definition

The saved recipe: inputs, joins, two shelves of placements, filters, sorts, an
optional limit, and a display. It is what is stored, versioned, and edited, and
it is returned with every pull.

## Input, and why it is selected by name

An input names a Structured Data entry. **The name is the selector**; the
recorded `entryId` is only a repair hint.

That is the opposite of most references in this backend, and it is deliberate.
An analytic is authored against names a person typed, and a name is what they
will look for when they come back. Selecting by id would make an analytic
survive a rename silently but break invisibly when someone rebuilds an entry
under the same name — which is the more common thing to do.

Recording the id as well buys the good half of id-selection back: if a name
stops resolving but the recorded entry still exists under a new name, the input
was **renamed**, and the definition heals itself.

### `as`, and why the key is not the name

An input's **key** is `as ?? name`. `as` exists for one reason: a self-join,
where one definition uses the same source twice and the two sides need
different handles.

It also does a second job. Because the key is what every field reference, join
side, and `ASTABLE` coercion points at, healing a rename must not move it — so
a heal pins the old key as `as`. Without that, renaming `Orders` to
`Sales Orders` would rename the handle too, and a list-valued input would
synthesize a column nothing referenced.

## Placement, and the two shelves

A placement puts one field of one input on the **Rows** or **Columns** shelf,
with an aggregation. Its output column is named by its `label`, falling back to
the source field name.

A placement whose aggregation is `none` is a **dimension** — it groups. Any
other aggregation makes it a **measure**. That distinction, not the shelf, is
what decides whether a definition compiles to `GROUP` or `AGGREGATE`, and
whether a chart can render it.

## Display

Part of the recipe, not a view setting — stored as an object rather than a bare
enum so richer renderings (side-by-side panels, overlaid series, dual axes) are
additive rather than a migration of every persisted definition.

Its contract has two halves. The **structural** half — how many pills on which
shelf, aggregated or not — is checked at save, because a definition failing it
can never render for any data. The **data-dependent** half is checked during a
pull, because only data can answer it.

## Pull, and its receipt

A pull compiles, evaluates, and shapes the result. It returns the data, the
definition that produced it, and a **receipt**: exactly which entry answered for
each input, at which revision, and whether it was `ok`, `renamed`, or
`retargeted`.

The receipt is built from the evaluation's `observedDependencies` rather than
from bookkeeping the capability keeps alongside it — so it reports what the
calculation actually read, and cannot drift from it.

**Revisions, not digests.** An earlier design recorded a digest of each input's
value. It was dropped: a digest tells you *that* something changed and never
*what* or *why*, which is the only question anyone asks next.

## Check

The same question as a pull's receipt — has anything moved — without the pull.
Metadata only: no resolver snapshot, no evaluation, no rows. That cheapness is
the whole point, and a test pins that `check` never builds a snapshot.

`check` reports a fourth status a pull cannot: `missing`. A pull raises on an
input that resolves to nothing; a check reports it and carries on, because
answering "what is broken" is its job.

## Save versus copy

Two ways an analytic becomes project data, and the trade runs opposite:

| | `save` | `copy` |
| --- | --- | --- |
| Writes | the compiled formula | the rows resolved right now |
| Stays live | yes — moves when its sources move | no — frozen |
| Can fail on data | **no**, nothing is evaluated | **yes**, it is a full pull |
| Exact numbers | yes, Formula's rationals | no, JSON scalars |

A broken source does not stop a `save`; the saved formula simply starts working
when the source is fixed. The same broken source fails a `copy` outright.

Both produce an ordinary Structured Data entry, so anything that can reference a
name can reference the result. There is no analytic-shaped thing in the data
model, and a saved analytic used as another analytic's input is ordinary formula
composition — the resolver's existing fixpoint ordering handles it and its
existing cycle error rejects a loop.
