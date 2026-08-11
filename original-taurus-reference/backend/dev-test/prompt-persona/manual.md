# Manual test: prompt-block personas

This is the by-hand version of [`run.sh`](run.sh). A prompt block can select a
project-local **persona** (`set_block_persona`); the persona's instructions
overlay the resolution's plan and synthesis system messages, so the same prompt
over the same evidence produces differently-shaped output under different
personas — the same persona overlay a [chat](../chats/manual.md) turn applies.

## Why this suite needs a real key

A persona only shows its effect in generated text, so it can only be judged
against a real model. Without a key the automated [`run.sh`](run.sh) **skips**.
Model-backed behavior is never asserted with a stubbed model.

## What it exercises

Two personas differ only in a checkable format directive — one writes in ALL
CAPS, the other in all lowercase — chosen because case is deterministically
assertable and does not conflict with the synthesis prompt's "answer only from
the evidence" rule. The suite:

1. Indexes a grounding source and creates a prompt block over it.
2. `set_block_persona` to the caps persona, resolves → the answer is uppercase.
3. `set_block_persona` to the lowercase persona → asserts the op cleared
   `resolvedAt`, then refresh re-resolves and the answer flips to lowercase.

The case flip proves the selected persona actually shaped generation. The suite
reports its token cost via `usage_summary`.

## By hand

Sign in and select a project. Index a source with
`POST /dev/knowledge/documents/:id`. Create two personas with
`POST /personas` (distinct `definition.behavioralGuidance`). Create a document
with a prompt block, then pin a persona with a `set_block_persona` op
(`{"op":"set_block_persona","blockId":"pb","blockPersona":{"id":"<personaId>","version":0}}`,
version 0 = current), resolve via `POST /documents/:id/blocks/:block/resolve`,
and read the answer from the block's `data.lastOutput`. Switch the persona and
refresh to see the output change.

Per-conversation chat personas (the parity feature) use the same persona
machinery via `PATCH /agent/chats/:id/persona`; they are exercised in the live
[chat](../chats/manual.md) flow.
