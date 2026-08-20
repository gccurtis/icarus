# A prompt block

| Selecting | What it is | Sections |
| --- | --- | --- |
| A prompt block in the document body | The instruction, what it produced, what it could look at, and how it was run | Prompt · Output · Scope · Provenance |

A block whose content is generated rather than typed. In the document it should
read as ordinary prose — a document is stable, and things do not pop out of it.
Everything that distinguishes it lives here, and any always-visible marker
belongs in the gutter beside the text rather than around it.

## Layout

| 300px |
| --- |
| prompt |
| prompt |
| output |
| output |
| output |
| scope |
| provenance |

## Prompt

The instruction, editable.

**Shows** — "Compare undergrounded and overhead segment performance across the
three storm events."

**Needs** — the prompt text on the block.

## Output

What it produced, plus the two things you do with it: run it again, or take it out
of the block and make it ordinary text.

**Shows** — the generated paragraph, with **Run again** and **Copy out**

The block runs when the document is opened, so what you see was generated against
the project as it is now. That is why there is no stale badge and no "last
generated" warning — only the provenance below.

**Needs** — the generated content, and a run action.

**Open** — running on open costs time and tokens on every open of a document with
many blocks. Whether that is per block, batched, or bounded is undecided.

## Scope

What the block could look at when it ran.

**Shows** — *Field reports 2024–25* — 96

**Needs** — a `ResourceSet` reference on the block, with a live resolved count.

## Provenance

How it was run. Starts collapsed.

**Shows** — `Last run · on open`, `Model · analyst-default`

**Needs** — last-run marker and model binding on the block or its `DerivedOutput`.

**Open** — `DerivedOutput` stores no owner pointer, so going the other way — from
an output to the block that owns it — is a reverse query.
