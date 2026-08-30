# Agents

## What the subject is

These are the narrow-column panels of the Agents screen: the lists and the
bands you move through, rather than the reading of any one thing. Together they
answer *what agents exist here, what has each been told, what work is in flight,
and what runs without anybody asking*. They split into three groups, and the
split is the thing a list of ten names hides. Four are library panels over the
whole project — Personas, Tasks, Automations, Health — and stand on their own.
Four band a single persona once one is chosen — Behaviour, Context, Tools, Work
— and are meaningless without a subject. Two are the halves of a single
Automation — When and Do this — and are a chooser each, not a settings form,
because a rule has exactly one trigger and exactly one action.

Panels in this stack list, group and route. Reading one thing closely is the
inspector's job, and nearly every row here hands off to a lens. Two of those
hand-offs leave the subject entirely: a task row goes to the Copilot's task
lens, which is the same lens the Copilot itself, Project Overview and an
Automation's last fire reach, with only its breadcrumb varying.

## Personas

Every agent available here, searchable, under three headings in the order a
project's own agents are looked for: Project, Shared, Personal. The grouping is
the whole content of the panel — a global persona is not this project's to edit,
and the two lower headings are the only place that is said.

The row carries what the persona has done, not what it describes: a task count,
with a running count added only when something is running, so a quiet persona
reads as quiet. Two personas with similar descriptions are told apart by their
record, which is why the count is the qualifier and the description is left to
the profile.

New, Open and Duplicate sit in the actions row; the last two wait for a chosen
row and say so. There is no Delete, and not a disabled one either: tasks and
conversations name a persona, and there is no tombstone policy that would keep
those labels readable after a hard delete. A disabled button would imply the
policy exists and is merely unmet.

Deliberately not doing: whether a shared or personal persona may be edited from
here is a deployment rule the model does not carry, so the row cannot say.

Routes to `agents.persona`.

## Behaviour

The five sections of the agent's definition, one row each: the name, what the
section is for, and what it costs in characters. The heading counts how many of
the five carry anything.

This is prompt material — text sent on every call — and it never shares a panel
with Context, which is material the agent goes and looks things up in. The text
itself belongs to the section lens: at this width a panel holding five
paragraphs is a panel nobody can compare five things in, and the character count
is what a reader is actually comparing. Every written section is sent on every
call, which is what that count measures; an empty one is left out of the prompt
entirely, and a persona with five empty sections and a scope is a legal persona.

Empty is a state rather than an error, so an unwritten section is a row that
says Empty and is not toned as a fault.

Routes to `agents.behaviour-section`.

## Context

What this agent can look up — retrievable material, as opposed to the prompt
material in Behaviour.

One row for the scope, carrying two numbers: how many resources it contains and
how many of those are searchable. Two numbers rather than a percentage, because
a percentage hides which of the two a reader is looking at, and searchable is
always the smaller one. The gap between them is what decides what the agent will
actually find.

Below it, a bounded sample of the contents, counted as so many of the total. The
count is resolved now rather than stored: a Context is a rule, so what the agent
will find today is not what it found when the persona was saved, and the sample
is here so a scope that has drifted is visible from the profile rather than only
from the Context screen. Open Context screen sits in the actions row rather than
under the list, because the way out of a panel should not sit at the bottom of
something of unbounded length.

Deliberately not doing: when the scope matches nothing, the panel says so and
stops there — an empty scope is not yet distinguishable from no scope at all,
and an agent set up to see almost nothing would silently see the whole project.

Routes to `agents.what-it-can-look-up` from the scope row and
`scope.resolved-resource` from a sampled name.

## Tools

What this agent may do, and which model runs it.

Permissions are two lists — Allowed and Not allowed — rather than one list of
checkboxes, so what is denied is as visible as what is granted. A task that
failed because a tool was not permitted is diagnosed by reading the second list.
There is no Web toggle: web search is a tool like any other, and a persona
either has it or does not.

The search field covers both permission lists and nothing else. The model is not
a tool, and a search matching no tool must not take the binding off the screen
with it. The model band holds one row and a sentence: a binding name, not a
credential. Providers, credentials and deployment setup belong outside the
project workbench entirely, which is why that band is not a settings form.

Routes to `agents.tool` and `agents.model`.

## Work

Everything this agent has done here, by state: Running, Failed, Completed, then
Conversations, which arrives shut. It is a panel of its own rather than a band
on the profile, because what an agent has done is the main evidence about it.

Waiting sits inside Running. A task that is blocked on an input has been
dispatched and has not finished, which is the same situation for the person
reading this; only the tone separates them. Each running row says what started
it, because a task the agent began and a task an Automation dispatched are
different situations.

