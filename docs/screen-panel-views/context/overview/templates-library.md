# Overview — the template library

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | What a template is, what this project has, and what is selected | Actions · Templates · In this project · From outside this project · Selected |

The orientation panel for the Templates library, and the one place a template is
made. It is on the library rail only: the editor has
[its own overview](templates-authoring.md), about the template being written.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.library.templates` | Capability | every template, with its scope and what it makes |
| `capabilities.library.templateKinds` | Capability | the four kinds, for the per-kind counts |
| `capabilities.library.template` | Capability | the selected template |
| `capabilities.library.variablesIn` | Capability | its variables, and how many are required |
| `capabilities.library.useTemplateDraft` | Capability | whether **Use** can proceed, and the sentence saying why not |
| `templateId` | Prop | which template *Selected* is about, where a caller already knows |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| actions | `PanelButton` |
| templates | `PanelNote` |
| in this project | `PanelSection` |
| from outside this project | `PanelSection` |
| selected | `PanelSection` |

## Actions

The one thing this screen makes.

**Example** — **New template**

### Structure

- `PanelButton` `tone="primary"` — **New template**

### Behavior

**Making a template is an act of the map, not of the title.** The library's
header lists what there is; what you can add to it belongs beside the counts that
say how much there already is.

It should open a modal asking what the template will make, then the editor on a
blank template of that kind — what a template makes is fixed at creation, and
asking afterwards would mean converting a body that is not convertible. The kind
picker is not built yet, so it lands on a blank Document: the commonest of the
four, and the only one whose empty state is a page you can type on.

## Templates

The concept, in two sentences, because "template" means something slightly
different in every application.

**Example** — "A template is an ordinary body with some of it left open.
Authoring one is authoring a document, a deck, a slide or a spreadsheet — there
is no separate template editor."

### Structure

- `PanelNote` — the two sentences

## In this project

Counts by kind.

**Example** — Templates `6` · Documents `2` · Slide decks `2` · Single slides `1`
· Spreadsheets `1`

### Structure

- `PanelSection` → `PanelFields` — a total, then one field per kind

### Props

**The counts are by kind rather than a single total**, because the fastest way to
notice this project has no deck template is a zero beside *Slide decks*.

## From outside this project

Everything that is not the project's own, counted apart.

**Example** — Templates `2`

### Structure

- `PanelSection` → `PanelFields` — one count
- `PanelNote` `tone="gap"`

### Behavior

**Shared and personal templates are counted apart from the project's own.** One
can be used here; who may edit it is a deployment rule rather than something the
absence of a project says, and the note declines to claim either way.

The three scopes are Project, Shared and Personal. *Global* and *Everywhere* are
gone: they described where a template could be used, and the question a person
actually asks is whose it is.

## Selected

The current selection, and the two things you do with it.

**Example** — Name "Regulatory filing shell" · Makes `Document` · Variables "3 of
4 required", with **Open** and **Use**

### Structure

- `PanelSection` → `PanelFields` — name, kind, and what it asks for
  - `PanelActions` → `PanelButton` ×2 — **Open** and **Use**

### Props

*Variables* reads *n of m required*, or **None**. A template that asks for
nothing is a legal template and says so rather than showing a zero.

### Behavior

**Open** puts the template in [its lens](../../inspector/library/template.md).
**Use** is disabled while variables cannot be placed, and the reason is the
door's own sentence rather than a guess written here — the gap that gates this
screen is that no body entity carries a variable key.
