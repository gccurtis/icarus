# The screen deck

An interactive wireframe of every workbench screen, built to argue with. It
exists because [`docs/screen-specs`](../screen-specs/) describes information
architecture in prose, and prose cannot show you that a panel is too crowded or
that a bar is in the way. The deck is where those specifications get looked at.

It is not a prototype of the application and shares no code with `app/`. It is a
drawing that happens to be clickable.

## Where it is

| | |
| --- | --- |
| Current deck | <https://claude.ai/code/artifact/22fc54e9-f6b7-47a3-8dc5-1758a025a467> |
| First pass, frozen for comparison | <https://claude.ai/code/artifact/f76dda2d-124f-49d8-891c-a2a9bb60fe1e> |
| Source | [`src/`](src/) |

Twenty-one slides over eleven screen kinds. Several screens have more than one
subscreen — a deck editing a slide or a layout, Research on one question or all
threads, and every library-plus-editor pair — and the surfaces that are not
screens at all: the New Slide chooser, the Copilot open, and a multi-selection.

## Reading it

Arrow keys move between slides. Inside one:

- A **rail icon** changes the context view.
- Clicking a **row, cell, pill, node, avatar or slide object** changes the
  inspector. Breadcrumbs are navigable — click an ancestor to select it.
- **Spec notes** opens a drawer per screen: what the screen is for, its rail, what
  changed in the last revision, what the tab retains, and the model gaps that
  gate parts of the UI.
- **ICARUS** in the top bar switches Celestial and Cyberpunk.
- **Pinch** on a document, a deck or a grid to zoom it. Nothing around the work
  surface moves, and the work stays centred. The readout in the bottom-right
  corner is nearly invisible at 100% and steps forward when you are anywhere
  else, because that is when it is a way back — clicking it returns to 100%.

## What it is made of

Nothing is loaded from a network. The artifact CSP blocks every external host,
so IBM Plex Sans and Mono are embedded as base64 `@font-face` rules.

```
src/a.html    <title>
src/b.html    tokens, CSS, the frame's markup, icons, and the wireframe primitives
src/c.js      Project Overview · New Tab · Document, plus the shared actor and variable lenses
src/d.js      Slide deck · Spreadsheet · Research
src/e.js      Analysis · Context · Templates · Personas · Automations
src/f.js      the Copilot, the New Slide overlay, the slide list, and the runtime
```

```bash
cd docs/screen-deck/src
node mkfonts.mjs            # reads app/node_modules/@fontsource, writes fonts.html
node build.mjs              # writes ../icarus-screen-deck.html — this is what gets published
node build.mjs --preview    # writes _preview.html — open this one from disk
```

`fonts.html` is generated and git-ignored; everything else is authored.

### How a screen is written

`SCREENS` is a map of screen key to one object. A screen supplies `center(state)`,
`contexts(state)`, `inspectors`, `status(state)`, and the prose the notes drawer
shows. Everything is composed from the primitives in `b.html` — `sec`, `row`,
`pane`, `lens`, `kv`, `chip`, `btn`, `table`, `card` — so density is one edit in
one place rather than eleven.

Three things resolve before a screen's own lenses and are therefore reachable
from every screen: the Copilot's views, the actor views, and the project
variable view. That mirrors the application, where an actor and the Copilot
belong to no tab.

## The design system is borrowed, not invented

Every colour is lifted verbatim from
[`app/src/lib/styles`](../../app/src/lib/styles/): the Celestial and Cyberpunk
palettes, the seven-slot ramp, the role assignments, the 4px spacing unit, the
radii and the shadow strengths. The viewer's light mode gets Celestial and dark
gets Cyberpunk, and the wordmark switches between them.

**Do not tune colour here.** If a hue is wrong it is wrong in the design system,
and the fix belongs there — see
[the palette rule](../../app/src/lib/styles/chromatic-themes/chromatic-themes.md).
The deck exists to test structure, density and hierarchy.

The one exception is the dark bezel around the frame. It is deliberately outside
the application's palette so the deck's own controls — slide navigation, the
notes drawer — cannot be mistaken for product chrome.

