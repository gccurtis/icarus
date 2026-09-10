# agents

Personas, the tasks they run, the automations that start tasks without being
asked, and the chats a person has with one.

| procedure | answers |
| --- | --- |
| `readAgentsLibrary` | Everything the category lists at once: visible personas with their project counts, every task with its plan progress and what started it, every automation with its trigger, every chat with its last line, the project's activity by agents, the tool catalogue, and the resources and saved sets a scope is built from |
| `readPersona` | One persona in full: definition, default scope, default tools |
| `readTask` | One task in full: instruction, plan, outputs, questions and the turns of its thread |
| `readAutomation` | One automation in full, with the tasks it fired |
| `createPersona` | A project persona at revision one with the default tools and the whole project as its scope |
| `updatePersona` | A compare-and-swap patch of name, description, one definition section, scope, cast or tools |
| `duplicatePersona` | A viewer-owned copy at revision one |
| `removePersona` | Removal, refused while any task, automation or chat still names it |
| `createTask` | A running task with its own thread, opened on the instruction as its first message |
| `updateTask` | A compare-and-swap patch of title, scope, tools, the instruction while no plan exists, or finishing it |
| `sendTaskMessage` | A person's message appended to the task's thread |
| `answerTaskQuestion` | An answer or a rejection recorded on one open question; either way the thread hears it, so the runner is never left waiting |
| `createAutomation` | A rule for one persona; without an instruction it is created switched off |
| `updateAutomation` | A compare-and-swap patch of name, instruction, persona, trigger, scope, tools or enabled |
| `removeAutomation` | Removal, refused while tasks it fired still name it |
| `runAutomation` | One task made from the rule by hand, carrying its scope and tools, and the fire counted |
| `createChat` | A persona thread in its own thread row, ready to open as a research tab |

## Visibility

Everything is project-scoped. A persona is visible when it belongs to the scoped
project, or has no project and was created by the viewer. A task, automation or
chat is visible when it belongs to the scoped project and names a visible
persona. A row that fails those shape checks is left out rather than crashing
the list.

That admission is strict for the current representation. Persona definitions
and tools, task origins and run lists, and automation triggers, tools, and fire
counts must be present. The capability quarantines an incomplete stored row; it
never turns an absent required field into an empty definition, tool list, plan,
or counter.

## A task is a run

There is no separate run table. A task starts running the moment it is created
and moves through `running`, `review` and `finished`. Its plan, outputs and
questions are written by a runner; this capability reads them and lets a person
answer or reject a question, message the thread, stop the task or mark it
reviewed. The percentage a surface shows is derived from the plan, never stored.
What started a task is read from its origin: the person, or the schedule, edit
or new resource that fired the rule, never the rule's own name.

## Scope and tools

The catalogue of tools is a constant in the representation, not a table. A
persona holds a default scope and default tools. A task or an automation may
hold its own scope; when it holds none it reads whatever its persona reads, and
a projection answers `null` so the surface can say so. A tool id outside the
catalogue is refused, and a scope that includes nothing is refused.

## Revisions and refusals

Updates and removals require `baseRevision`. Stale, missing, in-use and
invalid-state requests are ordinary `accepted: false` answers, not transport
errors. Invalid payloads throw before the store is read. Running an automation
and appending to a thread do not bump the row's revision, because they change
nothing a person edits.

## What is not here

Nothing dispatches an agent. A created task waits for a runner that does not
exist yet, which is why it shows no plan. There are no skills: the table, its
procedures and every reference to one were removed.
