# Research Thread Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`research-thread.ts`](research-thread.ts) | `researchThreadModeValidator`, `ResearchThreadMode`, `ResearchAnchor`, `ResearchThread`, `ResearchThreadDraft`, `researchThreadTitle`, `researchThreadAnchor` |

## The mode validator is the model

`schema.ts` imports it and so does the deployment door, which makes the column's
three values and the door's refusal of a fourth the same statement.

## `researchThreadAnchor` states the rule the schema cannot

`v.optional(v.id("questions"))` says an anchor may be absent. What it cannot say
is *when* — that a `question` thread has one and a `discover` thread has none —
because that is a constraint between the mode and two other fields.

**The unnamed side is refused rather than dropped.** Dropping it would store a
thread about something other than what the caller said, quietly.

**A `discover` thread with no anchor is legal and a `discover` thread with one is
not.** That is the asymmetry worth reading twice: `discover` is looking for
things, so an anchor on it would be a second statement about what the thread is
about, free to disagree with `mode`.

## `ResearchThread` is not the row

It carries `id`, drops `projectId`, and keeps `revision` — a client cannot send
back a revision it was never given. It adds nothing about the conversation,
because turns are `messages.list(("research", id))`, which needs nothing from
here.
