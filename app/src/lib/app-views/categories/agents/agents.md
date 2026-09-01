# Agents

Lives at `src/lib/app-views/categories/agents/agents.md`.

Personas, the tasks they run, and the automations that dispatch those tasks. A
singleton: one tab per project, always open, never closed.

The only category with four content views. A persona, a task and an automation
are each one thing read closely, and the library is the map onto all three —
which is why moving between them is choosing something rather than pressing a
switch.

| Content | Shows |
| --- | --- |
| [`library.svelte`](content/library.svelte) | Every persona and every task, in one table |
| [`persona.svelte`](content/persona.svelte) | One persona |
| [`task.svelte`](content/task.svelte) | One task |
| [`automation.svelte`](content/automation.svelte) | One automation — a task with a trigger |

The rail differs per content view; the lenses do not.

## Context

These are the narrow-column panels of the Agents category: the lists and the
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

### automations

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

### behaviour

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

### context-persona

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
from the Context category. Open Context category sits in the actions row rather than
under the list, because the way out of a panel should not sit at the bottom of
something of unbounded length.

Deliberately not doing: when the scope matches nothing, the panel says so and
stops there — an empty scope is not yet distinguishable from no scope at all,
and an agent set up to see almost nothing would silently see the whole project.

Routes to `agents.what-it-can-look-up` from the scope row and
`context-editor.resolved-resource` from a sampled name.

### do-this

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

### health

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

### overview

What is running right now and what is standing by. The orientation panel for a
category whose subject changes under you — a task finishes while you are reading a
persona — so the figures are the state of the whole category rather than of
whatever the centre happens to be showing, and they stay put while you move
between Personas, Tasks, Automations and Health.

Three figures across the top: Running, Failed, Personas. Waiting is counted
inside Running, on the same reading the Persona's Work view takes — a task
blocked on an input has been dispatched and has not finished, which is the same
situation for the person looking at it.

**Running comes first and Failed second.** A finished task is a result you go and
read; a failed one is a thing to decide about, and the panel that orients you
should say so before it says how much has gone well. Done is not here at all.
Failed is not drawn when nothing has failed — unlike the Health view, where an
empty group stays on screen to say that nothing is in that state. Automations on
arrives shut and is summarised by each rule's trigger, because that is what tells
two rules apart that both ask an agent for something.

Like the Agents category's Tasks panel, this one navigates rather than inspects:
choosing a running or failed task lands the centre on it, choosing a rule lands
the centre on the rule, and the two actions land the centre on a new persona or a
new Automation. Nothing here opens a lens.

What it deliberately does not do: it reports nothing about what an Automation
produced. An Automation is a task with a trigger — its runs are tasks, and the
task is what carries the results — so a rule's row says what fires it and stops
there.

### personas

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

### tasks

Every task in this project, grouped by whether it needs you: Running, Failed,
Done — with Done shut. Failed is its own group and never folded into finished
work; rolling failures in with finished work is how a run that produced nothing
gets counted as one that did. A search and a persona filter narrow the list, and
the row's icon says whether an Automation fired it.

This is the map for the category: what the workspace's table holds, in the narrow
column, so you can move between tasks without going back to the library. Alone
among the panels here it navigates rather than inspects — choosing a task opens
it in the centre, because a task is a place you work rather than a thing you
glance at.

### tools

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

### when

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

Routes to `project-overview.connector`.

### work

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

Routes to `general.copilot-task`, `general.conversation`, and `agents.tools` in the rail.

## Inspector

These are the lenses behind the Agents category: one thing at a time, read closely,
reached by choosing a row somewhere else. Together they answer *what exactly is
this — and what would changing it mean*. They fall into three families, each of
them a head and its parts, and the family is what tells you which lens you are
in when a breadcrumb is all you have.

A persona has four parts: one section of its behaviour, what it can look up, one
tool permission, and the model binding. A task has two: one line of what it was
told, and one thing it produced. An Automation has five: the trigger choice, the
schedule behind that choice, each of its two possible actions, and the last fire.
Every part carries a breadcrumb back to its head, and every head arrives with its
configuration bands shut and its evidence bands open, because the reason someone
opened a lens is almost never the configuration.

Every lens here reads. Edits are held in the panel and said to be held there,
which is the standing decision across the subject: a write that vanished on the
next read would be worse than one that is plainly local.

### agent-action

The first of the two actions: who is asked, what they are asked, and what comes
out.

