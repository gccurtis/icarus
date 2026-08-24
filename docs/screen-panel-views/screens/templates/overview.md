# Templates — panels

A template is an ordinary body with some of it left open. The open parts are
variables you fill when you use it, and authoring one is authoring a document, a
deck, a slide or a spreadsheet.

Two centres: the **library** and the **editor**. **This is the only screen that
keeps such a pair**, because the library has a folder structure and holds
templates from outside this project — it is a place rather than a list, and a
list is all a rail view can be.

You enter the editor by double-clicking a card and leave it by the back button on
the bar. There is no switcher in the context panel.

A template is Project, Shared or Personal. That is who may edit it, it is written
on the card in that scope's colour, and it is not a filter.

## Context panel — library

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/templates-library.md) | What a template is, what this project has, and what is selected | Actions · Templates · In this project · From outside this project · Selected |
| [Recent](../../context/library/recent-templates.md) | What has changed lately and what has been used lately | Recently updated · Recently used |
| [Resources](../../context/library/resources.md) | Every non-template resource in the project | Documents · Findings · Connector files |

Overview carries **New template**. It opens a modal asking what the template will
make, and then the editor on a blank template of that kind — because what a
template makes is fixed at creation, and asking afterwards would mean converting
a body that is not convertible.

[Library](../../context/library/templates.md) and
[Kinds](../../context/library/template-kinds.md) are written and are on no rail:
the plane *is* the library, and its dropdown is the kind filter.

## Context panel — editor

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/templates-authoring.md) | This template: what it makes, what it asks for, whether it is saved | This template · Saved · Attribution |
| [Template](../../context/library/template.md) | The template as a thing in a library: its name, its scope, where it has been used | This template · Built by · Used |
| [Variables](../../context/library/authoring-variables.md) | What this template will ask the person using it | Required · Optional |
| [Insert](../../context/library/authoring-insert.md) | Putting content, or a variable, into the template body | Basics · Variable |
| [Design](../../context/library/authoring-design.md) | Styles and page setup for the template body | Styles · Page |

Authoring reuses the ordinary editor's panels wherever it can. Only Template and
Variables are particular to a template: one is about the template as an object,
the other about what it will ask for.
[Body](../../context/library/authoring-body.md) is written and is on no rail —
the outline it holds is the document editor's Navigator, and a second copy of it
here would be two answers to *where am I in this*.

## Inspector panel — library

| Selecting | What it is | File |
| --- | --- | --- |
| A template card | The template: what it makes, what it asks for, and using it | [template.md](../../inspector/library/template.md) |
| Use | What will be made, and what has to be supplied first | [use-template.md](../../inspector/library/use-template.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

## Inspector panel — editor

| Selecting | What it is | File |
| --- | --- | --- |
| A variable in the template | One thing it will ask for | [template-variable.md](../../inspector/library/template-variable.md) |
| Content in the template body | The ordinary editor's inspector, reused exactly | [body-entity.md](../../inspector/library/body-entity.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

The editor's lenses are the ones the resource type already has. A template being
edited is a document, a deck, a slide or a spreadsheet being edited, and a second
set of lenses for the same objects would be the same panels written twice.

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| Library | Every template available here, as same-size cards, in folders | [workspace-library.md](workspace-library.md) |
| Editor | The template's body, on the surface it will become, under a bar that says which one | [workspace-editor.md](workspace-editor.md) |

## The rules this screen keeps

**"Variable", not "slot".** That is what they are: a variable inside an ordinary
body.

**What a template makes is fixed at creation.** Changing it would mean converting
the body, which is not modelled — which is why New template asks first.

**Using a template hands back an independent copy.** The result records where it
came from and nothing else; later edits to the template never reach it.

**Scope is a colour, not a filter.** Every template has exactly one, so it is
written on the card rather than made into a control that hides two-thirds of the
library.

**The editor auto-saves as a template.** There is no Save control; the revision on
the bar is what says a change took.

## The gap that gates this screen

No body entity carries a variable key. Nothing in a body records which variable it
stands for, so a variable cannot be placed, highlighted, jumped to, or filled.
Listing and adding variables works; everything else does not, and **Use** is
disabled on every template that has one.