## The decisions this deck settled

The first pass drew the specifications as written. A review of it produced these
changes, which are now in the deck and are what the specifications should be
corrected toward.

**The Copilot moved into the status bar.** It was a floating dock over the work
surface and it was in the way on every screen. The status bar is now three
sections and the middle one *is* the Copilot: a plain button when closed, and
when open the same width of bar rises straight out of the status row. Mode and
persona live inside the panel, so the composer never presents "Plan / Grid
Analyst" without context. On Research it is disabled outright — that screen is
already a conversation with an agent, and a second composer floating over it
would be two ways to say the same thing.

**Editor toolbars and headers are gone.** Document, slide deck and spreadsheet
have neither a resource header nor a formatting bar; the spreadsheet has no
formula bar and no name box. Identity moved to an Overview view in the context
panel, and every property of a selected thing moved to the inspector, which is
where the selected thing already is. This makes the inspector load-bearing: it
must be keyboard-reachable and must never be the only path to an essential
command.

**Nothing is stale.** A document runs its prompt blocks on open and a formula
reads its value when it runs, so no derived state can fall behind. Every stale
badge, every stale-output count and the amber-versus-violet inconsistency that
came with them are gone. Formula and prompt wear the intelligence role and only
that.

**The document draws all four gutters.** Full-height pages, margins as a dashed
guide on every side, and header and footer as editable furniture. The ruler is
gone; the margin is visible where the writing is.

**Analysis has no inputs, joins or root.** Project variables are variables. You
drop a field on X or Y and the chart appears, centred at the top before any
control. When two variables are in play and need relating, the screen says so as
a problem to solve — "two variables, no relationship" — with the match it picked
and the alternatives, rather than a modelling step to get through first.

**Context is two halves.** Include and Take out, side by side with a minus
between them, then a table of what survives with an "In because" column. The
nested expression tree is gone.

**Research is anchored to one turn.** The prompt, its answer, and what it
produced — findings proposed beside it with Accept, Edit and Dismiss. Earlier
turns are a History rail rather than a scrollback. A finding is a conclusion you
accept, not a passage you copied, and it can come from any search.

**Project Overview leads with mentions.** What a person addressed to you is the
only thing worth a permanent interruption; machine noise moved to Health. The
Status column is gone — a row is a thing, not a health report.

**Every actor is inspectable.** Person, agent, automation, connector. Hovering an
avatar names them, clicking opens them, and every "who" in a table is a link. A
person's lens can be written to, and says plainly that this is a project comment
addressed to them rather than email.

**Personas is a profile.** Picture, name, a record of what the agent has done,
then behaviour, then what it can look up and what it may do. If the object is
later renamed Agent, the screen does not change shape.

**Templates say "variable", not "slot".** That is what they are — a resource-set
variable inside an ordinary body. A single slide is a template kind of its own.

**The document floats.** Gutters on all four sides and between pages, all of
it canvas rather than more paper — a document sits on a surface the way a slide
sits on its pasteboard. Pages are always full height.

**A spreadsheet is one grid.** Not a workbook of sheets. The sheet tabs, the
Sheets panel and the frozen-column rule are gone; a tab is a spreadsheet.

**Overview leads every screen.** The first rail entry orients you around what you
are looking at — identity, state, who is here, what needs you. The one exception
is a deck, where the list of slides is the first thing you need.

**Speaker notes left the canvas** for the slide inspector and the Notes panel. A
tray under a 16:9 slide costs the height that zooming needs. Zoom belongs to the
work surface and never the shell; each surface decides whether it zooms at all.

**Zoom is a gesture on the work surface, not a control in the shell.** A trackpad
pinch reaches the page as a wheel event carrying `ctrlKey`; the page takes it
before the browser acts, scales one element about the pointer, and leaves the
bars, rails and panels exactly where they were. That is how every canvas
application does this. It scales rendered pixels with `transform` rather than
CSS `zoom` — `zoom` re-runs layout, so percentages resolve against the zoomed
box and the content reflows instead of getting bigger.