The agent is drawn large, as a face and a way into its profile. The instruction
is quoted rather than set as a field because it is sent verbatim — nothing is
added to it and nothing is templated into it. That agent's reach and permissions
sit in a shut band, because a rule that asks an agent for something it lacks the
tools for fails at the hour it fires, silently, every time, and the permission is
the first place to look. What comes out is the task the last fire made, marked as
started by this rule; that task is the whole trace and it opens in the Copilot,
because the rule records only that it dispatched.

When the rule's action is the other one, the panel says so and stops: a rule has
exactly one action.

Deliberately not doing: a scheduled prompt often wants to say "last night" or
"this week". Whether any substitution is available is unaddressed, and so is how
a prompt stays correct as time passes without one.

Routes to `agents.persona` and `general.copilot-task`; breadcrumb back to
`agents.automation`.

### automation

The rule as a sentence, whether it is on, and what happened the one time there is
a record of.

The sentence is the rule. Trigger and action fields are how it is stored, and
this is how it is read, in the same two clauses the list and the workspace
heading use; the comma is the whole connective, because the action clause carries
its own verb. The bands are This rule — name, an on switch, the sentence — then
Last fired, then Attribution, shut, because who made it is provenance rather than
the reason the panel was opened.

Open puts the trigger in the rail. Run now dispatches using the saved rule rather
than the edited one, and reports Started rather than succeeded, because what a
fire does is create a task.

Turning it off is the safe removal: a rule that is off never fires and keeps
everything attributed to it. Deliberately not doing: hard deletion stays gated
until there is a tombstone policy — past tasks are attributed to this rule by
name, deleting it would break every one of those labels, and a disabled Delete
would imply the policy exists.

Routes to `agents.last-fired`, `general.person`, and `agents.when` in the
rail.

### behaviour-section

One of the five sections of a persona's definition: what it is for, what it says,
and what it costs.

The first band is the purpose, and it is static. It is the whole reason the lens
has a first band: Focus is not Approach and Approach is not Output, and nothing
about the five names makes that obvious. Then the text, editable. Then the cost
in characters, measured from the text on screen rather than read from the record,
so an edit and what it costs cannot disagree while the edit is uncommitted. It is
sent on every call this persona makes.

An empty section says so and is not an error: it is left out of the prompt
entirely, and a persona with five empty ones and a scope is legal.

Deliberately not doing: characters are a proxy for tokens, and a bad one for
anything not written in Latin script. Showing tokens instead needs a tokeniser in
the client.

Breadcrumb back to `agents.persona`.

### last-fired

What happened the one time there is a record of. There is no run table, so
nothing here is the head of a list.

The summary carries when, the result, why when a fire could not start — a fire
that made no task needs the reason to carry the weight the task band cannot — and
roughly how many times the rule has fired, with a tilde, because the number is
approximate and this fire is the entire history rather than the most recent of a
series.

Then a band whose whole content is what Started means: the task was created;
whether it finished is the task's own story, and a later failure never rewrites
this line. "Succeeded" would be a claim about work this rule never watched. A
fire is a dispatch, so the word is Started — and that is a section rather than a
tooltip, because it is the thing most easily misread on the page.

The task it made arrives shut, being context for the summary rather than the
reason the panel was opened. Where there is none, the panel says a fire that
could not start made nothing, and that a re-run of a generated block leaves no
run record of its own.

Routes to `general.copilot-task`; breadcrumb back to `agents.automation`.

### model

Which binding runs this agent, and the shortest lens on the screen on purpose. A
binding name, and nothing else.

Whether the chosen binding is the default reads Yes or No for the stored one and
"Not known until this is saved" once a different one is picked — which of the
others the deployment treats as its default is deployment configuration, and
guessing it here would put a claim on the screen nothing supports.

The second band holds the boundary as a sentence: providers, credentials,
endpoints and deployment setup belong outside the project workbench, and this is
exactly the place a settings category would grow if nobody said so.

Deliberately not doing: where the list of bindings comes from is unsettled.
Bindings are deployment configuration rather than project data, so nothing in the
project owns them.

Breadcrumb back to `agents.persona`.

### persona

Who the agent is, what it has done, and what it may see and do. A profile rather
than a form — the picture and the name, then the record, then the configuration,
because that is the order the questions come in.

The head is the persona itself, drawn large and with no way to click it: it is
the subject of the panel and cannot be navigated to from inside itself. Under it,
an editable name and description, and a Picture button that is disabled because
there is nowhere to keep an image yet. Where it is available — Project, Shared or
Personal — is a choice in a block of its own, kept off the block above so it does
not read as belonging to the note about pictures.

