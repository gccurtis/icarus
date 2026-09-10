# Research

One conversation with the project, keyed by `resourceId`. A chat is opened,
worked in and closed exactly as a document is, which is why it is a tab rather
than a place.

| Content | Shows |
| --- | --- |
| [`thread.svelte`](content/thread.svelte) | One turn: the question, and the answer with the plane to fill |

The centre holds one turn, not a scrollback. Above the question sits the only
line of qualification it needs — how long ago, what it could see, which mode —
and everything below is the answer. The composer holds the foot, because this is
already a conversation with an agent and the category owns its input rather than
borrowing one from the shell.

A provider run may outlive the mounted centre when somebody changes tabs. On
each mount, the centre refreshes the open chat detail so the durable
queued/running turn becomes visible again. Usually this is one lifecycle read.
If the centre remounts while the same workspace-owned Send command is still
crossing the server boundary, a bounded backoff reconciles only until that
running row appears or the command settles, followed by one final read. Every
completion and failure is correlated with the still-mounted thread and query;
an old tab cannot mark a new tab refreshed or failed.

## Context

Two panels, both flat.

**Threads** is every chat in the project, newest first. **Turns** is the open
chat's questions, newest first; choosing one moves the centre and the lens to it.
Neither nests inside the other, because a nested list makes one panel answer two
questions and then explain which one it is answering.

Time is always how long ago. A question asked three days ago reads as three days
ago wherever it appears, and never as a clock time somebody has to subtract from.

Other keys stay in the workspace vocabulary and off the rail. There are more
panels to come, and a key retired today is a key added back next week.

## Inspector

One lens, always the current turn. Findings and sources, both open, and nothing
else: not the mode, not the duration, and not the question, which is already at
the top of the plane in larger type. What the turn searched is recorded on its
row; it is diagnostic rather than something a reader wants beside the answer.

## Modes

Explore, Question and Hypothesis are all in the composer's dropdown and only
Explore is wired. A disabled item with a reason is honest; a control that grows
new meanings later is not.

## Boundary

This category owns the surfaces and the words on them. The chats, the turns and
the loop that fills them belong to the `research-chat` capability; what the model
may read belongs to the semantic overlay; what an answer is made of is a
`ContentBlock`, which the content domain owns.
