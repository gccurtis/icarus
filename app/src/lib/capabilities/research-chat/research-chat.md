# Research chat

A chat is a research thread. A turn is a question, the answer to it, and the
record of how the answer was reached.

## What it is for

Five procedures: the project's chats, one chat in full, a new chat, a question,
and removal. `ask` is the whole feature — it appends the question, brings the
project's semantic overlay up to date, runs one bounded agent loop over the
project's own material, and writes the answer and its turn together.

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

Sources are issued by the tools, never named by the model. An answer citing an
id that was not issued is refused, and an answer that cites nothing is published
as insufficient rather than as prose.

## Boundary

This capability owns chats, turns and the loop that fills them. It does not own
the overlay it reads, the intelligence it calls, or the surfaces that show them.
Process-local controllers, stopping flags and deadline timers belong to
`ServerModel.operationFlights`. A first stop asks the active turn to answer; a
second stop aborts it. Server shutdown aborts and releases every active turn,
while durable recovery continues to use the turn rows.
