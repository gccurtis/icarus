# Content in a template body

| Selecting | What it is | Sections |
| --- | --- | --- |
| A block, table or other content while authoring | The ordinary editor's inspector, reused exactly | Text · Variant · Owner |

Authoring a template is authoring a document, so the inspector is the document's.
This file exists to record that, not to describe a second set of panels — for the
real detail see [the document editor's lenses](../resource/).

## Layout

| 300px |
| --- |
| text |
| variant |
| owner |

## Text

**Shows** — "Filing to the Commission"

**Needs** — the block's text.

## Variant

**Shows** — Body · **Heading 1** · Heading 2

The ordinary document inspector, reused exactly. Only the persistence adapter
differs: a template embeds its body and saves through revision-CAS.

**Needs** — the block variants the body model supports.

## Owner

Which template this content belongs to. Starts collapsed.

**Shows** — `Template · Regulatory filing shell`

**Needs** — the owning template.

**Open** — the crumb has to say "template", not "document", or the reused
inspector becomes indistinguishable from editing the real thing.
