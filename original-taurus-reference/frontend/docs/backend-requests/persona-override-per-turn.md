# Backend request — per-**turn** persona override

**Priority:** Medium · **Status:** Open, **narrowed 2026-07-28** · **Filed:** 2026-07-27
**Blocks:** letting a user pick a persona for *one message* without permanently changing the
chat's persona.

> **The per-TASK half of this request was already shipped — and Alpha already uses it.**
> An audit against Omega's source on 2026-07-28 found that `POST /agent/plans` and
> `POST /agent/actions` accept `persona: {personaId, personaVersion}`, resolve it to an
> immutable snapshot stored on the task, return it from `GET /agent/tasks/:id`, and reuse it on
> retry — so "a task keeps its persona for its whole life" holds by construction. Alpha posts
> exactly that shape from `src/lib/systems/documents/ai-tasks.ts`. **Do not build §3.3.**
>
> Two small divergences from what §3.3 originally asked, both fine as-is: the field is nested
> (`persona: {personaId}`) rather than a top-level `personaId`, and it is **required** — an
> empty id is a 400 rather than an inherit. If making it optional-with-inherit is cheap, we
> would take it; it is not blocking anything.
>
> **What remains is §3.1 (a persona on a chat turn) and §3.2 (recording which persona
> answered).** The plumbing below the HTTP edge is already right: the chat engine resolves
> `ChatReplyRequest.PersonaID` or falls back to the requester's default, so a per-turn id only
> has to be threaded into that field. Note the turn handler today binds only `{message, web}`,
> and `chat.Turn` has no persona field at all.

> **Standalone.** Everything needed to build this is in this document: what exists today,
> what we need, the exact request/response shapes, the rules, and how we will verify it.
> No other Alpha document needs to be read.

---

## 1. What already works (do not rebuild)

Per-**chat** persona shipped and Alpha uses it in production:

| Route | Behaviour |
|---|---|
| `POST /agent/chats` | Creates a chat. Accepts an optional `personaId`. |
| `PATCH /agent/chats/:chatID/persona` | Sets the chat's persona. Body `{ "personaId": "..." }`. |
| `GET /agent/chats/:chatID` | Returns the chat including its `personaId`. |

A turn posted to a chat runs under that chat's persona, and a task spawned from a turn
inherits it. That is the right default and should stay the default.

## 2. The gap

**A persona choice is currently permanent and chat-wide.** There is no way to say "answer
*this one* message as the Editor" or "run *this* task as the Researcher" without mutating
the chat, which changes every subsequent turn too.

Concretely, Alpha's composer has a persona picker. Today, changing it rewrites the whole
chat's persona — so a user who wants one Editor reply and then a normal one has to switch
twice and has silently changed the chat's history-forward behaviour in between.

This also blocks the natural product shape for tasks: a **task is a unit of delegated work**,
and which agent does it is a property of *that work*, not of the conversation it came from.

## 3. What we need

### 3.1 Per-turn override

`POST /agent/chats/:chatID/turns` accepts an **optional** `personaId`:

```jsonc
// POST /agent/chats/:chatID/turns
{
  "text": "Tighten this paragraph.",
  "mode": "ask",             // existing field
  "personaId": "psn_editor"  // NEW, optional
}
```

Rules:

- **Omitted or empty → the chat's persona.** Exactly today's behaviour. This must not change.
- **Present → that persona answers this turn only.** The chat's stored `personaId` is
  **not** modified.
- **Unknown / not-visible persona id → `400`**, with the usual `{"error": "..."}` body.
  Do not silently fall back, or a typo becomes an invisible wrong-agent answer.

### 3.2 The turn records which persona actually answered

Every turn in `GET /agent/chats/:chatID` should carry the persona that produced it:

```jsonc
{
  "id": "trn_...",
  "role": "agent",
  "text": "...",
  "personaId": "psn_editor",     // NEW — resolved, never empty on an agent turn
  "createdAt": "..."
}
```

**Resolved, not echoed:** if the turn used the chat default, this is the chat's persona id,
not `""`. Alpha renders "answered by X" per turn, and a transcript where some turns say who
answered and others don't is worse than none.

A `user` turn may carry the `personaId` it *requested* (useful for replay); if that is
awkward, omitting it on user turns is acceptable — say which you chose.

### 3.3 Per-task override — ✅ ALREADY SHIPPED, do not build (see the note at the top)

The same option on the two task-creating routes:

```jsonc
// POST /agent/actions   and   POST /agent/plans
{
  "instruction": "Check every citation resolves.",
  "personaId": "psn_researcher"   // NEW, optional
}
```

Rules mirror 3.1: omitted → inherit (from the originating chat if there is one, else the
requester's default); present → that persona runs the task; unknown → `400`.

And `GET /agent/tasks/:taskID` (and the task shape in `GET /agent/tasks`) should return the
resolved `personaId`, for the same reason as 3.2 — the task card names its agent.

## 4. Rules that matter to us

- **Nothing is retroactive.** An override changes one turn or one task. Re-reading a chat
  must never show a past turn re-attributed.
- **Authorization is unchanged** — the persona must be one the caller could already select
  (same visibility rule as `PATCH .../persona`). This adds no new access path.
- **A task keeps its persona for its whole life**, including retries. If a task is retried
  after the chat's persona changed, it must still run as the persona it was created with.

## 5. How we will verify

1. `POST` a turn with no `personaId` → answered by the chat's persona; the chat's
   `personaId` is unchanged. *(Regression: today's behaviour.)*
2. `POST` a turn with a different `personaId` → that persona answers; `GET` the chat and
   confirm its stored `personaId` is **still the original**.
3. `GET` the chat → the agent turn carries a resolved, non-empty `personaId`.
4. `POST /agent/actions` with `personaId` → `GET /agent/tasks/:id` reports it.
5. Unknown persona id on either route → `400`, and no turn/task is created.

## 6. Why we are not building this on the client

Alpha could fake it by PATCHing the chat's persona, posting the turn, and PATCHing back.
We deliberately will not: it is a lost-update race with any concurrent turn, it writes two
extra mutations per message, and it makes the chat's persona briefly wrong for anyone else
reading it. The override belongs on the request that uses it.

## 7. Current front-end fallback

The composer's persona picker sets the **chat** persona (`PATCH .../persona`) and we
document it as chat-wide. There is no per-turn or per-task control in the UI until this
lands; we would rather ship no control than one that silently mutates the conversation.
