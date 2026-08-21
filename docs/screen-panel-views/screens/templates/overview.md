# Templates — panels

A template is an ordinary body with some of it left open. The open parts are
variables you fill when you use it, and authoring one is authoring a document, a
deck, a slide or a spreadsheet.

Two subscreens: **all templates** — the library — and **one template**, which
replaces the library with the matching ordinary editor. The tab stays a Templates
screen throughout, with a visible label and a way back.

## Context panel — all templates

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/templates-library.md) | What a template is, and what this project has | Templates · In this project · Available everywhere · Selected |
| [Library](../../context/library/templates.md) | Every template, by scope | Project · Global |
| [Kinds](../../context/library/template-kinds.md) | The four things a template can make | Document · Slide deck · Slide · Spreadsheet |
| [Recent](../../context/library/recent-templates.md) | What has changed and what has been used | Recently updated · Recently used |

## Context panel — one template

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/templates-authoring.md) | This template: what it makes, what it asks for | This template · Saved · Attribution |
| [Variables](../../context/library/authoring-variables.md) | What it will ask the person using it | Required · Optional |
| [Body](../../context/library/authoring-body.md) | Getting around the template's content | Outline |
| [Insert](../../context/library/authoring-insert.md) | Putting content or a variable in | Basics · Variable |
| [Design](../../context/library/authoring-design.md) | Styles and page setup | Styles · Page |

Authoring reuses the ordinary editor's panels wherever it can. Only Variables is
particular to a template.

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A template in the library | The template: what it makes, what it asks for, and using it | [template.md](../../inspector/library/template.md) |
| A variable in the template | One thing it will ask for | [template-variable.md](../../inspector/library/template-variable.md) |
| Content in the template body | The ordinary editor's inspector, reused exactly | [body-entity.md](../../inspector/library/body-entity.md) |
| Use | What will be made, and what has to be supplied first | [use-template.md](../../inspector/library/use-template.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| All templates | Every template, as shapes | [workspace-library.md](workspace-library.md) |
| One template | A label saying what you are editing, and the body under it | [workspace-editor.md](workspace-editor.md) |

## The rules this screen keeps

**"Variable", not "slot".** That is what they are: a variable inside an ordinary
body.

**What a template makes is fixed at creation.** Changing it would mean converting
the body, which is not modelled.

**Using a template hands back an independent copy.** The result records where it
came from and nothing else — later edits to the template never reach it.

## The gap that gates this screen

No body entity carries a variable key. Nothing in a body records which variable it
stands for, so a variable cannot be placed, highlighted, jumped to, or filled.
Listing and adding variables works; everything else does not, and **Use** is
disabled on every template that has one.
