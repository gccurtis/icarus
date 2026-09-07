# Template Stage Flow

A template is a copy machine's original, kept by the project, except that the copy it keeps is a
function rather than a value: what pointed at a particular thing in the project is stripped, and the
variables fill the holes. Three things happen to it: someone keeps a copy of what they have, someone
asks for a copy of it here, and someone changes the original by editing a copy of it and saving it
back. This page draws all three, says what each one reads and writes, and records what the reviews
settled.

- Original: `templates` · `templateVersions` · one project
- Copy under edit: `templateStages` + one `documents` / `slideDecks` row
- One stage per template, shared

## 1 · Three verbs, and nothing else

**Keep a copy of this — make a template.** Name the open document, deck, or current slide and press
Save. The body is copied, made portable, and stored as a template of this project at revision 1. The
new template opens for editing at once. The document you saved from is untouched and never learns a
template was made from it. (`createTemplateFromResource`, `createTemplate` → `templates` +
`templateVersions`.)

**Give me a copy of that, here — Insert, or Use.** Both ask what each variable should select, its
default first, in one modal. Insert then copies the template's saved body into the open resource with
fresh ids; Use makes a whole new resource from it. What lands is yours and carries no reference to the
template: later changes to it never reach the copy. Placing a template is a pure function of the
template and your answers. (`insertionOf`, `instantiateTemplate` → the open resource's ops, or a new
resource row.)

**This is the copy; let me change it — edit through a stage.** Open makes, once, a scratch document
or deck holding the template's body. The ordinary editor works on it. Save to template writes that body
back as the next revision; Discard throws the scratch away. The stage is the only thing that writes a
template's body. (`openTemplateStage`, `commitTemplateStage`, `discardTemplateStage` →
`templateStages` + the scratch row.)

## 2 · The full flow

| Step | Person | Editor and panel | Capability | Rows afterwards |
| --- | --- | --- | --- | --- |
| 1 Make | Names the open document, deck or current slide and presses Save | Sends the resource id and name; on acceptance opens a new tab straight onto the copy's Templates panel | `createTemplateFromResource` reads the leader snapshot, makes the body portable, stamps the project, declares nothing, says what it dropped; then `openTemplateStage` | templates at 1 · templateVersions 1 · templateStages staged at 1 · a scratch row titled *Template · name* |
| 2 Open | Double-clicks a template in the library, presses Edit in the inspector or on a panel row | The editor tab opens on the scratch resource; the panel shows *Editing template*, the variables, Save to template and Discard | `openTemplateStage`: if the template already has a stage, returns it; otherwise writes the body at revision N into a new scratch row and records the stage | Unchanged when resumed; otherwise a stage row and a scratch row at N |
| 3 Edit | Types, moves blocks, changes layouts, in one or several sessions at once | Runtime ops against the scratch resource, flushed and rebased by the editor as for any document; every session on the stage sees the others' edits through that same sync | Nothing template-shaped; the resource capabilities as usual | Snapshots and change sets on the scratch row move; the template does not |
| 4 Declare | Adds a variable by label, writes its description, sets its default through the modal: everything, kinds, or a named set | Writes the whole variable list at the revision the panel read; the body is untouched | `updateTemplate` makes revision N+1 with the new variables and carries the stage to N+1, so a variable declared here never makes the next save stale | templates at N+1 · templateVersions N+1 · templateStages staged at N+1 |
| 5 Save | Presses Save to template | `await runtime.flush()`; refuses while anything is pending or failed, because the server reads the leader snapshot; sends the template's current revision as its base | `commitTemplateStage`: anyone in the project; refuses *stale* only if another session's save landed first; makes the scratch body portable, validates, writes N+1, moves the stage to N+1, says what was dropped | templates at N+1 · templateVersions N+1 · stage staged at N+1 · the scratch row stays open |
| 6 Insert, Use | Presses Insert on a panel row or Use in the inspector, answers each variable in the modal or leaves the default, confirms | Insert builds ops from the template's **saved** body with fresh ids and the prompt scopes filled from the answers, then the defaults, and applies them to the open resource, undoable like any edit; Use sends the answers to the server | Nothing for Insert; the body was already read. `instantiateTemplate` makes the new resource for Use from the same answers and records the template's `lastUsedAt` | Ops on the open resource, or a new resource with no reference back; the template's last use moves; its stage is untouched |
| 7 Discard | Presses Discard and confirms | Flushes, asks, then closes the tab only after the server has answered, so a late sync reads nothing rather than resurrecting the row | `discardTemplateStage`: anyone in the project; removes the stage row and the scratch row with its snapshots and change sets | The template keeps its last saved revision; no stage |

## 3 · What reads and writes what

The template's body has one writer and many readers. The stage's body has the editor as its writer and
only Save to template as a reader that matters. Nothing reads across the two except Open and Save,
which are copies.

| Verb | Reads | Writes | Who |
| --- | --- | --- | --- |
| Make | The open resource's leader body | template revision 1, then a stage | Anyone in the project |
| Open | The template's saved body at N | stage, once; nothing on a resume | Anyone in the project |
| Edit | The scratch resource | stage snapshots, change sets | Anyone the editor admits |
| Declare, rename, tag | The template | template revision N+1, same body; the stage's record follows | Anyone in the project |
| Save to template | The scratch leader body | template revision N+1; the stage's record follows | Anyone in the project, at the current revision |
| Insert | The template's saved body, the answers | the open resource | Anyone in the project |
| Use | The template's saved body, the answers | a new resource with no reference back; the template's last use | Anyone in the project |
| Discard | The stage | removes the stage and everything on it | Anyone in the project |
| Delete template | The template, its stage | removes template, versions and stage; touches no resource | Anyone in the project |

