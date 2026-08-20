# Insert — one template

| View | What it is for | Sections |
| --- | --- | --- |
| Insert | Putting content, or a variable, into the template body | Basics · Variable |

The ordinary Insert view with one section added. That added section is the whole
difference between authoring a template and authoring a document.

## Layout

| 300px |
| --- |
| basics |
| variable |

## Basics

**Shows** — Text block · Heading · Table

**Needs** — the block kinds the body model supports.

## Variable

The three kinds of opening a template can leave.

**Shows** — Text variable · Table variable · Generated variable

A generated variable becomes a prompt block in the result rather than a question
at instantiation, which is why it is a variable kind rather than an Insert of a
prompt block.

**Needs** — a body entity that can carry a variable key.

**Open** — this is the gate. Without that entity, inserting a variable has nowhere
to record which variable it is, so nothing in this section can be built.
