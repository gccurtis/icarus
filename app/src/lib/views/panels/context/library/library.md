# Library

## What the subject is

These are the panels that stand at the left of a screen and answer one question:
what does this project already hold, and how do I add to it. They are lists
first — a list is what a person scans when they are looking for something they
know exists — and every one of them hands off to the inspector rather than
acting in place.

They fall into four groups, and the groups matter more than the alphabet:

- **The library of templates** — `templates`, `template-kinds`, `template`,
  `recent-templates`. What templates exist, what a template is allowed to make,
  and the one currently being authored.
- **Authoring a template** — `authoring-body`, `authoring-design`,
  `authoring-insert`, `authoring-variables`. These are not new panels. They are
  the ordinary document editor's own panels under names that fit a template:
  the same views doing the same job on a body that happens to have openings in
  it. Only one of the four, `authoring-variables`, is particular to templates;
  the other three are the editor's Navigator, its Styles and Page views
  collapsed together, and its Insert view with one band added.
- **The launcher** — `create`, `templates-newtab`, `bring-in`, `recent-newtab`.
  The four panels of a tab that has not yet decided what it is: make something,
  start from something, bring something in, or go back to something.
- **The project's own indexes** — `resources`, `contexts`, `findings`,
  `inquiry`, `threads`, `analyses`. One list per kind of thing a project
  accumulates.

Two panels here are called *Recent* and they are not duplicates.
`recent-templates` is the templates screen's, split into what changed and what
was used; `recent-newtab` is the launcher's, over everything, grouped by day. A
row in the first opens the template lens; a row in the second opens
`library.recent-item`, which is the only lens in the launcher whose subject
already exists. The pair is one word covering two different questions, which is
why neither is written in terms of the other.

## templates

Every template in the project, headed *Library*, searched by name, with what
each one makes and how many variables it asks for on the row — "Document · 4
variables", and nothing after the kind when it asks for none.

Three bands, in this order: Project, Shared, Personal. Grouped by scope rather
than by kind because scope decides what you may do with one, and kind is
already on the row. Copying a shared template into project scope makes a second
template — there is no shared ownership across that boundary, so the two
diverge from that moment. That is why these are separate bands and not one list
with a badge.

The action row is New, Edit, Use, Duplicate. The three that act on a chosen row
are dead until one is chosen and say which on hover. Use is disabled on any
template that has variables: nothing in a body records which variable it stands
for, so a supplied value has nowhere to go. The button says that on hover rather
than accepting the press and producing a result with the openings still in it.

Routes to `library.template` (New, a chosen row, Duplicate),
`library.body-entity` (Edit) and `library.use-template` (Use).

## template-kinds

The four things a template can make — each its own band, each with a sentence
saying what it is for, each with its own **New**.

Organised by target because target is the one decision that cannot be changed
afterwards: changing it would mean converting the body, which is not modelled.
That is why each target is a band with its own New rather than a choice inside
a single create form. The kinds and their wording are not written into the
panel; where two sources of that wording disagree — the spreadsheet blurb reads
"one grid" in one and "sheets" in the other — the words a person actually reads
are the authority.

Nothing names creating a template, so New opens the template lens with the
target carried along, since the target is the whole of what pressing New
decides.

Routes to `library.template`.

## template

Headed *Template*. The template the authoring screen is focused on, seen as a
thing in a library rather than as a body — the part you set once and then stop
thinking about. Distinct on purpose from the authoring panels beside it, which
are all about the body.

Fields first: name, what it makes, who it belongs to, how many variables, its
revision, when it changed. Then a *Built by* band with the author's row, and a
*Used* band listing what has been made from it, which says "Nothing has been
made from it yet" rather than showing an empty list.

What it makes is fixed at creation and shown as a fact, not a control. Changing
it would invalidate every variable in the body, so making a different kind of
template is making a different template.

What it deliberately does not do: renaming and re-scoping are held in the panel
only. Nothing writes either back, so neither survives a reload.

Routes to `collaboration.person` from the author's row.

## recent-templates

