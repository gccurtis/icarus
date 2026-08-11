# 2026-07-27 — Per-chat personas (AI dock)

Omega shipped per-chat personas (`Chat.personaId` + `PATCH /agent/chats/:id/persona`), so the
AI dock's persona picker moves from the interim per-user default (`PUT /personas/default`) to
**per chat**. Validated end-to-end in the browser against real Omega + real models.

## The client + store carry a chat persona

```ts
// api.ts — chats map personaId; new PATCH client
export async function setChatPersona(chatId: string, personaId: string): Promise<AiChat> {
  const res = await api<{ chat: OmegaChat }>(
    `/agent/chats/${encodeURIComponent(chatId)}/persona`,
    { method: 'PATCH', body: JSON.stringify({ personaId }) }
  );
  return toAiChat(res.chat);
}
// types.ts/store.ts — AiChat.personaId; state.defaultPersonaId (seed for new chats)
```

**Why:** a chat now owns its persona (empty = requester default); the dock must read it and be
able to set it. `defaultPersonaId` lets the picker seed a new chat and detect a non-default pick.

## The picker drives per-chat persona

```ts
// actions.ts
// setAiPersona: with a chat open, PATCH it; with none, hold a pending pick.
// submitAiPrompt: apply the pending (non-default) pick to the chat the first turn creates.
// selectAiChat: reflect the opened chat's persona. showAiChats: reset to the default.
```

The `QuarterbackBar` picker is relabeled "Persona for this chat". A spawned task inherits its
chat's persona (Omega has no per-turn override yet — noted in `chat-agent-unification.md`).

## loadPersonas hardened against a startup race

```ts
// The dock mounts before the project session finishes selecting, so the first load can race
// and fail; retry a few times before giving up. Also seed personaId only when unset, so a
// pending pre-send pick or an open chat's persona is never clobbered.
for (let attempt = 0; ; attempt++) { try { … return; } catch { if (attempt < 3) { await sleep(400); continue; } … return; } }
```

**Why:** browser testing showed the picker could vanish for a whole page load when the first
`loadPersonas` fired before the project was selected server-side (it ran once and never retried).
The retry makes the picker reliably appear for real users, not just the test.

## Tests

Unit: `api.test.ts` (personaId mapping + the PATCH), `store.test.ts` (pending pick applied on
create; no PATCH when the pick equals the default; open-chat PATCH). New e2e
`persona-and-surfaces.spec.ts` drives the real dock + real model: the picked persona lands on the
chat the first turn creates, and the model replies under it. `pnpm test` 284, `check` 0/0.
