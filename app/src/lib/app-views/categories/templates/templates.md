# Templates

Lives at `src/lib/app-views/categories/templates/templates.md`.

The templates a project can start from, and the authoring of them. A singleton.

| Content | Shows |
| --- | --- |
| [`library.svelte`](content/library.svelte) | A place rather than a list: folders, and templates made elsewhere |
| [`editor.svelte`](content/editor.svelte) | One template being authored |

The only category that keeps a library-and-editor pair. The library has folders
and holds templates that were never made here, so it is somewhere you navigate
rather than a table you read down — and the editor is entered by choosing one.

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

What a template is, what this project has, and what is selected. The panel opens
on the sentence that explains the whole authoring category: **a template is an
ordinary body with some of it left open**, so authoring one is authoring a
document, a deck, a slide or a spreadsheet, and there is no separate template
editor. Everything on the authoring centre follows from that.

In this project is a total and then one count per kind — Documents, Slide decks,
Single slides, Spreadsheets. **The counts are by kind rather than one total**,
because the fastest way to notice this project has no deck template is a zero
beside Slide decks; and the plural has to say which kind it means, since a single
slide is not a deck.

From outside this project is a separate count, kept apart from the project's own
on purpose. A shared or personal template can be used here, and who may edit one
is a deployment rule the model does not carry — the same thing the Personas list
says about a global persona — so the panel counts them and claims nothing about
them.

Selected is the chosen template's name, what it makes, and what it asks for, read
as so many required of so many. Open opens the template lens. Use is primary and
disabled, and the reason on it is the one the instantiation form itself gives
rather than a guess made here: nothing in a body records which variable it stands
for, so a supplied value would have nowhere to go.

New template sits in the actions row, because making a template is an act of the
map rather than of any one title — what you can add belongs beside the counts
that say how much there already is. There is no kind picker yet, so it lands on a
blank document rather than asking what to make first; the library's own
template-kinds panel is where a target is chosen deliberately.

Routes to `templates.template` from Open and `templates.use-template` from Use.

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
rows in a 300px panel is not a list anyone reads. What is actually in scope is
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

Routes to `templates.template-variable` from a variable row and
`general.person` from the creator. **Edit** opens the authoring centre
on this template.

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

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

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

**Nothing writes a template back.** Renaming and re-scoping are held locally and
lost on reload; a duplicate would exist only until the next read.

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

**Nothing writes a template.** Names and scopes edited in `template` are held
locally, and Duplicate is disabled because a copy would not outlive the next
read.

**Only text can be supplied.** Image and table variables are read-only wherever
a value is asked for, waiting on a picker, an upload, or both.
