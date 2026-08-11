# Backend request — let a chat turn carry caller-supplied context items

**Priority:** **High** · **Status:** Open · **Filed:** 2026-07-28
**Blocks:** the front end sending the document the user is looking at with their question —
the smaller half of the broken Quarterback loop, and the half that puts context back under
client control.

> **Standalone.** Everything needed to build this is in this document: what already exists in
> your own Ask engine, the exact gap at the HTTP edge, the shape we need, the rules, and how
> we will verify it.

Alpha's Quarterback dock has a context picker (the open document, the current selection, other
project resources). **None of it can reach the backend**, because the chat-turn endpoint
accepts no context — so the toggles are badged as not-yet-applied and the user's "ask about
this document" answers *"there is no available evidence."*

The capability already exists one layer in. This is a plumbing ask, not a design ask.

## What already works

`agent.AskRequest` **already has the field and the rules**:

```go
// ContextItem is caller-provided, untrusted material that may help answer the
// question (for example an eventual Workspace selection). It is encoded as
// source material, never promoted into the system instruction.
type ContextItem struct {
    Label   string `json:"label"`
    Content string `json:"content"`
}
```

- Bounds are enforced and tested: ≤16KB per item, ≤32KB total, label and content both
  required (`contextMessage`, `maxContextItemBytes` / `maxContextBytes`).
- It is injected as a **user** message prefixed *"Caller-supplied context (untrusted source
  material)"* — never merged into the persona/system instruction. Exactly the right posture
  for client-supplied text.
- `Workflows.CreatePlan` / `CreateAction` already take the same `[]ContextItem`, so Plan and
  Action turns get this for free.
- Chat attachments already flow through this path (`chatEngine.attachmentContext`) — proving
  the wiring end-to-end.

The comment on `ContextItem` even anticipates this use ("for example an eventual Workspace
selection").

## The gap

The client cannot supply any. The chain drops the field at the HTTP edge:

| Layer | Carries context? |
| --- | --- |
| `POST /agent/chats/:id/turns` body | **No** — accepts only `{message, web}` |
| `chat.ChatReplyRequest` | **No** context field at all |
| `chatEngine.Reply` | Builds items **only** from the chat's attachments |
| `agent.AskRequest.Context` | Yes — but nothing client-driven ever reaches it |

So the only way for a user's own content to become context today is to upload it as a chat
attachment, which is a persisted file on the conversation — the wrong shape for "the document
I am looking at right now."

## What we need

An optional `context` array on the turn request, threaded through to the existing field.

```jsonc
POST /agent/chats/:chatID/turns
{
  "message": "What is the launch code?",
  "web": false,
  "context": [                                  // optional; omitted = today's behavior
    { "label": "Launch notes (document)", "content": "The launch code … is INDIGO-7." }
  ]
}
```

- **Optional.** Omitting it must behave exactly as today.
- **Additive to attachments**, not replacing them: the engine appends the request's items to
  the attachment-derived ones (attachments first is fine).
- **Same validation, same limits** — reuse `contextMessage`'s existing checks. A too-large or
  malformed item should be a **400 with a clear message**, not a silent truncation, so the
  client can tell the user their document is too big to send inline.
- **Applies to all three modes.** Ask passes it in `AskRequest`; Plan/Action pass it to
  `CreatePlan`/`CreateAction`, which already accept items.
- No persistence needed — per-turn and transient, like `web`.

## The rules that matter

- Context items stay **untrusted source material**. Do not promote them into the system
  instruction or the persona, and do not let them become citeable Project evidence (they are
  not retrieved spans). Today's `contextMessage` posture is exactly right — keep it.
- Authorization is unchanged: the caller may only send content it already has, and the turn
  is already project-scoped by the session.
- The 32KB total is a real ceiling for us. We would rather get a **400 we can surface** than a
  server-side trim that silently drops half a document.

## How we will verify

1. Post a turn with a `context` item containing a distinctive fact and ask about it → the
   answer uses the fact (no lattice ingestion involved).
2. Post the same turn **without** `context` → the answer reports insufficient evidence
   (proving the item, not the model's memory, carried it).
3. Post with a 40KB item → **400**, with a message naming the limit.
4. Post with `context` on a Plan turn → the spawned task's prompt shows the item.
5. Attachments plus `context` in one turn → both are present.

## Current front-end fallback

None — the toggles are honestly badged as not applied. Once this lands, Alpha sends the open
document (and later the selection) with each turn, and the picker becomes real.

## How this relates to the other request

This request covers **"the thing I am looking at"** — client-chosen, per-turn, exact.
[Automatic knowledge ingestion](document-knowledge-ingestion.md) covers **"everything in the
project"** — server-side retrieval over content the browser does not have and could never fit
in 32KB. They are complementary, and the product wants both: project-wide grounding as the
default, with the open document always sent explicitly. **This one is much smaller — if only
one ships first, we want this one.**