The one thing no page can scope is the browser's own zoom: ⌘+ / ⌘− and the zoom
menu happen above the document and enlarge the shell along with everything else.
That is a browser-level operation and nothing in a page can intercept it.

A document, a deck and a grid zoom. A library, a conversation and a form have no
canvas and do not offer it.

**No scrollbars anywhere.** Every surface still scrolls; none of them spends width
saying so, and no panel gets a gutter its neighbour lacks.

**Singleton tabs have a library subscreen.** Research, Analysis and Context each
hold many objects behind one permanent tab, so each can show all of them —
threads, analyses, saved scopes — and open one into the centre. Which object you
are on is view state, never another tab.

**The tab strip separates the permanent from the opened.** Singletons are
icon-only behind a divider; only tabs a person opened carry a label. This is a
proposal for a problem that is still open, not a settled answer.

## Deck aids

Two controls in the bezel exist for reviewing, not for the product, and are drawn
dashed in violet so they cannot be mistaken for application chrome. **screen**
enumerates a screen's subscreens — the states a tab can be in that are not
selection, like a deck editing a layout or Research showing every thread — and
**inspecting** enumerates every lens the screen can show, its own plus the
Copilot and actor lenses reachable everywhere. Both reach things that are also
reachable by clicking; they exist so nothing has to be hunted for.

Switching subscreen is a real product affordance too, and it lives in the context
panel's action row on the screen that owns it. The bezel dropdown is only a
faster way to the same place.

## Where the deck disagrees with the specs

Two places, both deliberate.

**Research and Analysis are singleton tabs.**
[`workbench-shell.md`](../screen-specs/workbench-shell.md) has them as id-bearing
`{ kind: "work" }` tabs; [`client-model/workbench.md`](../client-model/workbench.md)
corrects that to singletons, on the grounds that a tab per investigation makes
the strip the navigation for a screen that already has its own. The deck follows
the client model. The shell spec should be updated.

**Mode switching lives in the panel.** Templates, Personas and Automations each
have a library and an editor. The deck puts that switch in the context panel's
action row rather than adding a bar across the application.

## Model gaps the deck surfaces

Each screen's notes drawer lists its own. The ones that block work rather than
merely constrain it:

- No body entity carries a variable key, so template variables cannot be placed,
  highlighted, jumped to, or filled. Every template with variables is unusable
  until this exists.
- `SheetChart` has no stable `id`, so chart creation and editing stay gated.
- Placeholders have no stable key, so duplicate-role reset and placeholder
  selection stay gated.
- A proposed finding has no state in the model. Proposed, accepted and dismissed
  must exist before the Research screen can ship.
- Retrieval treats absent and empty scopes alike as whole-project, so a Context
  matching nothing cannot mean "search nothing".
- Writing to a person needs a project-level comment with no resource anchor.
  Every current `Comment` anchors to a resource.
- Deleting a Context, a Persona or an Automation is gated on reverse-dependency
  queries and a tombstone policy that do not exist.
- Presence needs an ephemeral channel. `lastSeenAt` is not presence.

Two the deck itself introduced, by proposing UI ahead of the model:

- Nested groups inside a Context cannot be drawn as two flat halves. Either the
  model stays one level deep, or the screen needs a way to show a group without
  becoming a tree again.
- Analysis infers how two variables relate. Without a real key-inference
  contract that is a guess presented as a fact.

## Changing it

Edit the relevant part in [`src/`](src/), rebuild, and republish to the **same**
artifact URL so the link in this file keeps working. Publishing without that URL
creates a second artifact instead of a new version.

Two things to preserve. Keep the notes drawer honest: when a screen draws
something the model cannot store, say so in `gaps` rather than letting the
drawing imply it exists. And keep taking colour from the design system — the
deck's whole value is that it looks like the thing it is arguing about.

## Related

[screen specifications](../screen-specs/) ·
[screen panel views](../screen-panel-views/) · [client model](../client-model/) ·
[data models](../data-models/) · [design system](../../app/src/lib/styles/)