The bands, in order: Record, two numbers about what it has done; Behaviour, the
five section names and how many of them are written, as a summary, since the five
are read and written in the Behaviour view; Can look up, one row for the scope;
May do, shut, holding how many tools are allowed of how many and which binding
runs it; then, after a rule, Removal.

Deliberately not doing: an avatar has nowhere to be stored, and whether a persona
can have a generated one with it is unsettled, so initials stand in. Nothing in
the model aggregates per persona, so the two record numbers are counted for this
panel and no other category can be made to agree with them yet. And there is no
Delete and no disabled one either — every task and every conversation this
persona ran is labelled with its name, hard deletion would break those labels,
and a disabled button would imply a tombstone policy exists and is merely unmet.

Routes to `agents.what-it-can-look-up`.

### refresh-action

The second action: which generated block gets re-run, and what re-running it
actually does.

The block's own prompt is quoted, carrying the resource and location it lives in
and a way through to it. Re-running is not a fix for staleness — the block
already runs when its resource is opened, and nothing in this application is
stale. It is for having the answer ready before anyone looks. The record band
holds one link: this rule's last fire.

Deliberately not doing, twice over. Where a block lives is a reverse query,
because the generated output stores no pointer back to the block that owns it, so
that line can come back empty. And a re-run leaves no run record of its own —
only this rule's last fire and the block's own provenance — which means two
re-runs and two hundred are indistinguishable afterwards. Acceptable while there
is no run table; worth revisiting when there is.

Routes to `document-editor.prompt-block` and `agents.last-fired`; breadcrumb back to
`agents.automation`.

### schedule-trigger

A schedule trigger: when the rule fires, and when it fires next.

The timezone is a field rather than an assumption — a time without one is
ambiguous to everyone but its author, and a digest that runs at the wrong hour
fails silently. The next fire comes from the scheduler and is never computed
here: a panel that worked out its own next-fire time and disagreed with the
scheduler would be worse than one that said nothing. When the scheduler reports
none, the panel says so, and says that is what a rule that is off looks like. The
stored cron form sits behind a shut Advanced band, for people who want it.

When the rule's trigger is something else, the whole panel is one sentence saying
that: a rule not on a schedule has no time to show.

Deliberately not doing: an invalid cron expression and an unsupported timezone
are separate failures and have to be reported separately. One "invalid schedule"
message for both leaves the author guessing which half is wrong.

Breadcrumb back to `agents.automation`.

### task

One agentic task, from wherever it was picked. A lens, not the manager:
everything needed to decide *whether to go and look* is here — what it was asked,
how far it got, what it produced — and the step that follows is a button rather
than a scroll.

State, who started it, when, and a chip when an Automation fired it. Then Asked,
clamped to a few lines, because a lens holding three hundred characters of prose
would push the decision off the bottom of the panel. Then a progress meter
carrying the current step, then the persona running it, then what it produced.
Open takes you to the whole task in the centre.

Stop is drawn and disabled while the task runs, and the reason is a dispatch
rather than a missing button: stopping a task means reaching the agent that is
running it, and no capability reaches an agent. When it has stopped, Run again is
disabled for the same shape of reason.

Deliberately not doing: steering a task means reaching the agent running it, and
nothing here reaches an agent — so what a task did is readable and what it does
next is not yet decidable from this panel. The full trace of a run — its plan,
its tool calls, what it produced and whether that was promoted — belongs to the
Copilot's task lens, which is the one entered from a persona's Work list and from
an Automation's last fire.

Routes to `agents.persona` and `agents.task-results`.

### task-behaviour

One line of a task's configuration: what it was told, rather than what it did.

Editable while it runs, and that is the point. A setting you can only read is a
log entry; the reason to open this from a running task is to change what it is
allowed to do next. Once a draft differs from the stored value, what the task was
*originally* told stays visible beside it, because a task judged against a rule
that was changed halfway is a task nobody can judge.

Under the value sit the task and its state, then every other line it was told,
with the current one marked, so one setting can be read against the rest.

Deliberately not doing: a change is held here. Nothing writes a task's
configuration back yet, so a running task carries on under what it was originally
told.

Routes to `agents.task-behaviour` between settings; breadcrumb back to
`agents.task`.

### task-results

One thing a task produced, and what else came out of the same run. This is the
only lens in the tree with two roots, and the branch is whether the result still
exists.

