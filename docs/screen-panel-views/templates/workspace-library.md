# Templates — all templates

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The default state | Every template available here, as shapes | Header · Filters · Templates · Note |

## Layout

| 1fr |
| --- |
| header |
| filters |
| templates |
| templates |
| note |

## Header

**Shows** — "Templates" over "A real body with variables left open. Using one
makes an independent copy — later edits to the template never reach it.", and
**New template**

**Needs** — the create route. The subtitle carries the one rule about templates
that is easy to get wrong.

## Filters

Two filter groups, separated: scope, then target kind.

**Shows** — a search, then `All` · `Project` · `Global`, a separator, then
`Document` · `Slide deck` · `Slide` · `Spreadsheet`

**Needs** — the template query to accept a search, a scope and a target kind.

## Templates

Cards. A template is a shape, and a preview identifies it faster than a name.

**Shows** — a thumbnail rendered from the real body with the variable regions
distinguishable, then *Regulatory filing shell* — Document · Project — 4 variables

**Needs** — `Template` records, and a small renderer for a body.

**Open** — marking the variable regions in the preview requires knowing where they
are, which is the gap that gates the whole screen.

## Note

One line: previews are rendered from the real body. The model has no thumbnail,
tag, category, favourite or usage count, so the library does not pretend those
exist.

**Needs** — nothing.
