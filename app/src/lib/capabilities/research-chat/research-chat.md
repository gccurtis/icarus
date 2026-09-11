# Research chat

A chat is a research thread. A turn is a question, the answer to it, and the
record of how the answer was reached.

## What it is for

Seven procedures: the project's chats, one chat in full, a new chat, persona
selection, a question, stopping its active turn, and removal. `ask` is the whole
feature — it appends the question, brings the project's semantic overlay up to
date, runs one bounded agent loop over the project's own material, and writes
the answer and its turn together.

## Why a turn is a row

A message carries what was said. A turn carries what the run did: the searches,
the sources, the findings, the model and what it cost. Those are facts about a
run, not about a sentence, and a message has nowhere honest to keep them.

## What the model may reach

Four tools, built for one turn and closed over its scope: search the written
material, search the tables and charts and images, read a stretch of one
resource exactly, and list what the project holds. None of them is a toggle — a
chat that cannot read the project is not a chat about the project. Reach beyond
the project is a person's choice and does not live here yet.

Sources are issued by the tools, never named by the model. Citation IDs that
were not issued are discarded. When an otherwise answered decision omits
citations after passages were issued, one bounded repair pass asks only for the
missing provenance; if it still supplies none, the prose remains published with
an empty source list rather than acquiring invented evidence.

A persona attached to a chat is admitted against the complete current persona
shape before a turn opens. If its definition, tools, revision, or other required
state is malformed, `ask` reports the persona unavailable and writes no prompt
or turn; it does not silently grant an empty or default tool set.

Before the agent starts, current documents, presentations and spreadsheets are pulled
through the semantic queues to a stable boundary. A resource that exhausts its
own indexing retries is isolated and logged for project-wide questions, so it
does not prevent questions from running against every healthy resource. When a
turn explicitly selects that failed resource, the turn fails instead of
pretending the requested source had nothing to say. A queue that remains
unsettled after the bounded drain still fails the turn, because answering while
the searchable view is moving would make the result timing-dependent.

## Boundary

This capability owns chats, turns and the loop that fills them. It does not own
the overlay it reads, the intelligence it calls, or the surfaces that show them.
Process-local controllers, stopping flags and deadline timers belong to
`ServerModel.operationFlights`. A first stop asks the active turn to answer; a
second stop aborts it. The same flight signal owns overlay preparation, queue
draining, retrieval embeddings, exact native reads, and every tool boundary;
none of those may outlive the turn after a deadline, cancellation, or shutdown.
Server shutdown aborts and releases every active turn, while durable recovery
continues to use the turn rows.
