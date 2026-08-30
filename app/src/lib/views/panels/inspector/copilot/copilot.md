# Copilot

## What the subject is

The Copilot rises out of the middle of the status bar and takes the inspector
over while it is open. These four panels are what it shows there. Together they
answer *what is being done for me right now, what have I asked, and what will the
agent be able to see when I ask next*. Home is the list; Conversation and Task
are the two kinds of thing in that list; What it can see is the scope the
composer opens before a request goes out.

The Task panel is the centre of the subject, and the thing to understand first: a
task is the unit of agent work and its own whole trace, so there is **one task
lens reached from four places** — the Copilot, Project Overview, a Persona's Work
view, and an Automation's last fire. Only where it was reached from varies. That
sets the breadcrumb, and it drops the Agent row where the trail already names the
persona: reached from a Persona the trail reads *Grid Analyst › Summarise
overnight outage reports*, and a row repeating the agent's name under it would be
saying it twice. There is no second copy of this lens, and building one per
entrance is exactly the mistake the single `from` exists to prevent.

The Agents inspector holds a shorter read of a task — enough to decide whether to
go and look, with a way into the centre. The plan, the tool calls and what the
run produced are this lens's, not that one's.

## Copilot home

Everything in flight and everything recent, in one list. This is what the
inspector shows until something inside it is picked.

Five bands, ordered by what needs you rather than by time: Waiting, Not working,
Running, Recent conversations, Done. Done arrives shut, because finished work is
reference rather than attention. Every state is carried by an icon *and* by the
words on the row, never by colour alone. A done row carries no agent line:
finished work says what it was and when, and nothing about who is still on it.

The search contains the bands rather than sitting above them, so what it filters
is answered by the layout: all five are inside it. A band that matches nothing
while a query is typed goes quiet rather than repeating the panel's own message
about nothing matching, and each band's own sentence for being empty — nothing is
waiting on you, you have not talked to an agent here yet — appears only when
nothing is being searched for.

Routes to `copilot.task` and `copilot.conversation`.

## Task

What was asked, who is doing it, the plan, and where it has got to. One lens,
four entrances, as above.

The title is not repeated as a field: it is the panel's heading, directly above
the block that would have restated it. The state is a word with at most one
phrase after it — the reason when it failed, the result when it is done, and
nothing at all while it runs, because the step count belongs to the progress bar
and saying it twice makes two claims to keep in step. Who started it is drawn as
an actor of whatever kind started it — a person, an Automation, another agent —
and opens the matching lens; one with no id is drawn flat, having nowhere to go.

The bands, in order: progress as step so-many of so-many; Asked to, quoted, with
the instruction immutable, because changing what was asked means a new task;
Plan, which is the progress bar spelled out, every step with its own state in
words and icon; Tools used, shut, being the trace rather than the answer, where a
successful call is shown as its result and anything else leads with the outcome
because that is the news; and Produced, shut.

Follow is local and only local — nothing records who is following a task. Cancel
is disabled when the task has already stopped and also when whoever mounted the
lens has no way to stop it, and its title says which of the two it is. Retry is
absent rather than disabled: retry semantics are not modelled, and a button that
might re-run a partly-completed task is worse than no button.

Deliberately not doing: a task result is not a resource — nothing in the project
can retrieve it until it is promoted into a finding, a document, a deck or a
spreadsheet — and there is no promotion here to press, because a task records
what it produced and nothing records how to promote it.

Routes to `agents.persona`, `collaboration.person`, `agents.automation`,
`project.project`, `copilot.home`, and `project.resource` for an output that has
already been promoted.

## Conversation

One thread with one agent, summarised enough to decide whether to go back into
it.

A summary and a way back in, not a transcript. Latest is one message, because the
last thing said is what tells you whether this is the thread you meant, and
anything more here is the composer redrawn badly at panel width. Above it, the
agent as a face that opens its profile, the number of turns, when it started and
when it was last active. The quoted message names its author rather than linking
to them: a message carries a name and a time, and no id to open a lens with.

Continue and Start a task from this sit in the actions row under the title, where
a control is found. Both are handed in from outside and are disabled until
whoever mounted the panel says what they mean: reopening a thread in the composer
and handing a thread to the task machinery are not things a lens can do on its
own.

Deliberately not doing: what a task inherits from the conversation it came from
is undefined. The prompt, the scope and the history are three different answers.

Routes to `agents.persona` and `copilot.home`.

## What it can see

Everything this request will be able to look up, and where each part came from.

Three sources, kept in three lists rather than merged into one, because they are
revoked in three different ways and an id from one is not interchangeable with an
id from another: what the screen offers, what you pick, and what the persona
always has.

Suggested comes from whichever screen is asking — that screen supplies its own
suggestions and the Copilot does not guess. Suggested is not attached: nothing is
in scope until it is added, so every offered row says which it is in words rather
than leaving the reader to interpret a tick. Between Suggested and Saved
Contexts sits a search that contains only what it searches, for adding one
resource to this request alone, which saves no Context. Saved Contexts follow,
where a Context matching nothing is offered *blocked* rather than offered, since
it would broaden retrieval to the whole project. The agent's own scope is last
before the total, as a locked row with no toggle: fixed is a state, not an option
left unticked, and switching it off means editing the persona rather than
switching part of it off for one turn. Altogether gives the resolved total, and
says membership is always enforced and never one of the parts.

Back and Done are in the actions row rather than pinned at the foot. A control
pinned below a list of unbounded length is a control nobody scrolls to.

Deliberately not doing, twice. A Context that matches nothing stays blocked until
an explicit-empty scope is distinguishable from an absent one. And these choices
are draft state only: nothing stores a request's scope, so reopening an old turn
cannot show what it could see at the time — and the total shown is the union the
model resolves, which a pick here cannot yet move.

Routes to `copilot.home`.

## What is not here

There is no transcript and no composer in this stack. It summarises, and hands
back to the surface that does the talking; both of the Conversation panel's
actions are supplied from outside for exactly that reason.

Nothing here starts, stops or retries work on its own. Cancel exists only where
whoever mounted the task lens can stop the task, retry is absent on purpose, and
nothing dispatches.

Nothing persists what happens in these panels. Following a task is remembered
nowhere, a request's scope is remembered nowhere, and a task's output stays an
output until something outside promotes it.