Headed *Recent*. Two bands: recently updated, then recently used.

Two bands rather than one merged list, because a template you edited yesterday
and a template you used yesterday are different signals and merging them loses
both. Nothing counts uses — *recently used* is a reverse query over the
resources a template made, so a template that has never been used simply never
appears. It is not a zero.

Routes to `library.template`.

## authoring-body

Headed *Body*. The template's outline: its headings, nested one level, each with
the page it sits on. This is the ordinary editor's Navigator under a name that
fits a template — the same view doing the same job.

What it deliberately does not do: the outline cannot show where the variables
are. Nothing in a body records which variable it stands for, and a template's
structure is exactly the part a variable interrupts, so the omission is felt
here more than anywhere else on the screen.

Routes to `library.body-entity` from a heading.

## authoring-design

Headed *Design*. Styles, then page setup — paper, orientation, gutters.

The ordinary editor's Styles and Page views collapsed into one, because a
template is usually short and the two together fit. That is a density decision
and it will stop suiting a long template.

A style row is not a target: nothing opens one, and a row that looks pressable
and opens nothing is worse than a row that plainly reports. This panel routes
nowhere.

## authoring-insert

Headed *Insert*. Two bands: the basics you can put into the body, then the kinds
of variable a template can carry. This is the ordinary Insert view with one band
added, and that added band is the whole difference between authoring a template
and authoring a document.

A generated variable is listed as a kind of variable rather than as an
insertable prompt block, because it is never a question at instantiation: it
becomes a prompt block in the result.

What it deliberately does not do: the variable rows do not press. No body entity
can carry a variable key, so an inserted variable would have nowhere to record
which variable it is. They are listed anyway, with the reason stated underneath,
because removing the band would hide the gap this screen is waiting on.

Routes to `library.body-entity` from a basics row — inserting selects what was
inserted, and selecting is what puts it in the inspector.

## authoring-variables

Headed *Variables in this template*. The one panel of the four that is
particular to a template; everything else in the subscreen is the ordinary
editor.

Split into required and optional, because requiredness is what decides whether
someone can get past the instantiation form. A generated variable sits under
optional although it is not a question at all — skipping it means the block is
absent rather than that a value is empty, and the row says so. Each row shows
the key, then the label with whatever else changes what you must supply (its
default, or what it becomes), then its type. **Add variable** is in the action
row.

What it deliberately does not do: a row opens the variable and nothing else.
Highlighting where it sits in the body, or jumping to it, would need a body
entity carrying a variable key, and none does — so this is a list beside a
document it cannot point into.

Routes to `library.template-variable`, including for a new one.

## create

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

Routes to `library.new-document`, `library.new-deck` and
`library.new-spreadsheet`.

## templates-newtab

Headed *Templates*: starting from something rather than from nothing.

Grouped by what the template makes — document, slide deck, spreadsheet — in the
same order as the pills in the centre. Scope and variable count ride on the row,
because both change what pressing one will do.

Slide templates are not here. A slide template makes one slide, which is not an
editor this tab can open, so it would be a row that cannot answer the only
question this tab asks.

**Open Templates** is in the action row rather than at the foot of the list. A
panel has no footer — a control pinned below a list of unbounded length is a
control nobody scrolls to — and reaching another screen is the parent's to
perform, not this panel's, so the button is dead when the parent offers nothing
to perform it with.

Routes to `library.start-from-template`.

## bring-in

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

Routes to `library.upload`, and to `library.connect` from both a connector row
and a provider row.

## recent-newtab

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

Routes to `library.recent-item` from any row, including one found elsewhere in
the project.

## resources

Headed *Resources*. Everything a Context could name, in three bands: documents,
findings, connector files.

Findings are here because a finding is a resource and can be retrieved.
Questions and hypotheses are not, because they are organisational and no rule
can name them. That distinction is the reason this is three bands rather than
one list called "everything".

One search field over all three kinds rather than one per band: you are looking
for a named thing far more often than you are browsing a category.

