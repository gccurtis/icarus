# Library

## What the subject is

These are the right-hand panels of the same territory the context library lists:
one lens per thing you have just chosen, in the launcher or in the library
proper. Where a context panel answers "what is there", these answer "what is
this one, and what happens if I press the button". Most of them describe
something that does not exist yet, which is the defining fact of the subject —
only `recent-item` and `body-entity` have a subject that is already real.

They fall into five groups:

- **Three launchers, one per editor** — `new-document`, `new-deck`,
  `new-spreadsheet`. Near-siblings: the same shape, differing only in what has
  to be decided before the thing can exist.
- **Two views of one template** — `template`, which is the template as the
  library owns it, and `start-from-template`, which is the same facts seen from
  a launcher tab and edited nowhere.
- **Instantiating and authoring** — `use-template`, `template-variable`,
  `body-entity`.
- **Bringing material in** — `upload`, `connect`.
- **The one lens whose subject already exists** — `recent-item`.

Every launcher lens carries a crumb trail back the way you came, starting at
*New tab*.

## new-document, new-deck, new-spreadsheet

Three panels, one per editor, and they are siblings on purpose. Each has the
same shape: an identity band with just a title, then a band for whatever must be
decided before the thing exists, then a create band at the very end of the body.
Each holds its draft locally — an untouched field reads the default it was
handed, an edit stays in the panel, and nothing is written until Create.

Create sits at the end of the body rather than in the action row. A panel has no
footer for the usual reason, that controls get buried under content of unbounded
length, but this is a bounded form and the last thing in a three-field form is
its commit.

Pressing Create opens the editor screen keyed by the title, so a second press
lands on the same tab instead of stacking two blank documents, and each panel
says under the button that this tab becomes the thing rather than opening a
second one. What Create cannot do is mint the resource and rebind the tab to
it — that is one step, and it is the step none of these three has.

What differs between the three is entirely the middle band.

### new-document

Title, then a page band: paper, orientation, and the margins stated as a fact.
Paper and orientation are asked now because changing either later reflows a
document that already has content in it.

What it deliberately does not do: there is no project or user default to
pre-select from, so the default shown is hard-coded, and whether it should be a
project setting is unsettled.

### new-deck

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

### new-spreadsheet

Title, then create. The shortest of the three, because a spreadsheet has nothing
to decide up front: no paper, no aspect ratio, no sheets to name.

There is no workbook band, deliberately. A spreadsheet here is one grid rather
than a workbook of sheets, so the first-sheet name a workbook design would ask
for is a question this model does not have.

## start-from-template

A template seen from a launcher tab: what it makes, whose it is, what its first
page looks like, and what it will ask you for. Enough to decide whether this is
the template you want without going to the Templates screen.

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

Routes to `library.template-variable` from a variable row.

## recent-item

Something that already exists, and the way to open it. The only lens in the
launcher whose subject is real — the others describe a thing that does not exist
yet.

Two bands: identity — title, kind, when it was updated and by whom — and open.

Who touched it last is resolved to something inspectable. The record carries
only a name, and a name is all three kinds of actor at once: a person, an agent,
or the connector that delivered the file. Which one it is is decided by looking
the name up, and the row routes accordingly — `collaboration.person`,
`agents.persona`, or `library.connect`.

Open means the thing itself; where each kind goes is a question answered
centrally rather than by this lens, and there is no kind reaching this list that
no screen holds.

What it deliberately does not do: the full behaviour of Open — deduping against
already-open tabs, transferring the draft, and closing the launcher — is one
atomic step in the tab model and it is not there. The sentence under the button
is what carries that promise.

## upload

Files on their way into the project. Two bands, and they answer different
questions: the file list is what is going in — name, size, type — so a wrong
file is caught before it lands; ingestion is how far the batch has got and what
happens after the bytes arrive.

Per-file progress is a figure rather than a second bar. A bar for each file
under a bar for the batch says the same thing twice in a 300px column, so a file
in flight carries its percentage where its state would otherwise sit, and the
percentage appears only while bytes are moving — extraction is not a percentage
of anything.

What it deliberately does not do: staged upload ids survive a tab switch, but
raw file handles do not survive a reload. An upload interrupted by a reload has
to fail visibly rather than appear to still be running.

## connect

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

## template

A template in the library: what it makes, what it looks like, what it asks for,
and what you can do to it. The counterpart to `start-from-template`, and the
editable one of the two.

