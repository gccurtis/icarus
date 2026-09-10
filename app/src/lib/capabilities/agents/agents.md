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
| `createTask` | A running task with its own thread and grounded runner plan, opened on the instruction and dispatched immediately |
| `updateTask` | A compare-and-swap patch of title, scope, tools, the instruction while no plan exists, or finishing it |
| `sendTaskMessage` | A person's message appended to the task's thread; a reviewed task reopens and new direction is dispatched |
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
questions are written by the grounded runner; this capability reads them and lets a person
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

## Grounded execution

The current runner is the production read lane. It resolves the task's scope or,
when the task has none of its own, the persona's exact scope. It prepares only
resources inside that boundary, then uses the same exact Semantic Overlay search
and authoritative resource-reading tools as Research Chat. Nominal External
references retain their subkind from scope through retrieval, response
attachments and outputs; no generic file identity is accepted or reconstructed.
Scope is optional in the current task and persona schema. When neither row has
one, the runner binds itself to one explicit empty `resources` term and reads
nothing. It does not use an empty `include`, because Semantic scope deliberately
means the whole project in that shape. Absence never widens to the project and
is not repaired into another stored shape.

The three-step runner plan is its durable ownership signature. Creation and a
manual automation fire write that plan in the same transaction as the task and
thread, then dispatch one process-owned flight. A server restart resumes only a
running task with that exact signature. Shutdown leaves it running for that
resume; a person's Stop aborts immediately and terminalizes the task. Provider,
deadline and preparation failures write a redacted explanation. A successful
publication writes the response, cited outputs, completed plan, review state and
activity atomically.

`retrieve` and `resource.read` are executable now. The other represented grants
remain explicit future tool families; this runner never silently substitutes,
widens scope or invents an implementation for them. There are no skills.