## 4 · Several people, one copy

The stage is keyed by template, not by person, so everyone who opens the template lands on the same
scratch resource, and the document and deck editors already reconcile concurrent sessions on one
resource: a leader snapshot, pending ops per session, rebase on conflict. Nothing about a template's
copy is tracked per person, and nothing needs to be. Two people pressing Save to template at the same
moment is the one race: the second save is refused as stale, its panel re-reads the revision, and the
next press saves the copy they both see.

A copy being edited is not what Insert or Use read. They read the template's last saved body, so a
half-finished edit never lands in another resource, and a person who wants their edit used presses Save
to template first. That is the whole of the sync: there is no second channel.

## 5 · What never happens

- **A resource made from a template does not change when the template does.** Inserting and Use are
  copies; no resource carries a reference to a template, and the template records its own last use so
  the library can say "used 3 days ago".
- **A template's body is never written except from its own stage.** There is no other path, so there is
  nothing to pull back into the copy and no drift to reconcile. The note that a template "moved" is gone
  with the reason for it.
- **Comments never travel with a template, and none can be made on its copy.** Making a template copies
  a body, not the comments on the resource; a copy made from a template starts without any; the
  comments capability refuses a thread on a working copy and the deck's comment panels say so; anything
  that reaches one goes with the stage.
- **A template is portable, inside its project too.** A template turns a value into a function: the id
  a formula was bound to, a prompt's generated output, links to people and resources, stored images and
  scope terms naming a set or a resource are stripped when a body becomes a template, and each is said
  back. A formula keeps its expression and is drawn as unbound until a formula is made for it again.
- **Nothing crosses projects.** A template is its project's; another project's library, stages and
  inserts cannot reach it.

## 6 · What you settled, and what it became

The six questions the previous version of this page asked, each with your answer and the change it
made. Nothing here is still open.

1. **Does a copy kept inside its own project still drop links, images and set scopes?** Yes. A template
   turns a value into a function, so the facts about its behaviour do not change with where it lives:
   formula ids, generated outputs, links to people and resources, stored images and scope terms naming
   a set or a resource are stripped, and the variables fill the scopes. Stored images are the one item
   likely to change later, by storing them with the template. *Became:* unchanged in code; the docs and
   this page now say why. A formula's project-neutral form, its expression with no `formulaId`, is
   drawn with a dashed outline in the document editor.
2. **Does Use ask for the variables the way Insert does?** Yes: instantiating on its own or inside
   something else is still instantiating. *Became:* the inspector's Use opens the same one-modal ask and
   sends the answers to `instantiateTemplate`.
3. **One modal for all variables, or one per variable?** One modal. *Became:* as built.
4. **When a template is inserted into a template being edited, does it ask?** No: it brings its holes
   with it and the variables join. *Became:* as built.
5. **Are comments allowed on a working copy?** No: if the rest is stripped, comments are stripped too,
   and a comment that mentions someone on a copy would be a problem. *Became:* the comments capability
   refuses to start a thread on a stage resource, and the deck's comment panels replace their composer
   with the sentence that says so.
6. **Does a resource keep a reference to a template?** No. Saving a resource as a template is a copy,
   and a resource made from a template is a copy; neither side should know about the other. *Became:*
   main's `templateId` on documents, decks and spreadsheets is gone, along with the delete rule that
   read it; the template records its own `lastUsedAt` so the library's recency still works.

## 7 · Where each step lives

| Step | Client | Server |
| --- | --- | --- |
| Make | `document-editor/context/templates.svelte` · `slide-deck-editor/context/templates.svelte` · `procedures/templating.ts` in each | `capabilities/templates/api/create-template-from-resource/` |
| Open | `templates/procedures/library.svelte.ts` (editTemplate) · `model/client/workspace-state/methods/open.ts` (Target.context) | `capabilities/templates/api/open-template-stage/` · `api/shared/stages.ts` |
| Edit | The editors, unchanged | The resource capabilities, unchanged |
| Declare | The two panels' variable bands · `templates/inspector/template.svelte` (Default modal) | `capabilities/templates/api/update-template/` |
| Save | The two panels (flush, then commit) | `capabilities/templates/api/commit-template-stage/` · `representation/data/behavior/templates/portable.ts` |
| Insert, Use | The Insert modal in both panels, the Use modal in the inspector · `procedures/templating.ts` and `procedures/library.svelte.ts` (answerOptions, answersFrom, insertionOf) · `representation/data/behavior/templates/fresh-ids.ts`, `scopes.ts` | `capabilities/templates/api/instantiate-template/` |
| Discard | The two panels | `capabilities/templates/api/discard-template-stage/` |
| No comments on a copy | `slide-deck-editor/context/comments.svelte` · `inspector/threads.svelte` | `capabilities/comments/api/start-thread/` |
| Keep stages out of lists | | `capabilities/project-resources/api/read-project-resource-index/` |

Companions: *Template Dictionary* for the words, *Stages, Sets and Variables* for what changed,
*Template Features Change Set* for every diff, and the reference suite under
`docs/reference/template-features/`.
