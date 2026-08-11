# Backend request — unify chats & agentic work; personas on chats

**Priority:** High · **Status:** **Partially shipped** — per-chat persona has landed
(`Chat.personaId` + `PATCH /agent/chats/:id/persona`) and the Alpha dock wires it; the
task↔chat turn relay and a per-task persona override remain open.

Extends [`ai-agent.md`](ai-agent.md) (which asks for the chat/turn/task surface itself) with
the **model** that should sit under it. This is an architecture request, not just an endpoint
one: how chats, personas, and agent tasks relate.

## The model we want

**The chat is the always-on user-facing interface. The agentic endpoints are the layer
beneath it — "how the agent does things," not how it talks to the user.** They are not the
same surface, and they shouldn't be collapsed into one; but everything the user sees should
flow *through a chat*.

Concretely:

- **Every chat has a persona.** A chat is a conversation with a specific persona; the persona
  is a first-class property of the chat, chosen when the chat starts (default **General**) and
  changeable on the chat.
- **Actions and Plans happen *within* chats.** Asking, acting, and planning are all modes of a
  chat. When work needs a durable **task** (an Action or Plan), that task is **spawned from a
  chat** and stays addressable through it — the chat is where the user follows and steers it.
- **A spawned task's persona.** By default the task **adopts the chat's persona**; the user may
  instead **declare a specific persona** for that task. Either way, the task can still **speak
  back through the originating chat**.
- **The persona intermediates the agent.** The task/agent produces raw work and raw output on
  the execution side (the task queue). The **chat's persona reads that output and relays a
  user-facing version back into the chat as a turn.** The user converses with the persona; the
  persona is the interface to the machinery, not the machinery itself.

Omega owns the specifics of the task-queue → chat relay (how/when task output surfaces as
turns, buffering, etc.). This request states the model and the frontend contract we'd consume.

## Proposed API (Omega owns the final contract)

- **Persona on the chat — ✅ shipped.** A chat carries `personaId` (empty = the requester's
  default), returned by `GET /agent/chats/:id` and the list, and set via
  `PATCH /agent/chats/:id/persona { personaId }`. (Create does **not** take a persona — a new
  chat starts at the default and is PATCHed after.) The Alpha dock's picker now sets it per chat.
- **Task persona — partially shipped.** A spawned task inherits its **chat's** persona and
  `GET /agent/tasks/:id` exposes the resolved `persona`. Still open: a per-turn override —
  `POST …/turns` currently takes only `{ message, web }`, so a client can't declare a
  different persona for one task without changing the chat's.
- **Task → chat turns.** Task progress/output surfaces as **chat turns** attributed to the
  chat's persona (so polling a chat shows the persona's user-facing relay of task work), not
  only as raw task state the client must render separately. The turn keeps its `taskId` link.

## What it unblocks (front-end)

- A **per-chat persona picker** (the real model) instead of today's interim per-user-default
  picker — see the follow-up below.
- **Task ↔ chat as one thread:** a spawned Action/Plan is followed *inside its chat*, with the
  persona narrating progress, rather than a separate task card the user mentally reconciles.
- A coherent story for "the agent did something and told me about it" — the persona relay makes
  agent work legible without exposing raw task internals.

## Front-end follow-up

- **Done:** the AI dock's persona picker now drives **per-chat** persona via
  `PATCH /agent/chats/:id/persona` (with a pending pick applied to the chat the first turn
  creates), replacing the interim `PUT /personas/default` wiring.
- Render task progress as persona-attributed **turns in the conversation**, folding today's
  separate `activeTask` card into the chat thread (keep the plan-accept affordance).
- Allow declaring a task's persona at spawn time (default = the chat's).

## Related

- [`ai-agent.md`](ai-agent.md) — the chat/turn/task/persona surface this builds the model on.
- Interim state today: personas are a per-user default (`GET/PUT /personas/default`); the Alpha
  dock's persona picker sets that. Chats/turns/tasks are wired (B2a/B2b).