A connector stands for the files it synced rather than expanding into them — 312
rows in a 300px panel is not a list anyone reads. What is actually in scope is
therefore one level away, which the file count on the row admits.

Routes to `scope.resolved-resource` from a document or a finding, and to
`project.connector` from a connector.

## contexts

Headed *Contexts*. Every saved scope in the project: its rule, and how many
things that rule currently resolves to. New, Open and Duplicate in the action
row, the last two dead until a row is chosen.

A Context is a rule rather than a list, so the count beside each one is resolved
now and not stored. Zero is therefore a real answer, and the row says "matches
nothing" out loud and takes an attention tone, because a bare 0 beside a rule
reads as a count that has not loaded yet.

Routes to `scope.context`.

## findings

Headed *Findings*. Everything this project has accepted, in one searched list.

A finding is a resource — retrievable anywhere in the project — which is why
this list exists at all rather than living as a detail inside each thread.

There is no action row, deliberately: nothing here is created, and a finding is
accepted in the thread that proposed it. Each row says where it came from and,
when a bearing exists, what it bears on, because a conclusion with no origin is
a claim nobody can check.

Routes to `research.accepted-finding`.

## inquiry

Headed *Inquiry*. What the project is trying to find out when there is no
current thread to anchor against. Two bands: the questions, then the ideas being
tested.

Questions nest exactly one level. A child hangs off its parent, and a child of a
child would be a tree this panel is 300px too narrow to draw.

An idea carries its assessment as its tone: ruled out and supported are settled,
testing is live, untested is neither.

The second band is called *Ideas being tested* rather than *Hypotheses*, which
is the wording the single-question subscreen uses. The two disagree and one of
them will eventually lose.

Routes to `research.question` and `research.hypothesis`.

## threads

Headed *Threads*. Every line of enquiry in the project, searched, split into open
and answered. The mode — discover, question, hypothesis — is carried by the icon
rather than by a word, because it repeats on every row and the title is the part
worth reading.

*Answered* is a projection of the anchoring question's status, not a state
anyone sets, so the two bands are a split of one list rather than two lists: a
thread moves between them without being edited.

Choosing a thread opens its tab and inspects it, two acts in one press and
deliberately. This panel is the map onto a screen that has no list of its own,
so a press that only inspected would leave the map with no way onto the
territory. Opening is idempotent, so a thread reached from here, from a finding
and from the work table is one tab.

Nothing starts a thread, so **New thread** opens the first one the screen is not
already holding rather than pretending to create.

Routes to `research.thread`, opening the research screen on the same press.

## analyses

Headed *Analyses*. Every chart built on this project's variables, searched, with
the chart type and when it last ran on the row. New, Open and Duplicate in the
action row.

The last-run time is said as "run 3 days ago" rather than as a date, because
nothing about a result is stored. The sentence is about an artefact that no
longer exists, and wording it as an age is what keeps it from reading as a link
to one.

Open and Duplicate act on a row, so they are dead until one is chosen. A control
that looks pressable and silently does nothing is worse than one that says it is
waiting for a selection. Nothing creates an analysis, so New lands the centre on
a blank id rather than inventing a row this panel would then fail to list.

Choosing a row opens its tab and inspects it, for the same reason `threads`
does.

Routes to `analysis.analysis`, opening the analysis screen on the same press.

## What is not here

**No body entity can carry a variable key.** One absence, felt in four places:
Use is disabled wherever it appears, the outline cannot mark where variables
sit, the Insert variable rows are inert, and a variable row cannot point into
the document beside it. Every panel that touches it says so in its own words
rather than quietly omitting the control.

**Nothing writes a template back.** Renaming and re-scoping are held locally and
lost on reload; a duplicate would exist only until the next read.

**Almost nothing here creates.** Nothing counts template uses, starts a thread,
creates an analysis, or mints a template. Where a New button exists it opens a
lens, lands the centre on a blank id, or reaches for an existing row it has not
already opened — it does not make a record this panel would then fail to list.

**Slide templates have no launcher route**, because there is no editor that
opens one slide.
