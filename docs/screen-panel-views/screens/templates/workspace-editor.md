# Templates — one template

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered from Edit, or Open | The template's body, authored on the surface it will become | Screen header · Pasteboard · Page header · Body · Page footer |

Authoring a template is authoring the thing it makes. The library is replaced by
the matching surface; the tab stays a Templates screen, with a label saying so and
a way back.

## Layout

| 1fr | 816px | 1fr |
| --- | --- | --- |
| screen header | screen header | screen header |
| pasteboard | pasteboard | pasteboard |
| pasteboard | page header | pasteboard |
| pasteboard | body | pasteboard |
| pasteboard | body | pasteboard |
| pasteboard | body | pasteboard |
| pasteboard | page footer | pasteboard |

Drawn for a document template. A deck template puts a slide canvas in the same
place, a slide template one slide, and a spreadsheet template a grid — the screen
header and the pasteboard do not change.

## Screen header

The one thing this state adds, and the reason it is not simply the editor: a label
saying what you are editing, and a way back. Without it the surface is
indistinguishable from editing the real thing.

**Shows** — **Back to library**, "Regulatory filing shell", a `Template` chip, and
`Saved · revision 6`

**Needs** — the template record and its revision. A template embeds its body and
saves through revision-CAS, which is the only way the persistence differs from an
ordinary resource.

## Pasteboard

The surround, as in the ordinary editor. The template floats on it rather than
filling the tab, so it reads as an object being made rather than as a document
being written in.

**Needs** — the target kind's page or canvas geometry, and the current zoom.

## Page header

The template's header furniture, authored here and carried into every copy made
from it.

**Shows** — "Northwind Grid Resilience — Commission filing"

**Needs** — the header furniture on the template body.

**Open** — furniture is ordinary content, so it can hold a variable too. Whether a
variable is allowed in a header, and what fills it at instantiation, is undecided.

## Body

Where the template is actually written. Ordinary content, and the openings left in
it — which is the whole of what distinguishes this surface from an editor.

Three kinds of opening, each rendering differently because each behaves
differently:

| Kind | How it reads | What it becomes |
| --- | --- | --- |
| Text variable | An inline atom in running prose — `filingDocket`, `filingParty` | The supplied string, set as ordinary text |
| Table variable | A placed block, dashed, labelled with its key | The supplied table |
| Generated variable | A prompt block, labelled *Generated · execSummary* | A prompt block in the copy, which runs on first open |

**Shows** — a heading, a paragraph reading "Docket *filingDocket*, filed by
*filingParty* under the statutory basis set out below.", a second heading, a
dashed block labelled *table variable · outageTable*, and a generated block
reading "Becomes a prompt block in the created document and runs on first open."

Everything else on this surface behaves exactly as it does in the ordinary
editor, and is inspected with [the ordinary lenses](../../inspector/library/body-entity.md).

**Needs** — a body entity that can carry a variable key.

**Open** — it cannot. Nothing in a body records which variable it stands for, so
none of the three can be placed, rendered, highlighted or jumped to. This region
is the gate on the whole screen: the surface can be drawn, and nothing can be put
in it.

## Page footer

The footer furniture, carried into every copy.

**Shows** — "Docket" and the page number

**Needs** — the footer furniture and the page-numbering settings.
