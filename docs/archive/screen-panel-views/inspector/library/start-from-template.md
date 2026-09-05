# A template

| Selecting | What it is | Sections |
| --- | --- | --- |
| A template card or row | A template, what it will ask you for, and using it | Identity · Preview · Variables it asks for · Create |

Enough to decide whether this is the template you want, without going to the
Templates tab. Editing it happens there.

## Layout

| 300px |
| --- |
| identity |
| preview |
| preview |
| variables it asks for |
| variables it asks for |
| create |

## Identity

**Shows** — `Name · Regulatory filing shell`, `Target · Document`, `Scope · Project`

**Needs** — `Template` name, target kind and scope.

## Preview

Rendered from the real body, not from a stored thumbnail — the model has no
thumbnail field and the library must not imply one.

**Shows** — a page thumbnail with variable regions distinguishable from ordinary
content.

**Needs** — a renderer that can draw a template body small, and a way to mark
which parts are variables.

**Open** — marking the variable regions requires knowing where they are, which is
the same gap that blocks use.

## Variables it asks for

What you will have to supply. Required and generated are distinguished, because a
generated one is not a question — it becomes a prompt block in the result.

**Shows**

- `filingDocket` — Text · required
- `filingParty` — Text · required
- `outageTable` — Table · required
- `execSummary` — Generated · optional

**Needs** — the template's variable list with key, type and requiredness.

## Create

**Use template** — disabled.

**Open** — blocked until a body entity can carry a variable key. Nothing in a body
currently records which variable it stands for, so a filled value has nowhere to
go. Every template with variables is unusable until this exists.