Bands in order: this template — name, what it makes, who it is available to;
preview; what it will ask for; actions; then attribution, which arrives shut
because it is context rather than the reason the panel opened.

The model has no thumbnail, tag, category, favourite or usage count, and this
lens does not pretend otherwise. The preview is the only visual identity a
template has, and it is drawn from the real body. A variable region in it is
coloured rather than boxed, because at that size a border around three words is
a smudge.

What it makes is fixed at creation and reads as a fact with that said on the
face of it, not as a control.

What it deliberately does not do: **Use** is disabled and stays disabled —
nothing in a body records which variable it stands for, so a supplied value
would have nowhere to go, and the preview cannot distinguish the variable
regions for the same reason. **Duplicate** is disabled for a duller reason:
nothing writes a template, so a copy would not survive the next read.

Routes to `library.template-variable` from a variable row and
`collaboration.person` from the creator. **Edit** opens the authoring subscreen
on this template.

## use-template

What using a template will make, and what has to be supplied first.

Bands in order: what it makes — the kind, an editable name, and where it will
go; what it asks you for; what is generated on open, which arrives shut because
those are not questions and there is nothing to do with them; then create.

Using a template hands back an independent copy. The result records where it
came from and nothing else, and editing the template afterwards never reaches
back into it. That sentence sits under the create button because it is the thing
a person most needs to know before pressing it.

The asks are drawn as name-and-value pairs rather than as fields, because a key
and the value standing against it is exactly what a pair is. The variable list
belongs to the template, so nothing here renames or removes one — this form
answers them rather than changes them. "Not set" is a state rather than a value,
so it is shown as a placeholder and never put into the field.

What it deliberately does not do: only a text variable has an editor. An image
or a table variable needs a picker over project variables, an upload, or both,
and nothing describes that yet, so anything but text is read-only and says so.
Create is disabled, carrying the same reason on the button and under it.

## template-variable

One thing a template will ask for. Bands: the variable itself; its default,
arriving shut because it is what happens when nobody supplies one; then where it
appears.

The key and the label are both shown and neither stands in for the other. The
key is what the body would reference; the label is what a person reads when they
are asked to fill it in; a lens showing one would leave the other unaccounted
for. The key is not editable here, because the body references it by name.

A generated variable is never asked for, so what it turns into is shown as the
fact instead.

The four types a variable can ask for are written into this lens rather than
read from the insert menu, because one of them — image — has no authoring kind
behind it yet, and the vocabulary is the point rather than a sample of what
exists.

What it deliberately does not do, twice over. A default is always a string,
which is unclear for an image variable and meaningless for a table one. And the
variable cannot be highlighted in the body or jumped to: placement must not be
inferred from labels, text, array position or prompt content, because every one
of those is a guess that will be wrong. One explicit mechanism has to exist
first. The third band exists to say exactly that, and contains nothing else.

## body-entity

Content selected while authoring a template. Authoring a template is authoring a
document, so this is the document editor's inspector reused exactly: text,
variant, owner. Only the persistence differs underneath.

Bands: the text, then its variant, then the owner, which arrives shut because it
is context rather than the reason the panel opened.

The owner says "template" — in the crumb and in the field. The reused inspector
is otherwise indistinguishable from editing a real document, and a person who
cannot tell which one they are in will edit the template thinking they are
fixing one filing. The owner band states the consequence outright: this is the
template's body, editing it changes what the template makes next time, and
nothing already made from it.

Routes to `library.template` from the owner.

## What is not here

**The variable key gap runs through the whole subject.** Nothing in a body
records which variable it stands for. That single absence disables Use in
`template` and in `start-from-template`, blocks `use-template` from creating
anything, keeps both previews from marking their variable regions, and is the
whole of what `template-variable` has to say about where a variable appears.
Every lens states it in its own words rather than quietly dropping the control.

**Nothing writes a template.** Names and scopes edited in `template` are held
locally, and Duplicate is disabled because a copy would not outlive the next
read.

**Create mints nothing.** In all three launchers, Create opens an editor screen
keyed by the title — it does not bring a resource into existence and rebind the
tab to it, which is one step none of them has.

**Nothing leaves the application.** Reconnect cannot start a provider handshake,
and the callback that would come back has no defined landing if the tab has
closed in the meantime.

**Only text can be supplied.** Image and table variables are read-only wherever
a value is asked for, waiting on a picker, an upload, or both.
