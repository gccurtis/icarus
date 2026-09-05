# Template

| View | What it is for | Sections |
| --- | --- | --- |
| Template | The template being authored, as a thing in a library: what it makes, whose it is, and where it has been used | This template · Built by · Used |

Distinct from the authoring panels beside it, which are about the body. This one
is about the template as an *object* — the part you set once and then stop
thinking about.

On the Templates editor rail only. In the library the same facts are on the card
and in [the template lens](../../inspector/library/template.md).

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which template is being authored |
| `capabilities.library.template` | Capability | the `LibraryTemplate`: name, what it makes, scope, variable count, revision, when it changed, author |
| `capabilities.library.recentlyUsedTemplates` | Capability | when this one was last used |
| `PEOPLE` | Model | the author's role and profile, from a recorded name |
| local rename and re-scope | Prop | a draft, because no capability writes either back |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| this template | `PanelFields` |
| built by | `PanelSection` |
| used | `PanelSection` |
| | `PanelNote` |

## This template

Six facts, two of them editable.

**Example** — Name "Regulatory filing shell" · Makes `Document` · Belongs to
`Project ▾` · Variables 4 · Revision 6 · Changed 3 days ago

### Structure

- `PanelFields`
  - `PanelEditableText` — the name
  - `PanelChip` — what it makes
  - `PanelSelect` — Project · Shared · Personal
  - three plain fields — variables, revision, changed

### Props

The select's options are the three scopes and nothing else. **Not "Global" or
"Everywhere"**: those describe where a template can be used, and the question a
person actually asks is whose it is — which is also the question that decides
whether they may edit it.

### Behavior

**What it makes is fixed at creation and shown as a fact.** Changing it would
invalidate every variable in the body, so it is a chip rather than a control:
making a different kind of template is making a different template.

Renaming and re-scoping are held in the panel. There is no capability to write
either back, so neither survives a reload, and the note at the foot says so
rather than letting a change look saved.

## Built by

Who made it.

**Example** — Ana Reyes — "Regulatory analyst"

### Structure

- `PanelSection` `flush` — titled *Built by*
  - `PanelRow` — the author's name and role

### Behavior

Selecting opens [their profile](../../inspector/collaboration/person.md). The
section is absent where the recorded author matches nobody in the project, rather
than showing a name that cannot be opened.

## Used

Where this template has been instantiated.

**Example** — "Regulatory filing shell" — "last used 6 days ago"

### Structure

- `PanelSection` `flush` — titled *Used*, with a count
  - `PanelRow` ×n, with a `FileText` icon
  - `PanelNote` — "Nothing has been made from it yet."
- `PanelNote` `tone="gap"` — that renaming and re-scoping are held locally

### Behavior

Using a template hands back an independent copy, so this is a record of what was
made rather than a list of things that will change when the template does. Saying
so is the reason the section is here at all.
