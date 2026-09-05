# Research — panels

Anchored to the question you just asked. The answer sits beside what it produced;
earlier turns are history rather than a scrollback you live in.

**A research tab is one thread.** A line of enquiry is opened, worked in and
closed, so it is keyed by the thread's own id exactly as a document tab is keyed
by the document — several threads are open at once in the frame's strip, and
closing one closes a tab. `view.open({ screen: "research", resourceId: threadId })`
is how you get here.

The Copilot's composer is disabled here. This screen is already a conversation
with an agent, and a second composer would be two ways to say the same thing.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/research.md) | The thread: what it is for, who is asking, what it can see, what it has produced | This thread · Asking · Looking in · Produced · Attribution |
| [History](../../context/research/history.md) | Earlier turns in this thread, and the other threads in the project | This thread · Other threads |
| [Inquiry](../../context/research/inquiry.md) | The questions and ideas this project is working on | Questions · Hypotheses |
| [Findings](../../context/research/findings.md) | What this turn proposed, what this thread has accepted, and what the project already knows | Proposed here · Accepted in this thread · Elsewhere in the project |
| [Sources](../../context/research/sources.md) | What has been read, for this turn and across the thread | This turn · Whole thread |
| [Trace](../../context/research/trace.md) | How the answers were arrived at | One section per turn |
| [Context](../../context/research/context.md) | What this thread can search, and what that actually resolved to | This thread searches · Resolution · Warning |
| [Threads](../../context/library/threads.md) | Every line of enquiry in the project | Open · Answered |

**Overview leads.** The tab was opened onto this line of enquiry, so landing on
the list of every other one would be the map arriving before the territory.

**Threads is last, for the same reason it is here at all.** It is the map onto
the threads that do not have a tab yet, and getting to a different thread is a
thing you do after this one rather than instead of it. Choosing a row mints or
activates that thread's tab.

History and Trace answer the two questions the centre deliberately does not.
The centre holds one turn, so the earlier turns are History; the answer carries
its trace under *How it was produced*, and Trace is the same machinery for every
turn at once.

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A proposed finding | A conclusion offered for acceptance, still editable | [proposed-finding.md](../../inspector/research/proposed-finding.md) |
| An accepted finding | A conclusion in the lattice, retrievable project-wide | [accepted-finding.md](../../inspector/research/accepted-finding.md) |
| A source | Something that was read, and the passage that mattered | [source.md](../../inspector/research/source.md) |
| A tool call | One step the agent took | [tool-call.md](../../inspector/research/tool-call.md) |
| A question | One question and what bears on it | [question.md](../../inspector/research/question.md) |
| A hypothesis | One idea being tested, and the evidence either way | [hypothesis.md](../../inspector/research/hypothesis.md) |
| A thread | The thread itself: its agent, its scope, its mode | [thread.md](../../inspector/research/thread.md) |
| A Research row, from outside this screen | A thread, and the way into its tab | [research-thread.md](../../inspector/research/research-thread.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| The only one | One thread: the turn you are on, and what it produced | [workspace.md](workspace.md) |

## The rules this screen keeps

**A finding is a conclusion, not a quotation.** It can come from any search, web
or lattice. Accepting one writes it into the project; it is not a passage you
copied.

**Assessment is a human judgment.** A hypothesis is never scored by tallying
supporting and contradicting findings.

**The agent and the scope are set once, for the thread.** There is no per-turn
persona switch and no per-turn scope switch.

**A thread is a tab, and the screen has no strip of its own.** Which threads are
open is the frame's answer, and one screen does not get a second one.

**Answering a child question does not answer its parent.**
