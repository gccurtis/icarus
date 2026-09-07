# Agents

Lives at `src/lib/app-views/categories/agents/agents.md`.

Personas, the tasks they run, the automations that start tasks, and the chats a
person has with one. A singleton: one tab per project, always open, never
closed.

| Content | Shows |
| --- | --- |
| [`library.svelte`](content/library.svelte) | Create, what agents have done, and every task in one table |
| [`persona.svelte`](content/persona.svelte) | One persona: its definition, what it may reach, its tasks, rules and chats |
| [`task.svelte`](content/task.svelte) | One task: instruction, plan, questions, outputs, grants and its thread; or the form that starts one |
| [`automation.svelte`](content/automation.svelte) | One rule: when it fires, whom it asks, what it says, and what it has fired |

Everything reads and writes through
[`$capabilities/agents/index.remote.ts`](../../../capabilities/agents/index.remote.ts).
No view holds a copy of a row; the shared pieces under `components/` take ids
and read the same library the surfaces do.

## The shape

A task is a run. It starts the moment it is created, and it is `running`,
`pending review` or `finished`; success or failure is the agent's to say in its
outputs. An automation is a standing rule that makes a task each time it fires,
and a manual automation is one a person fires by hand. A persona is static data:
what to concentrate on, what it knows, how it works, what shape it answers in,
what must be true first.

What an agent may reach is two things: a scope, which is the resources and saved
sets it may read, and tools. Both live on the persona as defaults; a task or an
automation may set its own, and Persona defaults gives it back. One band carries
both: a label, a toggle under it, and a grid of rows that reads the same either
way, so switching between them moves nothing.

Everything is project-scoped, and every count a surface shows is a count within
the project.

## Library

Three bands on one plane, in the shape Project Overview keeps. Create holds
four pills, stacked: a persona is created at once under a working name and
opened; a task opens a form, because it starts running the moment it exists; an
automation is created switched off and opened, so it cannot fire before it has
been written. The fourth is Skill, and it does nothing: skills are not built.
Activity is what agents have done, and a click opens the activity lens. Tasks is
the one table, with a persona filter beside type and state and an ordered sort
that names its direction. The filters belong to the library and start on Any
every time it is shown; nothing narrows the table from outside, and the Persona
column is always there. No band carries a count. A click inspects, a
double-click opens.

## Persona

A thin band that only says Back and Persona, then the surface: the face, an
editable name and one-line description, and the actions. New task opens the form
on this persona; New automation and New chat create and open. Delete is refused
while anything in the project still names it. Under the head, the definition on the left as one tabbed panel: a tab per
section, what that section is for written out under the tabs, and the text in a
box that fills the rest. On the right, the defaults, cut to the same pattern: a
tab for the scope and one for the tools, a line saying what that half governs,
and the rows in a well. The tabs and the boxes line up across the two columns,
which stay the same height whichever tab is showing, and each scrolls inside
itself. Under both, one band for its tasks or its rules, each with its own
search and filters, and the task table drops the persona column because every
row is this persona. Chats has a band of its own underneath.

Every band has a set height that grows with the window, so the surface reads
without scrolling and any one band scrolls on its own.

## Task

A thin band, then the head: the title, the type and state, when it started and
what started it, and how long it has run. The instruction in full, with the
persona under it. The plan is the agent's own, drawn as a table whose right
column is each step's state and whose header for that column is the percentage
done; a task without a plan says so instead of guessing. Beside it, at the same
height, the questions the agent is waiting on, one tab each under a header that
says who asked: the agent's options plus its own words, with Answer and Reject,
and either way the thread hears it. Under those two, the outputs beside what the
task may reach: outputs are what the agent kept, each with where it landed, and
the band shows a count only when it is zero, while the scope and the tools share
the other half and stay editable while it runs. The thread sits at the foot in
its own territory, shows every turn and takes a message. Every band has a set
height and scrolls inside itself, so the surface reads without scrolling.
Stop finishes a running task; Mark reviewed finishes one pending review.

## Automation

The rule read as a sentence, the trigger as four cards with their parameters, Do
this as a searchable persona picker beside the instruction, the scope and tools
relative to the persona's defaults, and the tasks it fired. Run now makes one
task from the saved rule, and the task carries the rule's scope and tools. A
rule with no instruction cannot be switched on or run. Delete is refused once it
has fired.

## Context

Three panels, and the first is the landing one.

- **Personas** — the roster; a click opens the lens, a double-click opens the
  persona.
- **Tasks** — running, pending review and finished, searchable.
- **Automations** — every rule in three sections: the manual ones with a Run
  control, then the standing rules that are on and off.

None of them restates the centre, none of them narrows it, and none of them
explains itself in a note; the panels list and route, and reading closely is the
inspector's job.

## Inspector

Five lenses, one per selectable thing: persona, task, automation, tool and one
thing an agent did. The persona lens says Persona, then the name in a text input
that saves on Enter, the description in a box that scrolls past a few lines,
Open across the row, the running and pending-review tasks as rows, and then the
definition, the default scope and the default tools as disclosures shut by
default. Its definition rows open the same tabbed panel as a modal, with the
section's purpose above the text and a Save button under it. The task lens
names the persona and when it started in one line, carries how long it has run
beside the plan, and keeps its outputs, scope and tools shut. The tool lens is
reached from a persona, a task or an automation and toggles the grant on
whichever it came from. The activity lens names the persona and the thing acted
on and can open it.

A lens follows what was last chosen. Opening a surface claims the lens once, so
a persona surface can be read while the lens is on another persona.