When it does, the panel is the result: what it found, then a field naming where
it landed or saying it landed nowhere and was reported only. That distinction is
the whole difference between a finding an agent wrote into a resource and one it
only mentioned, and it is the first thing anyone checking the work needs to know,
which is why it is a field and not a sentence buried in the detail. When it did
land somewhere, a row opens that resource. Then the siblings from the same run,
because results are read against each other: three lines saying the same thing
three ways is a different situation from three lines saying three things. Keep
and Reject are drawn and disabled — a result has no accepted or rejected state in
the model.

When it does not, the panel is one line saying that result is no longer on any
task. A result is found by searching the project's tasks for the one that holds
it, so an id that resolves through nothing has no owner to draw a breadcrumb
from, and the branch is the whole panel rather than an empty band inside it.

Deliberately not doing: a finding has an accepted state; a task's result does
not. Until where a kept result lands is decided, keeping one is a word without a
destination.

Routes to `project-overview.resource` and to `agents.task-results` for a sibling;
breadcrumb back to `agents.task`.

### tool

One tool permission, and what granting it means. The lens exists for the toggle:
a denial is a row in the catalogue rather than an absence, so a tool that is not
allowed is still selectable and still says what allowing it would do.

Two bands: the tool and whether it is allowed, then what it does. The description
is written for someone deciding whether to grant it rather than for someone
calling it, which is why the tool's reach is stated in the same breath — a
retrieval tool is bounded by what the persona can look up, so granting it is not
granting access to the project.

Deliberately not doing: the catalogue has to carry those descriptions, and they
have to be written for the grantor. Nothing yet guarantees they are.

Breadcrumb back to `agents.persona`.

### trigger

What makes an Automation fire: the choice between the five, and the detail of
whichever is chosen.

One lens for all five kinds, not five lenses. They are alternatives to one
another, so the interesting act here is switching between them, and a lens per
kind would make that act a navigation. The chosen kind is a chip; the one field
that varies with the kind sits beside it, and some kinds carry none. Under that,
the last fire and roughly how many times it has fired, then all five as rows with
the chosen one marked.

Only when I say is a real trigger, not the absence of one. A rule that never
fires on its own is a saved action you run deliberately, and calling that "no
trigger" is how it ends up looking broken in a health list.

Deliberately not doing: choosing a different trigger selects it here and nothing
more. No capability writes a rule back.

Routes to `agents.trigger`; breadcrumb back to `agents.automation`.

### what-it-can-look-up

The agent's scope: what it may look things up in, and how that combines with
whatever a request adds.

Both counts are shown, because the gap between them is the one that decides what
the agent will actually find — a scope containing ninety-six resources of which
eighty-eight are searchable is a different scope from one where all ninety-six
are, and what is contained but not searchable cannot be retrieved from at all.
The rule for combining is the scope plus whatever the request adds, with project
membership enforced after the union rather than being one of the parts of it;
changing what this agent can look up means editing the persona, not switching it
off for one turn. Portability arrives shut, being only a question for a persona
that runs elsewhere.

This is retrievable material, never prompt material. Nothing in the Context is
pasted into a call; it is what the retrieval tools are bounded by.

Deliberately not doing: a rule like "everything in this project" resolves
wherever a persona runs, but named resources and named project Contexts do not
travel, and the editor blocks them until cross-project binding exists — which
makes a persona available everywhere materially more limited than one that is
not.

Routes to `context-editor.context`; breadcrumb back to `agents.persona`.

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

**Nothing writes.** Ten panels, twelve editable values between them, and every
one is held where it was typed. The two controls that do anything at all are Run
again, which evaluates and stores nothing, and the deck's re-frame, which is
staged, confirmed, and then held like everything else.

**Nothing counts what has not happened.** No overview shows a trend, a history or
a series: the analysis has its most recent run, the Context has its most recent
resolve, the project has the newest recorded event standing in for an updated
stamp, and the Agents panel has right now. Each says so where it says the number.

Nothing writes back. A name, a section's text, a tool switch, a model choice, a
schedule time, a task setting, a trigger choice: every one is held in the panel
and every one says so. That is deliberate, and the alternative it is chosen over
is an edit that appeared to take and silently vanished on the next read.

Nothing reaches a running agent. No stop, no steer, no retry, and no dispatch
except Run now against a saved rule. Where a control for one of those would go,
there is either a disabled button whose title names the missing capability, or
nothing at all where a disabled button would have promised something.

Nothing is deleted, and the reason is the same in both places it comes up: past
work is attributed by name, and there is no tombstone policy that would keep
those labels readable.

There is no run history. The last fire is the whole record and the count is
approximate, so no lens here can show a rule's behaviour over time, and none
pretends to.

A task's result has no accepted state and no promotion to press; the deeper trace
of a run lives in the Copilot's task lens rather than here.
