# Persona-aware prompt blocks, and per-conversation persona for chat

A prompt block's resolution and a chat conversation can each run under a
selected project-local persona — the same persona machinery, applied
consistently to both surfaces. Prompt-block resolution previously ignored
persona entirely while chat only ever applied the requester's *default*; this
gives both an explicit selection.

## Prompt blocks (Part A)

- **`PromptData.Persona *PersonaRef{ID, Version}`** — a block selects a persona
  (nil = no overlay). Deep-cloned with the block.
- **`set_block_persona` op** across the full changeset lifecycle: validate (block
  id present; a present ref names a persona, version ≥ 0), apply (prompt-block
  only; set/clear persona and clear `ResolvedAt` so a refresh re-resolves),
  inverse (restore prior data via `resolve_block`, since persona and `ResolvedAt`
  both live in `PromptData`), rebase footprint (grouped with `set_prompt`:
  `block-data`), history (`BlockID` recorded generically).
- **`PersonaResolver` port** — `PersonaInstructions(projectID, ref) (string, error)`.
  `ResolveBlock` overlays the returned text onto the plan and synthesis system
  messages (`withPersonaSystem`: persona first, then the step's own system
  prompt), exactly how a chat turn / agent ask applies its persona.
- **Decoupling:** `document` carries only `PersonaRef` and gets *text* back
  through the port — the same way it stays free of `knowledge` behind `Retriever`.
  The wiring adapter `documentPersonaResolver` resolves the persona snapshot and
  composes instructions the way the agent runner does. Nil resolver / nil ref =
  no overlay (unchanged behavior).

## Chat (Part B)

- **`Chat.PersonaID`** — a conversation pins a persona (empty = requester
  default), set via `PATCH /agent/chats/:chatID/persona` → `Chats.SetPersona`.
  Persisted in both stores (SQLite `agent_chats.persona_id`, additive migration).
- The chat engine adapter resolves the pinned persona by id (version 0 = its
  current version) and runs the turn under it, falling back to `DefaultForUser`
  when unset. `chat` still imports no persona types — the selection is a bare id
  threaded through `ChatReplyRequest`, resolved in wiring.

## Verification

- Unit (`core/capability/document`): persona deep-clones; `set_block_persona`
  validates, applies (persona set/cleared, `ResolvedAt` cleared, input untouched),
  inverts (prior persona + `ResolvedAt` restored), and rejects non-prompt/unknown
  blocks; `ResolveBlock` calls the resolver with the block's ref and overlays the
  text on both system messages, and does neither without a persona. `-race` clean.
- Unit (`core/capability/chat`): `SetPersona` persists and flows to the engine;
  cross-project set is rejected; clearing reverts to default. SQLite + transport
  suites green.
- Live: `dev-test/context-scope` already exercises resource-bound variables
  (documents + connectors); a persona's effect on generated output is best judged
  live and is left to the end-to-end demo (Slice I).

## Settled

- Prompt blocks and chat conversations both select a persona explicitly; both
  fall back to no-overlay / requester-default when unset. ✓
- `document` and `chat` stay decoupled from `persona` (bare ref + port / bare id
  + wiring resolution). ✓
