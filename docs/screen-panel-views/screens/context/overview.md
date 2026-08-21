# Context — panels

A saved scope, said plainly: what is included, what is taken out, and the
resources that survive. The rule stays live — a document created tomorrow that
fits the rule is in it without anyone editing anything.

Two subscreens: **one Context** and **all Contexts**. One Context tab; which
Context you are on is view state.

## Context panel — one Context

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/context.md) | This Context: what it is, what it resolves to, whether it is saved | This Context · Right now · Saved · Used by |
| [Contexts](../../context/scope/contexts.md) | Switching to another saved scope | Saved |
| [Add](../../context/scope/add.md) | Putting something into either half | By rule · By name |
| [Contents](../../context/scope/contents.md) | What actually survives, and what is unsaved or broken | Problems · Unsaved changes · Contents |
| [Knowledge](../../context/scope/knowledge.md) | What can be retrieved from it, and what is generated against it | What can be retrieved · Generated blocks using this · Lattice, debug only |
| [Used by](../../context/scope/used-by.md) | What depends on this Context | Personas · Prompt blocks |

## Context panel — all Contexts

| View | What it is for | Sections |
| --- | --- | --- |
| [Contexts](../../context/library/contexts.md) | Every saved scope in the project | Saved |
| [Resources](../../context/library/resources.md) | Everything a Context could name | Documents · Findings · Connector files |

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A Context | The scope itself: its rule in plain words, and what it resolves to | [context.md](../../inspector/scope/context.md) |
| "Everything in this project", on Include | A live rule covering the whole project | [include-everything.md](../../inspector/scope/include-everything.md) |
| Another Context, on either half | A reference to another scope, read at its current contents | [include-context.md](../../inspector/scope/include-context.md) |
| A kind, on Take out | A live rule removing everything of one kind | [take-out-kind.md](../../inspector/scope/take-out-kind.md) |
| A row in Contents | One resource that survived, and why | [resolved-resource.md](../../inspector/scope/resolved-resource.md) |
| A search result | What a test search found, and where | [search-result.md](../../inspector/scope/search-result.md) |
| A generated block | Something written against this Context | [generated-block.md](../../inspector/scope/generated-block.md) |
| A lattice node | Retrieval internals, for debugging | [lattice-node.md](../../inspector/scope/lattice-node.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| One Context | Include minus Take out, then what survives, then a retrieval test | [workspace-one-context.md](workspace-one-context.md) |
| All Contexts | Every saved scope, each rule said in words | [workspace-all-contexts.md](workspace-all-contexts.md) |

## The rules this screen keeps

**Two halves, not a tree.** Include and Take out, side by side with a minus
between them. The nested expression tree is gone.

**Every row says why it is there.** The contents table carries an *In because*
column.

**A Context is a rule, not a list.** It resolves when it is read, so what it
contains today is not what it contained yesterday.

**A connector expands to the files it synced.** The connector record itself is
never retrievable content.
