# 2026-07-26 — AI dock B2b-1: persona picker, Ask-only web toggle, honest context

Continues **B2b** (finishing the AI Agent dock after B2a un-mocked its chats/turns/tasks).
This slice adds the **persona picker**, promotes **live web** to a first-class bar
toggle, makes the **document** context toggle actually do something, and **badges the
context sources that do not reach the backend**. Attachments — the remaining B2b item —
are a separate follow-up (they are chat-scoped and behind Omega's `opts.Files` guard).

Contracts were confirmed against Omega source (`core/handlers/persona/persona.go`,
`core/capability/persona/persona.go`, `core/handlers/chat/chat.go`, `core/wiring/wiring.go`)
before wiring, per the "verify the shape at wiring time" rule.

## Persona client — read/list personas and set the requester's default

```ts
// systems/ai-agent/api.ts — Omega wraps a persona as Record = { persona, version }.
type OmegaPersonaRecord = { persona: { id: string; name: string; description: string } };

export async function listPersonas(): Promise<AiPersona[]> {
  const res = await api<{ personas: OmegaPersonaRecord[] }>('/personas');
  return (res.personas ?? []).map(toAiPersona);
}
export async function getDefaultPersona(): Promise<AiPersona> {
  return toAiPersona(await api<OmegaPersonaRecord>('/personas/default'));
}
export async function setDefaultPersona(personaId: string): Promise<AiPersona> {
  const rec = await api<OmegaPersonaRecord>('/personas/default', {
    method: 'PUT',
    body: JSON.stringify({ personaId })
  });
  return toAiPersona(rec);
}
```

Omega resolves the agent persona **server-side from the requester's per-user/per-project
default** — there is no persona field on a chat or a turn (verified: `ChatReplyRequest`
carries none; `wiring.go` calls `personas.DefaultForUser(...)`). So the only lever the
dock has is `PUT /personas/default`. The picker therefore reads the current default
(`GET /personas/default`) and the full list (`GET /personas`, which always includes the
managed **General** persona), and writes the default on change. `AiPersona` keeps just
the identity fields (`id`/`name`/`description`); the nested version `Definition` is not
needed for a picker. `loadPersonas` is silent on failure because the persona routes are
gated on `opts.Personas != nil` server-side — a server without them 404s, and the picker
simply hides while Omega still applies its own default.

## Persona actions — load once per project, switch optimistically

```ts
// systems/ai-agent/actions.ts
export async function loadPersonas() {
  try {
    const [personas, current] = await Promise.all([listPersonas(), getDefaultPersona()]);
    aiAgent.update((s) => ({ ...s, personas, personaId: current.id }));
  } catch {
    aiAgent.update((s) => ({ ...s, personas: [], personaId: null }));
  }
}
export async function setAiPersona(personaId: string) {
  const prev = get(aiAgent).personaId;
  if (personaId === prev) return;
  aiAgent.update((s) => ({ ...s, personaId }));           // optimistic
  try {
    const updated = await setDefaultPersona(personaId);
    aiAgent.update((s) => ({ ...s, personaId: updated.id }));
  } catch (e) {
    aiAgent.update((s) => ({ ...s, personaId: prev }));    // revert
    toast(errorText(e, 'Could not switch persona'), { tone: 'danger' });
  }
}
```

`QuarterbackDock` (always mounted — it is the floating composer, present even when the
inspector panel is closed) triggers `loadPersonas` on project change, so the picker is
seeded regardless of panel state. The switch is optimistic with a revert-on-error toast,
matching the store's existing turn-send pattern. Because the default is a per-user
setting Omega applies going forward, changing it affects subsequent turns across chats —
the picker's `title` says "Default persona for new agent turns" to set that expectation.

## Live web promoted to a first-class, Ask-only bar toggle

```ts
// state: web left the context-source set and became its own flag
webEnabled: boolean;                       // types.ts / store.ts (default false)

// submitAiPrompt: never send the flag outside Ask (Plan/Action ignore it in Omega)
const web = get(aiAgent).webEnabled && mode === 'ask';
const result = await postTurn(chatId, clean, web);
```

Web was previously a checkbox buried in the context accordion whose value `postTurn`
happened to read. Omega's turn request has a real `web bool`, but tracing it through
`wiring.go` shows it only binds the `web.search` tool on the **Ask** branch (Plan and
Action ignore `IncludeWeb`), and only when a `WebRetriever` is configured. So web is
genuinely a per-turn Ask capability, not a context source. It now lives in the bar as a
dedicated toggle (`QuarterbackBar`'s `onwebchange`), disabled outside Ask with a tooltip
explaining why, and `submitAiPrompt` guards `&& mode === 'ask'` so the flag is never sent
where the backend would ignore it.

## The `document` toggle now gates chat pinning (was decorative)

```ts
// submitAiPrompt — before: always pinned s0.activeResourceId regardless of the toggle
const pin = s0.contextSourceIds.includes('document');
const resourceId = pin ? (s0.activeResourceId ?? undefined) : undefined;
const chat = await createChat(mode, resourceId, titleFrom(clean));
```

The `document` context toggle rendered a checkbox but did nothing — a new chat always
pinned the open resource. That is exactly the kind of decorative control the "nothing
hidden" principle rejects. It now actually gates whether the new chat pins the open
document (Omega scopes a chat to its `resourceId`), so the toggle is honest.

## Non-backable context sources badged; `web` removed from the set

```svelte
<!-- QuarterbackPanel.svelte — a Mock badge on every source that does not reach the backend -->
{@render contextSourceIcon(source.id)}
<span class="min-w-0 flex-1 truncate leading-tight">{source.label}</span>
{#if !source.wired}
  <MockBadge class="shrink-0 px-1 py-0 text-[10px] normal-case" />
{/if}
```

`AiContextSource` gained a `wired` flag; only `document` is `true`. `selection`,
`knowledge`, and `sources` are surfaced (so we do not forget to build them) but carry the
repo-standard **Mock** badge and a "Surfaced for review; not yet sent to the agent" hint,
because the chat/turn surface has no channel to send them. `web` was removed from the
context-source set entirely (it is the bar toggle now), which also let the panel drop its
`web` context-item branch and the now-unused `Globe2` import.

## Companions regenerated to a single full-source fence

```
# <intro, refreshed for B2b> …
## Complete implementation
```ts
<entire source file, verbatim>
```
```

The seven touched companions were rewritten to the intro-plus-single-fence format used by
the doc-model commits. The previous multi-section companions split the source across
several fenced blocks and dropped the blank lines that fall *between* blocks, so their
concatenation was not byte-for-byte per AGENTS.md Practice 1 (a latent drift). A single
full-source fence makes the union trivially exact; verified with an extract-and-compare
pass. `QuarterbackBar.svelte` lives under `src/lib/components/` and is companion-exempt.

## Verification

- `pnpm check` — 0 errors. `pnpm test` — 257 passed (254 + 3 new persona-client tests).
- Persona/web/attachment contracts confirmed against Omega source before wiring.
- Companions byte-verified (extract-and-compare) for all seven touched sources.
- Live UI E2E pending (no headless Chrome here); logic covered by unit tests and the
  Omega contract match. To try it: open the dock on `:5173`, pick a persona, toggle **Web**
  in Ask mode, and note the **Mock** badges on selection/knowledge/sources.
