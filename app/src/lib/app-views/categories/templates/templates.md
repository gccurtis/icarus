# Templates

Lives at `src/lib/app-views/categories/templates/templates.md`.

The templates a project can start from, and the authoring of them. A singleton.

| Content | Shows |
| --- | --- |
| [`library.svelte`](content/library.svelte) | A recently used shelf over a searchable, tag-filterable table |
| [`editor.svelte`](content/editor.svelte) | One template being authored |

The library currently stands on its own. Tags are flat labels rather than a
navigation hierarchy, and double-click remains an alert until entry into the
editor is designed again. Its context rail offers only
`overview-library`; the authoring context views below stay off the rail for now.

## Context

### authoring-body

Headed *Body*. The template's outline: its headings, nested one level, each with
the page it sits on. This is the ordinary editor's Navigator under a name that
fits a template — the same view doing the same job.

What it deliberately does not do: the outline cannot show where the variables
are. Nothing in a body records which variable it stands for, and a template's
structure is exactly the part a variable interrupts, so the omission is felt
here more than anywhere else on the screen.

Routes to `templates.body-entity` from a heading.

### authoring-design

Headed *Design*. Styles, then page setup — paper, orientation, gutters.

The ordinary editor's Styles and Page views collapsed into one, because a
template is usually short and the two together fit. That is a density decision
and it will stop suiting a long template.

A style row is not a target: nothing opens one, and a row that looks pressable
and opens nothing is worse than a row that plainly reports. This panel routes
nowhere.

### authoring-insert

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
because removing the band would hide the gap this category is waiting on.

Routes to `templates.body-entity` from a basics row — inserting selects what was
inserted, and selecting is what puts it in the inspector.

### authoring-variables

Headed *Variables in this template*. The one panel of the four that is
particular to a template; everything else in the centre is the ordinary
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

Routes to `templates.template-variable`, including for a new one.

### overview-authoring

The template being authored: what it makes, what it asks for, whether it is
saved. The other half of the pair — the library panel is the map, this one is the
thing on the bench, and the Back control in the actions row is the seam between
them. Where the library is is handed in by whatever holds the panel rather than
decided here.

Name, editable and held here; then the kind, who it is available to, and how many
variables it asks for. **Kind is a fact, not a field.** What a template makes is
fixed when it is created — changing it would mean converting the body, which is
not modelled — so it is shown with that said on the face of it rather than
offered as a choice.

Saved is a chip and a sentence. A template keeps its body inside itself and saves
as one thing, checked against the revision it started from, and that is the one
way saving a template differs from saving a document.

Attribution arrives shut: the creator as a link where the name resolves, and when
it was updated.

Routes to `general.person`.

### overview-library

The compact map of the template library. New template offers Document, Slide
deck and Spreadsheet; each creates a session-local Project row and routes to
`templates.template` without claiming persistence.

Library reports the total, then Project, Shared and Personal availability counts
and Document, Slide deck and Spreadsheet kind counts in one record. It repeats
neither recent use nor the selected template because the centre shelf and the
inspector already own those. Neither section collapses.

### recent

Headed *Recent*. Two bands: recently updated, then recently used.

Two bands rather than one merged list, because a template you edited yesterday
and a template you used yesterday are different signals and merging them loses
both. Nothing counts uses — *recently used* is a reverse query over the
resources a template made, so a template that has never been used simply never
appears. It is not a zero.

Routes to `templates.template`.

### resources

Headed *Resources*. Everything a Context could name, in three bands: documents,
findings, connector files.

Findings are here because a finding is a resource and can be retrieved.
Questions and hypotheses are not, because they are organisational and no rule
can name them. That distinction is the reason this is three bands rather than
one list called "everything".

One search field over all three kinds rather than one per band: you are looking
for a named thing far more often than you are browsing a category.

A connector stands for the files it synced rather than expanding into them — 312
rows in a panel is not a list anyone reads. What is actually in scope is
therefore one level away, which the file count on the row admits.

Routes to `context-editor.resolved-resource` from a document or a finding, and to
`project-overview.connector` from a connector.

### template

Headed *Template*. The template the authoring category is focused on, seen as a
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

Routes to `general.person` from the author's row.

### template-kinds

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

Routes to `templates.template`.

### templates

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

Routes to `templates.template` (New, a chosen row, Duplicate),
`templates.body-entity` (Edit) and `templates.use-template` (Use).

## Inspector

### body-entity

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

Routes to `templates.template` from the owner.

### template

A lens for one template. Identity is compact: scope, kind and update time on one
line; creator on the next; then the description without an About heading. The
description becomes a textarea on double click. Duplicate and Delete sit under
it. All three actions update only the shared session-local mock.

Variables come before Tags and the two are separated from Identity and each
other by dividers. The Variables heading owns its count. Every variable is a
disclosure whose open state shows its description, stored key, type and whether
it is required. A template with no variables says so explicitly. Tags finish
with an expanding input and plus button for adding a unique label.

There is no preview, revision field or template-id field. Field keys and values
share the caption type step; hierarchy comes from weight and colour rather than
an accidental size mismatch.

### template-variable

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

### use-template

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

## What is not here

**Nothing writes durably.** The library description, tag, create, duplicate and
delete controls update one shared session-local mock, so the centre, context and
inspector agree until reload. They do not touch representation or invoke a
capability. The other editable panel values are likewise held where they were
typed.

**Attribution is thin, and thin differently on each panel.** The project records
neither a creator nor an updater and says its dates are dates only. A document
and a template record a creator and no creation time. An analysis records who
last changed it and no creator at all. Each panel says which half it has instead
of drawing an empty pair, and none of them guesses.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.

**No body entity can carry a variable key.** One absence, felt in four places:
Use is disabled wherever it appears, the outline cannot mark where variables
sit, the Insert variable rows are inert, and a variable row cannot point into
the document beside it. Every panel that touches it says so in its own words
rather than quietly omitting the control.

**Library changes are explicitly temporary.** A new or duplicated template does
appear in every library view, and delete removes it from all three, but the mock
resets on reload. Durable creation still waits for a representation-backed write
path.

**Slide templates have no launcher route**, because there is no editor that
opens one slide.

**The variable key gap runs through the whole subject.** Nothing in a body
records which variable it stands for. That single absence disables Use in
`template` and in `start-from-template`, blocks `use-template` from creating
anything, keeps both previews from marking their variable regions, and is the
whole of what `template-variable` has to say about where a variable appears.
Every lens states it in its own words rather than quietly dropping the control.

**Only text can be supplied.** Image and table variables are read-only wherever
a value is asked for, waiting on a picker, an upload, or both.
