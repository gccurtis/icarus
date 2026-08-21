# A generated block

| Selecting | What it is | Sections |
| --- | --- | --- |
| A row in Knowledge → Generated blocks using this | Something written against this Context, and where it lives | Prompt · Lives in · Runs · Provenance · Owner lookup |

Shown here because changing the scope changes what these produce next time. It is
the consequence view for an edit you are about to make.

## Layout

| 300px |
| --- |
| prompt |
| lives in |
| runs |
| provenance |
| owner lookup |

## Prompt

What the block asks for.

**Shows** — "Summarise this week's outage reports by substation."

**Needs** — the prompt text.

## Lives in

Where it is, so it can be opened.

**Shows** — *Q3 Resilience Memo · page 2* — Prompt block

**Needs** — the owning resource and a location within it.

## Runs

When it regenerates: on open, and whenever the block is re-run. What it produces
is generated against this Context as it stands at that moment.

Stated here because it is the reason this section exists — the connection between
editing a scope and changing a document.

**Needs** — nothing.

## Provenance

Starts collapsed.

**Shows** — `Scope · Everything but drafts`, `Model · analyst-default`

**Needs** — scope and model binding on the `DerivedOutput`.

## Owner lookup

**Open** — `DerivedOutput` stores no owner pointer, so finding the prompt block
that owns it is a reverse query. That gates the *Lives in* section above.
