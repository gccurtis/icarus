# A tool call

| Selecting | What it is | Sections |
| --- | --- | --- |
| A row in the Trace view | One step the agent took: what it asked for, and what came back | Call · Input · Output |

The lowest level the screen goes to. It exists so that a weak answer can be
diagnosed rather than argued with.

## Layout

| 300px |
| --- |
| call |
| input |
| input |
| output |

## Call

**Shows** — `Tool · lattice.retrieve`, `State · Success`, `Duration · 1.2 s`

**Needs** — the tool-call record with name, outcome and duration.

## Input

The arguments, verbatim.

**Shows**

```json
{ "query": "coordination study after reconductoring",
  "scope": "rs_field_reports_2024_25" }
```

**Needs** — the stored call arguments.

**Open** — raw JSON is honest and unreadable. Whether this is rendered or shown as
stored is a review question; the query and the scope are the two parts anyone
actually reads.

## Output

What came back, summarised, plus the fact that makes this record matter: the
exact resolved scope and manifest used are recorded on the call. That is where
historical scope truthfully lives — not on the thread, which can be edited
afterwards. Starts collapsed.

**Shows** — "4 regions across 3 sources."

**Needs** — the call's result summary and its resolved scope manifest.
