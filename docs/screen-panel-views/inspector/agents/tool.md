# A tool

| Selecting | What it is | Sections |
| --- | --- | --- |
| A tool in the Tools view | One permission, and what granting it means | Tool · What it does |

## Layout

| 300px |
| --- |
| tool |
| what it does |

## Tool

Name and whether it is allowed, as a toggle — the one edit this lens exists for.

**Shows** — `Name · lattice.retrieve`, `Allowed · on`

**Needs** — the tool identifier and the persona's allowance for it.

## What it does

What the tool actually does, phrased in terms of consequence rather than API.

**Shows** — "Retrieves verbatim regions from the knowledge lattice, within what
this Persona can look up."

The clause at the end matters: a tool's reach is bounded by the persona's scope,
so granting a retrieval tool is not granting access to the project.

**Needs** — a static description per tool, from the tool catalogue.

**Open** — the catalogue has to carry these descriptions, and they have to be
written for someone deciding whether to grant a permission rather than for
someone calling the tool.
