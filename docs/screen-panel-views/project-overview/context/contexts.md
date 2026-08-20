# Context

| View | What it is for | Sections |
| --- | --- | --- |
| Context | The project's saved scopes, and the way to the screen that edits them | Saved Contexts |

A Context is a live rule about which resources something may look at. This view
lists them with what each resolves to right now; editing one happens on the
Context tab.

Present here because a scope is a project-level fact people need to check without
leaving what they are doing.

## Layout

| 300px |
| --- |
| search |
| saved contexts |
| saved contexts |
| saved contexts |
| footer |

## Saved Contexts

Each row is a name and a current count. The count is the useful part: it says
whether the rule still means what it meant when it was written.

**Shows**

- *Regulatory corpus* — 34 resources
- *Field reports 2024–25* — 96 resources
- *Everything but drafts* — 211 resources
- *Storm precedents* — Resolves to 0 resources

**Needs** — `ResourceSet` records with a live resolved count per set.

**Open** — a zero-member Context currently broadens retrieval to the whole
project rather than restricting it to nothing. It is shown with a warning and
blocked from dispatch until an explicit-empty sentinel exists.

## Panel furniture

A search across Contexts, and **Open Context screen** at the foot.
