# Tools

| View | What it is for | Sections |
| --- | --- | --- |
| Tools | What this agent may do, and which model runs it | Allowed · Not allowed · Model |

Permissions, split rather than checkboxed, so what is denied is as visible as
what is granted — a task that failed because a tool was not permitted is
diagnosed here.

## Layout

| 300px |
| --- |
| search |
| allowed |
| allowed |
| not allowed |
| model |

## Allowed

**Shows** — `lattice.retrieve`, `resource.read`, `finding.create`,
`analysis.evaluate`

**Needs** — the persona's tool allowance, and the full tool catalogue to draw from.

## Not allowed

**Shows** — `resource.write`, `web.search`

**Needs** — as above, inverted.

**Open** — tool availability is operational, not decorative. There is no universal
"Web" toggle: `web.search` is a tool like any other, and a persona either has it
or does not.

## Model

Which binding runs it.

**Shows** — `analyst-default` — A binding name, not a credential

**Needs** — the model binding on the persona.

Provider credentials never appear here. Providers, credentials and deployment
setup belong outside the project workbench entirely.

## Panel furniture

A search over tools.
