# Template features — design

Worktree `.claude/worktrees/template-features`, branch `work/template-features`, cut from
main `7739f04` and since rebased onto `286cbc8`, where it is one commit. Revised on 2026-09-06
after the first review: a slide is not a kind of its own, a variable has one default and no
per-project binding, and a template's editing copy is shared.

## What is asked

1. Opening a template stages a temporary copy of the resource it makes and edits it in the
   ordinary document or presentation editor; saving writes the copy back.
2. Resource sets exist as a subject: a capability over the `resourceSets` table, and a place to
   make and change them.
3. Both editors get a working Templates context panel: save the open resource, or one slide of
   a presentation, as a template; declare variables on a template and give each a default resource set;
   see every template of the editor's kind and pull one into what is open.
4. Reference pages record everything built and the whole difference from main.

## Vocabulary

- **Template** — a `templates` row in one project: a portable body, its variables, tags. A
  template made from one slide is a presentation template holding one slide; nothing marks it afterwards.
- **Variable** — a hole a prompt scope can name. Its `default` is what it selects when nobody
  says otherwise: the whole project, kinds, one of the project's named sets, or another
  variable. A variable declared without a default means the whole project.
- **Resource set** — a `resourceSets` row: a named `{ include, exclude }` over one project.
- **Answer** — a resource set a caller passes at instantiation to fill one variable. Inserting or
  using a template collects one per variable in a modal that shows the default first; nothing
  stores answers.
- **Stage** — the temporary resource a template is edited through, and the row that says so.
  One per template, shared by everyone in the project.

## Representation

Every change under `representation/`, since the branch is meant to make few:

`data/types/templates/template.ts` — unchanged in shape. `TemplateBody` is still document,
slides, or spreadsheet; `TemplateVariable` is still name, label, description, optional default.
(The first pass added a `slide` body kind and answer types; both are gone.)

`data/types/core/resource-set.ts` — `TemplatedTerm` gains the `set` term, so a variable's
default may name one of the project's sets now that a template belongs to a project; and `BoundTo`
says what owns a row that has no name.

`store/tables.ts` — `resourceSets.name` becomes optional and `boundTo` is added, so a row is
either a project subject or a value one variable holds; `templates` gains `projectId` and
`lastUsedAt`; `documents`, `presentations` and
`spreadsheets` lose `templateId`, because a resource made from a template is a copy that knows
nothing of where it came from; and one new table, `templateStages`: `projectId, templateId,
templateRevision, target, resourceId, createdBy, updatedAt`. The stage resource is an ordinary `documents` or
`presentations` row with a leader snapshot, so the editors, runtimes, comments and change sets work
on it unchanged. It carries no `templateId` provenance: a stage is not made *from* a template,
it *is* the template while it is open.

`data/behavior/templates/` (new domain directory; the graph already lets templates reach content,
core, documents, presentations, spreadsheets)

- `scopes.ts` — `resolveTemplateScopes(body, variables, answers)`: every prompt scope's variable
  term becomes the caller's answer for that name, else the variable's default, else the whole
  project, recursively; a name the template does not declare is kept and reported. Moved here
  from the capability so the editors can resolve at insert time. `variableNamesIn(body)` lists
  the names a body refers to.
- `portable.ts` — `portableBodyOf(body)`: strips what a template body may not carry (formula ids,
  derived-output ids, actor/persona/resource links, file and storage image sources, `set` and
  `resources` scope terms, resource references), and reports each thing it dropped as a sentence.
- `fresh-ids.ts` — `withFreshIds(fragment, mint, hint?)`: remaps every id in a body fragment,
  including mark ends and section anchors, through a caller-supplied minting function keyed by
  what the id names (row, block, atom, mark, slide, element, layout, section, cell).
- `presentation-of-slide.ts` — `presentationOfSlide(presentation, slideId)`: the presentation body holding one slide of a presentation,
  its layout, theme and styles, and no sections.

`data/behavior/core/resource-set.ts` — `resolveResourceSet(set, catalogue, setsById)`: which of a
project's resource references a set selects, following `set` terms with a cycle guard.

## Capabilities

### `templates` (extended)

