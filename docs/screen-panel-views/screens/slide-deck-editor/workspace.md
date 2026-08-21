# Slide deck editor — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Editing a slide, editing a layout, and choosing a new one | The editor: a Fabric canvas, with everything Icarus adds on top of it | Editor |

## Layout

| 1fr |
| --- |
| editor |

The whole workspace is one region. Editing a slide, editing a layout and choosing
a new slide are all states of this one editor — the framework does not change
between them, only what it is showing.

## Editor

### The framework

**Fabric.** A slide is a set of absolutely-positioned objects on a canvas, with
selection, transform handles, snapping and hit testing coming from the library.

The Fabric instance, the nested block overlay, the in-flight transform gesture and
undo history live in the tab runtime.

**Open** — Fabric is not installed. The adapter spike has to prove three things
first: IME and text alignment inside a nested editor, nested hit testing, and
stable reconciliation against remote changes. Until it does, this whole region is
a proposal.

### What we do not take from it

**The default toolbar and object menus.** There are none. Arrange, align,
distribute, overflow and box format are inspector sections, and new, duplicate,
delete and hide sit at the top of [the Slides panel](../../context/resource/slides.md).

**Pixel geometry.** Frames are fractions of the slide in the model — pixels only
under the pointer — so a deck survives a change of aspect ratio.

**Its text object.** Fabric's own text handling is not good enough for real
content. Text inside an element is an ordinary content block in a nested editor,
which is why the element and the block are two different things with two
different lenses: the element is the spatial container, and its frame, rotation
and overflow never leak into the content.

### What we add on top

**Layouts.** The same canvas, editing what sits behind a slide. Two kinds of thing
are drawn differently because they behave differently: solid outlines for locked
content the layout owns and slides cannot touch, dashed outlines for placeholders
a slide fills in with its own copy. Entering layout mode commits or cancels any
nested block edit and starts a distinct undo group.

**The New Slide chooser.** An overlay over this editor, not a state of its own —
you are still in the slide editor. It asks the two questions inserting a slide
actually involves, in one pass: **where** it goes (after, before, end of section,
end of deck) and **what it starts from** (a copy of this slide, blank, or one of
the deck's layouts, each card naming its placeholder roles). Each placeholder
becomes an ordinary element the slide owns; locked layout content stays with the
layout and is never copied in.

**Inline formulas and prompt blocks** inside slide text, as in a document.

**Duplication that mints IDs.** Copying a slide mints new IDs for the slide and
every identified descendant, or two slides share element identity.

**Zoom**, by the same pinch mechanism as the document.

### What we configure

| | |
| --- | --- |
| Aspect ratio | 16:9 or 4:3, per deck |
| Theme | Background, type family, and an ordered colour set |
| Named styles | Keyed, so a layout placeholder can name one |
| Layouts | Placeholders and locked content, per layout |
| Handout | Paper and slides per page |

### What is unresolved

**Open** — cross-layer ordering between layout-owned and slide-owned objects is
undefined in the model, so what is drawn in front of what is a convention rather
than a rule.

**Open** — `SlidePlaceholder` has no stable key. Two placeholders with the same
role cannot be told apart, which blocks placeholder selection and
duplicate-role reset, and puts two indistinguishable dashed boxes on a layout
canvas.
