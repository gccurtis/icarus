# New Tab

Lives at `src/lib/app-views/categories/new-tab/new-tab.md`.

A launcher: the tab a person opens before deciding what it is for. It carries
no `resourceId` and is not a singleton, so it never dedupes — open five and get
five, which is what a launcher is for.

| Content | Shows |
| --- | --- |
| [`launcher.svelte`](content/launcher.svelte) | A funnel, top to bottom: find it, make it, or bring it in |

The one category with no overview view, because a blank tab has nothing to be
an overview of.

## Context

### bring-in

Headed *Bring in*. Three bands: upload, with a **Choose files** button, a
sentence about what happens once the bytes land, and the batch's progress; your
existing connectors, each carrying its state; and the providers you could add.

Neither uploading a file nor connecting a system opens an editor, so neither
competes with the three things the New Tab exists to make. That is why both live
in the panel rather than in the centre.

Extraction starting on arrival is said out loud. An uploaded file is not
retrievable material until text comes out of it, and that delay is real.

A broken connection is fixed from where you noticed it, so state sits on the
row. An existing connector and a brand new one open the same lens: connecting is
the same work whether the row is broken or has never existed.

Routes to `new-tab.upload`, and to `new-tab.connect` from both a connector row
and a provider row.

### create

Headed *Create*. The three editors as rows: document, slide deck, spreadsheet.

The same three choices the centre offers as pills, duplicated deliberately: the
centre is where you look, this is where you land if you came by keyboard.
Choosing one only changes the inspector — nothing is made until the Create
button in that lens, which is why these are rows rather than buttons.

The panel closes by stating an omission rather than leaving it to be noticed.
Overview, Analysis, Templates and Agents are permanent tabs; they are never not
open, so there is nothing here to create, and offering to create one would imply
they can be absent. A research thread is a tab like a document, but nothing
starts one, so an offer to make one would be an offer nothing can keep.

Routes to `new-tab.new-document`, `new-tab.new-deck` and
`new-tab.new-spreadsheet`.

### recent

Headed *Recent*. What you had open lately and what changed lately, grouped by
day: today, yesterday, earlier. Every kind appears, research threads included,
because "what was I doing" does not respect the difference between a resource
and a thread.

This is two lists merged — what you opened, which is local tab history, and what
changed. A document you have never opened can therefore appear, so every row
says which of the two put it there and, when it is the second, who changed it.

The search field searches the whole project rather than only these rows, so a
query adds one more band under *earlier* for what it found outside them. The
three days are the resting state; the fourth band exists only while you are
searching.

Routes to `new-tab.recent-item` from any row, including one found elsewhere in
the project.

### templates

Headed *Templates*: starting from something rather than from nothing.

Grouped by what the template makes — document, slide deck, spreadsheet — in the
same order as the pills in the centre. Scope and variable count ride on the row,
because both change what pressing one will do.

Slide templates are not here. A slide template makes one slide, which is not an
editor this tab can open, so it would be a row that cannot answer the only
question this tab asks.

**Open Templates** is in the action row rather than at the foot of the list. A
panel has no footer — a control pinned below a list of unbounded length is a
control nobody scrolls to — and reaching another category is the parent's to
perform, not this panel's, so the button is dead when the parent offers nothing
to perform it with.

Routes to `new-tab.start-from-template`.

## Inspector

### connect

Connecting to an outside system, or repairing a connection that has broken. The
launcher's short form of the connector view; the full one, with delivery and
sync history, lives with the project's own panels.

Three bands: the provider and what it brings and what it is for; the scopes,
counted as granted-of-total; then authentication, its state, when it last
synced, and a **Reconnect** button.

A required scope is drawn as a switch that is on and cannot be moved. Scope is
chosen explicitly and never inferred from the provider, so what a connector will
be permitted to read is a set of answers rather than a sentence. A required one
is still an answer, and hiding it would leave the list looking like the whole of
what has been granted when it is not.

Reconnect is disabled, and for a reason that is not a missing button: signing in
leaves the application, and there is nothing to leave through or come back to.

What it deliberately does not do: a sign-in callback that lands on a tab which
has since been closed needs a defined outcome, and there is none yet.

### new-document, new-deck and new-spreadsheet

Three panels, one per editor, and they are siblings on purpose. Each has the
same shape: an identity band with just a title, then a band for whatever must be
decided before the thing exists, then a create band at the very end of the body.
Each holds its draft locally — an untouched field reads the default it was
handed, an edit stays in the panel, and nothing is written until Create.

Create sits at the end of the body rather than in the action row. A panel has no
footer for the usual reason, that controls get buried under content of unbounded
length, but this is a bounded form and the last thing in a three-field form is
its commit.

Pressing Create opens the editor category keyed by the title, so a second press
lands on the same tab instead of stacking two blank documents, and each panel
says under the button that this tab becomes the thing rather than opening a
second one. What Create cannot do is mint the resource and rebind the tab to
it — that is one step, and it is the step none of these three has.