The counts read as *listed of total* against the persona's record, so a list of
three under a heading reading thirty-eight is a sample that says so. When a
failure is a tool that was not permitted, the Failed band says as much and
offers a way to Tools: that is a configuration failure rather than a runtime
one, and re-running the task changes nothing until it is fixed. Threads sit
beside tasks because both are work this agent did, shut on arrival because the
question that brings someone here is what ran, not what was discussed.

Routes to `copilot.task`, `copilot.conversation`, and `agents.tools` in the rail.

## Tasks

Every task in this project, grouped by whether it needs you: Running, Failed,
Done — with Done shut. Failed is its own group and never folded into finished
work; rolling failures in with finished work is how a run that produced nothing
gets counted as one that did. A search and a persona filter narrow the list, and
the row's icon says whether an Automation fired it.

This is the map for the screen: what the workspace's table holds, in the narrow
column, so you can move between tasks without going back to the library. Alone
among the panels here it navigates rather than inspects — choosing a task opens
it in the centre, because a task is a place you work rather than a thing you
glance at.

## Automations

Every standing rule in this project, in the order that needs attention: Not
working, On, Off.

A broken rule carries its reason on the row. The reason is almost always a
configuration failure elsewhere — a persona missing a tool, a connector
unauthenticated — which makes the row fixable rather than merely reported. A
live rule is summarised by its trigger, because that is what distinguishes two
rules that both ask an agent for something. A dormant rule says either that it
never fired or what would have fired it.

New, Open, Run now and Duplicate sit in the actions row. Run now dispatches
using the saved rule rather than an edited one and says so afterwards; a
dispatch is a fact about this session, not a state of the rule. The copy
Duplicate makes is left off, so it cannot fire before it has been read.

Routes to `agents.automation`.

## When

The trigger half of an Automation: the five things that can start a rule. A rule
has exactly one trigger, so this is a chooser rather than a list of settings —
the chosen one is expanded and marked, the other four collapse to a name, a line
of blurb, and a way to choose them instead. While a choice differs from the
saved one the panel says which trigger the rule still starts on until it is
written back.

All five are always drawn. They are the vocabulary of the feature, and hiding
the four that are not chosen makes the feature look smaller than it is. A
schedule shows its time, its timezone and its next fire, with the cron form
behind a shut Advanced band; the timezone is stored rather than inferred,
because a time without one is ambiguous to everyone but its author. Connector
sync names its connector and opens it. Finding accepted names the question it is
confined to, or says any question in this project. Only when I say is a real
trigger with Run now as the point of it, not the absence of one.

Deliberately not doing: on a resource-change trigger, created, edited, renamed
and deleted are four different things and the model has one word for all of
them. A rule that fires on every one of them is rarely what anyone meant.

Routes to `project.connector`.

## Do this

The action half: the two things a rule can do, in the same chooser shape and for
the same reason.

Ask an agent expands to the agent, as a link into its profile, and the
instruction it will be sent. The instruction is sent verbatim: nothing is added
to it and nothing is templated into it. Re-run a generated block lists every
block either way, because that band is a list of candidates as well as a summary
of the choice, and the chosen block is marked by its row rather than by a chip.

Deliberately not doing: a block stores no pointer back to what it lives in, so
where a block lives is a reverse query — and it sometimes comes back empty.

Routes to `agents.persona`.

## Health

The state of every rule in one place, and the view Project Overview's Health
links into. Three groups: Not working, Never fired, Working. The middle one is
the reason the view exists — a rule that has never run is not broken, but it is
not working either.

A group stays on screen with nothing in it, saying that nothing is in that
state. Its emptiness is an answer about the project, while its absence would
read as a panel that did not load. Working rules are qualified by roughly how
often they have fired; the other two by the fault or the dormancy.

Deliberately not doing: there is no timeline here and there will not be one. No
run table, no retry model, no history beyond the last fire — so this shows a
state and an approximate count, and the tilde in front of the count is
load-bearing.

Routes to `agents.last-fired`.

## What is not here

Nothing in this stack reaches a running agent. Nothing is stopped, steered or
retried from a list, and the only dispatch is Run now against a saved rule.

Nothing is deleted. Neither a persona nor an Automation has a Delete, and
neither has a disabled one standing in for the promise of one; turning a rule
off is the removal, and it keeps everything attributed to it.

Nothing is written back. The two Automation choosers hold a choice for the
session and say plainly that the rule still does what it did until the change is
written; that is preferred to a change that silently vanished on the next read.

There is no history anywhere in the subject. The last fire is the whole record,
the fire count is approximate, and no panel here can show a series.