| procedure | answers |
| --- | --- |
| `readTemplateLibrary` | as before |
| `readTemplate` | as before |
| `createTemplateFromResource` | a template from a live document, a live presentation, or one slide of a presentation (`slideId`), body made portable; reports what was dropped |
| `updateTemplate` | patch may now replace `variables`; refuses `variable-in-use` when the body still names a removed variable; carries the template's stage to the new revision, since an update never touches the body |
| `instantiateTemplate` | as before, plus optional `answers`, a resource set per variable name; the default fills the rest; a body naming an undeclared variable refuses |
| `openTemplateStage` | the project's stage for a template, made if absent: a scratch resource titled `Template · <name>` |
| `readResourceTemplate` | for a resource id: the stage it is (with the template's current revision) and the template it was made from |
| `commitTemplateStage` | the stage resource's leader body, made portable and validated, written as the template's next revision |
| `discardTemplateStage` | removes the stage row and the scratch resource with its snapshots, change sets and comments |
| `removeTemplate` | also discards the template's stage in this project; refuses while one exists in another |

Spreadsheet templates cannot be staged until the spreadsheet editor lands; `openTemplateStage`
refuses them with `unsupported-body`.

### `resource-sets` (new)

| procedure | answers |
| --- | --- |
| `readResourceSets` | this project's named sets with creator, revision, and how many resources each selects now |
| `createResourceSet` | a named set from a name, description, and set |
| `updateResourceSet` | compare-and-swap name, description, or set |
| `removeResourceSet` | compare-and-swap delete; refuses `in-use` while another set here names it |

### `project-resources`

`readProjectResourceIndex` leaves stage resources out, so Project Overview never lists a scratch copy.

## Views

### templates category

- Library: double-click or Edit opens the template's copy in its editor and lands on the
  editor's Templates panel.
- `templates.editor` content: stages the focused template and opens its editor, then lands the
  singleton back on the library. Kept so stored workspaces naming it still resolve.
- Inspector: an Edit action beside Use, which asks for the variables in the same modal Insert
  uses; each variable shows its description, then one button reading its default scope as a
  sentence, which opens a modal to change it. Which variables exist is not editable here or
  anywhere.

### document-editor / `context/templates.svelte` with `procedures/templating.ts`

Top to bottom, on an ordinary document: a name field and Save, which copies the document into a
new template and opens it for editing in a new tab; then a collapsible List section holding every
document template, searchable, each row with Insert and Edit. On a working copy: Save and Discard
in the header, a rule under them — the tab title already names the template, so no band repeats
it — then a Variables band listing what the body's prompt scopes name, each a card with the name
a prompt refers to, its label, its description and a Default scope button. Nothing adds or
removes a variable.

Insert asks, in one modal, what each variable should select, then puts the template's rows after
the current row with fresh ids and the styles the document lacks; when the document is itself a
working copy it asks nothing, keeps the variable terms, and merges the inserted template's
variables. Save flushes the runtime first and refuses while anything is still pending or failed.
Discard flushes, discards, then closes the tab.

### presentation-editor / `context/templates.svelte` with `procedures/templating.ts`

The same panel with Save presentation and Save slide under the name field, and one list of presentation
templates. Inserting appends the template's slides after the current slide, bringing along
layouts and styles the presentation does not have.

### project-overview / `context/contexts.svelte` with `procedures/contexts.ts`

The project's named resource sets: name, rule as prose, how many resources it selects now; new set
(name, whole project or kinds), rename, change kinds, delete.

### `components/authored/panel/panel-section.svelte`

One shared change, forced by the panel above. A section that starts open used to mount its body in
the same tick as its heading, and tearing that panel down then left the disclosure primitive
reading a derived from the destroyed tick — a console warning, which every browser specification
treats as a failure. The body now waits for the heading to settle before it mounts.

## Forks

Settled by the second review, and built that way: a template belongs to a project, so a default
may name one of the project's sets, anyone in the project may edit and delete it, and a stage is
one per template; saving keeps the stage open and updates the template, and nothing pulls a
template back into its copy, because the copy is the only thing that writes the template's body;
inserting a template with variables asks for each in one modal that shows the default first;
comments never travel with a template. Inserting resolves variable scopes at insert time, and a
resource made from a template is unaffected by later changes to it.

Settled by the third review, and built that way: the stripping stays, inside one project as much
as across two, because a template turns a value into a function (a formula keeps its expression
and loses its instance; a prompt's scope is what the variables fill; stored images are dropped
for now and may later be stored with the template); Use asks for the variables the way Insert
does, in one modal; inserting into a template being edited asks nothing and brings the holes;
comments are stripped too, so a thread cannot be started on a working copy; and no resource
refers back to a template, so `templateId` is gone from documents, presentations and spreadsheets and the
template records its own `lastUsedAt`.

Settled with them: a variable is never added or removed by hand. It exists because a prompt's
scope names it, which is what `declaredFor` already does on every save. The agreed shape for when
prompt blocks land is pull-based — making a template walks the prompts it found and asks what
each one's scope should be, and two prompts may point at the same variable — rather than asking
an author to keep a list of names in step with a body.

Still open, each built the recommended way:

1. **Where resource sets are managed.** Recommended: Project Overview's Contexts panel, which the
   rail already names. Alternative: a category of its own.
2. **Inserting a presentation template.** Recommended: bring missing layouts and styles across.
   Alternative: slides only.

## Parameters

A template is a function, and a body asks for its parameters in two ways. A prompt's scope naming
one makes it a **scope** parameter: a group of resources, always answered, because the whole project
is the floor. A `template` atom in the prose makes it a **text** parameter: words, answered by
nobody until somebody types them, and the only thing that can hold a placement up.

The atom is deliberately not called a variable. A variable here is a named value a formula reads,
and it has nothing to do with templates; `{ id, kind: "template", name }` appears nowhere outside a
template body and the copy that template is edited through, and it draws as its name in braces.

Placing a template opens one list of every parameter, key on the left and what answers it on the
right. A row opens to its description; a scope's value opens the builder; a text parameter's opens a
field. A row with no words carries a rule down its left edge, and the confirm names what is still
missing. `instantiateTemplate` refuses the same thing on the server.

## Scope

Designed after the fourth review and built. A variable's scope is chosen in one modal that edits a
rule — two flat lists, include and exclude, with kinds, named sets and particular resources in
either, and a count of what it selects right now. The server stores that rule as a `resourceSets`
row whenever it cannot be said inline, which means whenever it excludes anything or names
particular resources. A row with a name is a project subject; a row with `boundTo` instead is bound
to the variable that owns it, on a template or on a placed resource, is never listed, and goes when
its owner goes. A variable's default and a placed copy's prompt scope then hold one `set` term,
which is what makes exclusions expressible at all: `resolveTemplateScopes` refuses to flatten a
variable answered with a difference, and one term substitutes on either side where a difference
cannot.

Four surfaces open the one builder: a variable's default from either editor's Templates panel or
from the library inspector, the answer given while placing a template, and Project Overview's
Contexts panel, which gave up its own toggles and gained exclusions by doing so. The arithmetic and
the words live in `representation/data/behavior/core/scope-draft.ts`, because nothing under
`components/` may reach the vocabulary; the builder is handed rows, offers, a sentence and a count,
and answers with the keys it was given.

The whole of it, its mock, how each of the eight decisions landed and every file it touched is
`/app/<project>/reference/templates/scope`.

## Testing

- Unit: representation behavior (scopes, portable, fresh ids, presentation of one slide, set resolution);
  both capabilities procedure by procedure; the three panels' procedures, including the Insert
  modal's choices.
- Browser: a Playwright spec that inserts a template into a document through the modal, answers
  one variable with a named set, and undoes it; saves a document as a template into a new tab,
  declares a variable and sets its default through the modal, inserts another template, saves and
  discards; saves one slide as a presentation template and inserts a presentation template into it; makes and
  removes a resource set. The existing document spec asserts the panel's new shape.

## Reference pages

In the app, where the work is: `/app/<project>/reference/templates` (how templates work: the
three verbs, the two saves, every noun, the rows, the lifecycle, variables and scope,
portability, the panels, the rules and refusals), `/app/<project>/reference/templates/changes`
(the eleven systematic changes, the model delta, what three reviews settled, a filterable ledger of
every file, what was checked, what is open, and what a merge will hit) and
`/app/<project>/reference/templates/scope` (the scope builder that is designed and not built: why a
stored row is required, the mock, where it opens, what it writes, every file it touches, eight open
decisions and what the sequence onto main is still missing). All three are the
`template-reference` development view, mounted at those routes, and all three read in either
material: the header carries a Helios and Selene switch bound to the same stored appearance the
app's top bar sets, so the choice follows you between the pages and into the app;
`scripts/generate-template-reference-inventory.mjs` regenerates the ledger from the working tree
against the branch point.

`docs/reference/template-features/` keeps the earlier written suite and its generated diffs;
`docs/artifacts/` keeps the four published artifacts. Both are records of how the design got here
rather than the live reference.