What differs between the three is entirely the middle band.

#### new-document

Title, then a page band: paper, orientation, and the margins stated as a fact.
Paper and orientation are asked now because changing either later reflows a
document that already has content in it.

What it deliberately does not do: there is no project or user default to
pre-select from, so the default shown is hard-coded, and whether it should be a
project setting is unsettled.

#### new-deck

Title, then a format band with the aspect ratio, then a first-slide band, then
create. Aspect is asked explicitly for two reasons: there is nothing to fall
back to, and changing it later re-frames every element on every slide.

The first slide is drawn at the chosen ratio rather than named. Aspect is the
one choice that re-frames everything, so the preview answers it in the picture
instead of repeating the words above it — a thumbnail rather than a layout name,
so the choice is visible and not merely labelled.

What it deliberately does not do: it does not offer a choice of first-slide
layout, and whether it should is unsettled. Offering it makes this a small deck
editor; not offering it means the first thing you do after creating is change
it.

#### new-spreadsheet

Title, then create. The shortest of the three, because a spreadsheet has nothing
to decide up front: no paper, no aspect ratio, no sheets to name.

There is no workbook band, deliberately. A spreadsheet here is one grid rather
than a workbook of sheets, so the first-sheet name a workbook design would ask
for is a question this model does not have.

### recent-item

Something that already exists, and the way to open it. The only lens in the
launcher whose subject is real — the others describe a thing that does not exist
yet.

Two bands: identity — title, kind, when it was updated and by whom — and open.

Who touched it last is resolved to something inspectable. The record carries
only a name, and a name is all three kinds of actor at once: a person, an agent,
or the connector that delivered the file. Which one it is is decided by looking
the name up, and the row routes accordingly — `general.person`,
`agents.persona`, or `new-tab.connect`.

Open means the thing itself; where each kind goes is a question answered
centrally rather than by this lens, and there is no kind reaching this list that
no category holds.

What it deliberately does not do: the full behaviour of Open — deduping against
already-open tabs, transferring the draft, and closing the launcher — is one
atomic step in the tab model and it is not there. The sentence under the button
is what carries that promise.

### start-from-template

A template seen from a launcher tab: what it makes, whose it is, what its first
page looks like, and what it will ask you for. Enough to decide whether this is
the template you want without going to the Templates category.

Bands in order: identity, preview, the variables it asks for, create.

Nothing here is editable, and that is the point. Editing a template happens
where a template is owned; a launcher that quietly renamed one would change
every future use of it from a tab that looks like it is making a document.

The preview is drawn from the real body rather than from a stored picture — the
model has no thumbnail field and this lens must not imply one. A variable row
is listed with its type and whether it is required; a generated variable is
listed too, marked optional, because it is still something the result will carry
even though you are never asked for it.

What it deliberately does not do: it cannot mark the variable regions in the
preview, because marking them requires knowing where they are — the same gap
that blocks using the template at all. **Use template** is disabled and says why
on hover: nothing in a body records which variable it stands for, so a supplied
value has nowhere to go. Every template with variables is unusable until a body
entity can carry a variable key.

Routes to `templates.template-variable` from a variable row.

### upload

Files on their way into the project. Two bands, and they answer different
questions: the file list is what is going in — name, size, type — so a wrong
file is caught before it lands; ingestion is how far the batch has got and what
happens after the bytes arrive.

Per-file progress is a figure rather than a second bar. A bar for each file
under a bar for the batch says the same thing twice in a flank, so a file
in flight carries its percentage where its state would otherwise sit, and the
percentage appears only while bytes are moving — extraction is not a percentage
of anything.

What it deliberately does not do: staged upload ids survive a tab switch, but
raw file handles do not survive a reload. An upload interrupted by a reload has
to fail visibly rather than appear to still be running.

## What is not here

**Almost nothing here creates.** Nothing counts template uses, starts a thread,
creates an analysis, or mints a template. Where a New button exists it opens a
lens, lands the centre on a blank id, or reaches for an existing row it has not
already opened — it does not make a record this panel would then fail to list.

**Slide templates have no launcher route**, because there is no editor that
opens one slide.

**The variable key gap runs through the whole subject.** Nothing in a body
records which variable it stands for. That single absence disables Use in
`template` and in `start-from-template`, blocks `use-template` from creating
anything, keeps both previews from marking their variable regions, and is the
whole of what `template-variable` has to say about where a variable appears.
Every lens states it in its own words rather than quietly dropping the control.

**Create mints nothing.** In all three launchers, Create opens an editor category
keyed by the title — it does not bring a resource into existence and rebind the
tab to it, which is one step none of them has.

**Nothing leaves the application.** Reconnect cannot start a provider handshake,
and the callback that would come back has no defined landing if the tab has
closed in the meantime.
