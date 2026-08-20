# Shared panel views

Views and lenses that belong to no single screen. Each is reachable from every
screen, so each is written once here rather than eleven times.

## Context views

| View | What it shows | Where it appears |
| --- | --- | --- |
| [Variables](context/variables.md) | The project's variables — tables, values and functions | Every screen that can hold a formula, plus Project Overview. Analysis has its own field-expanding variant. |

## Inspector lenses

Anything that can appear as *who did this* is an actor, and every actor is
inspectable. Only a person has somewhere to write to.

| Selecting | What it is | File |
| --- | --- | --- |
| A person's avatar, name, or any "who" link | Their profile, and the one place you can write to them | [person.md](inspector/person.md) |
| An agent, anywhere it is named | What it is, what it has done, and why it has no inbox | [agent.md](inspector/agent.md) |
| An Automation named as an actor | The rule that did the thing, read as a sentence | [automation-actor.md](inspector/automation-actor.md) |
| A connector named as an actor | The connection that brought the file in | [connector-actor.md](inspector/connector-actor.md) |
| A project variable, anywhere | Its name, its type, and what it currently holds | [variable.md](inspector/variable.md) |
| The Copilot, opened | Everything in flight, and everything recent | [copilot-home.md](inspector/copilot-home.md) |
| A Copilot conversation | One thread with one agent | [copilot-conversation.md](inspector/copilot-conversation.md) |
| A task, from anywhere | What was asked, the plan, and where it has got to | [copilot-task.md](inspector/copilot-task.md) |
| The Copilot's scope control | What this request will be able to look up | [copilot-what-it-can-see.md](inspector/copilot-what-it-can-see.md) |

The Copilot lives in the middle of the status bar and is disabled on Research,
which is already a conversation with an agent.

## Why these resolve first

An actor and the Copilot belong to no tab. They resolve ahead of a screen's own
lenses, so clicking an avatar in a spreadsheet and clicking one in Research reach
the same place. A screen never redefines them.
