# prompt-persona — what the suite does

Source: [dev-test/prompt-persona/run.sh](../../../../dev-test/prompt-persona/run.sh)

A prompt block can select a project-local persona, and that persona's
instructions overlay the resolution's system messages. This suite proves the
overlay actually reaches generation: the same prompt, over the same evidence,
produces differently-shaped output under two different personas.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Persona Project", and
select it into the session. Window geometry narrowed to 200 runes with 40 of
overlap.

## Step 1 — a grounding source

A document is created and indexed:

> The Eiffel Tower is 300 meters tall and stands on the Champ de Mars in Paris.

Resolution needs evidence to answer from; without it the block would come back
`insufficient` and there would be no output to inspect for persona shape.

**Model calls:** one embedding per window.

## Step 2 — two personas that differ in exactly one checkable way

| Persona | Behavioural guidance |
| --- | --- |
| Shouter | Formatting rule that overrides all other style guidance: write your entire response in ALL UPPERCASE LETTERS. |
| Whisperer | Formatting rule that overrides all other style guidance: write your entire response in all lowercase letters. |

The choice of directive is the design of the test. Letter case is
deterministically checkable — no judgement call about whether output "feels" more
formal — and, critically, it does not fight the synthesis prompt. A persona that
told the model to be more speculative or to add outside context would be in
direct conflict with "answer only from the evidence", and a failure could not be
attributed to either one.

## Step 3 — a report over the source

A document "Report" holds one prompt block `pb`:

> Describe the Eiffel Tower using the sources: its height and where it stands.

## Step 4 — resolve under the ALL CAPS persona

`set_block_persona` pins `pb` to the Shouter at the document's current revision
(version 0 means "the persona's current version"). The block resolves in `reload`
mode.

- Asserts the block's status is `ok`
- Asserts the answer contains letters and none of them are lowercase

Digits and punctuation are ignored by the check — only letter case is judged.

**Model calls:** a plan call, an embedding per query, then a synthesis call.

## Step 5 — switch personas and refresh

`set_block_persona` pins `pb` to the Whisperer.

- Asserts the operation cleared `ResolvedAt`

A persona change has to invalidate the previous resolution, exactly as a scope
change does. Without it, `refresh` would see a resolved block and skip the work,
and the output would still be in caps while the block claimed the new persona.

(A cleared timestamp is Go's zero time, which serializes as `0001-01-01…` rather
than being omitted, so "cleared" means absent **or** the zero time.)

The block is then resolved in `refresh` mode.

- Asserts the status is `ok`
- Asserts the answer contains letters and none of them are uppercase

## What the pair proves that neither half would

One resolution in caps proves only that a model followed an instruction. The flip
is what proves the persona is bound to the block and re-read on each resolution —
that the second answer came out lowercase because the binding changed, not
because the first one happened to.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Block plan | steps 4 and 5 |
| Block synthesis | the same steps, immediately after each plan |

The persona's behavioural guidance is not a separate prompt — it is prepended to
the synthesis system message, so the model sees the persona first and the
grounding rules after it.

## How to read a failure

- The `ResolvedAt` assertion failing means a persona change does not invalidate
  the resolution; the case assertion after it would then be measuring a stale
  answer.
- A case assertion failing while the status is `ok` means the persona did not
  reach generation — the block resolved correctly and ignored its persona.
- A status other than `ok` means the source was not retrieved, which is a
  grounding failure and has nothing to do with personas.
