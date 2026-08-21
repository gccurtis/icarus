# Formula

| View | What it is for | Sections |
| --- | --- | --- |
| Formula | What the builder compiled to | Compiled · Evaluation |

A diagnostic. It answers "why did I get that" when the chart is not what you
expected.

## Layout

| 300px |
| --- |
| compiled |
| compiled |
| compiled |
| evaluation |

## Compiled

The expression the builder produced, read-only.

**Shows**

```text
=SORT(LIMIT(GROUPBY(
   RELATE(outageEvents, substations, "subId", "id"),
   ["substations.name"],
   [SUM("customerMinutes"), COUNT("eventId")]
 ), 10), 2, "desc")
```

Read-only deliberately: editing it would break round-tripping back to the
builder, so it is a diagnostic rather than a second way to author.

**Needs** — a compiler from `AnalysisDefinition` to the formula language.

**Open** — a read-only expression that people can see but not use is a temptation.
If editing is ever wanted, it needs a parser back into the definition, not a
one-way escape hatch.

## Evaluation

Cost and size of the last run. Starts collapsed.

**Shows** — `Ran · 2 minutes ago`, `Rows · 6 of 41`, `Duration · 0.4 s`

**Needs** — the evaluator's timing and row counts.
