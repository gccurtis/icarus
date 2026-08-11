# live-document — what the suite does

Source: [dev-test/live-document/run.sh](../../../../dev-test/live-document/run.sh)

The end-to-end demo: the whole program in one run against real models. It is the
suite that discriminates between models, because the rest of the test set passes
on the cheapest model available and therefore cannot rank anything above it.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Live Document", and
select it into the session. Every later call runs inside that project.

## Beat 1 — two connectors, two distinguishable sources

Two temp directories are created, each with a single `notes.txt`:

- **Finance**: `Q3 revenue was 4.2M, up 18% on new enterprise accounts.`
- **Trivia**: `The company mascot is a purple otter named Waffles.`

A local watcher is started over each directory, then a connector is created for
each, pointed at its watcher URL, and synced.

The two sources are deliberately unmistakable. Any later answer either mentions
revenue or an otter, so scoping can be judged from the text alone with no
ambiguity about which source produced it.

**Model calls:** one embedding per sync, admitting the file into the lattice.

## Beat 2 — a document that is mostly a prompt block

A document "Board update" is created with a `heading_1` and one prompt block
`pb1`, whose instruction is:

> State the single most notable fact from the sources, in one sentence.

Four change-set operations then configure it:

1. `set_template` — marks it a template with variables `finance` and `trivia`
2. `set_context_variable` — binds `finance` to the Finance connector
3. `set_context_variable` — binds `trivia` to the Trivia connector
4. `set_block_context` — scopes `pb1` to `{include: ["finance"]}`

**Model calls:** none. This beat is pure document mutation.

## Beat 3 — resolve, grounded in one source

`pb1` is resolved in `reload` mode and the job is polled to completion.

- Asserts the block text contains `4.2`
- Asserts it does **not** contain `otter`

**Model calls:** the prompt-block pair — a plan call that turns the instruction
into retrieval queries, then a synthesis call that writes the answer from the
retrieved evidence. Plus an embedding for each retrieval query.

## Beat 3b — swap the variable, the output flips

`set_block_context` re-scopes `pb1` to `{include: ["trivia"]}` and it is resolved
in `refresh` mode.

- Asserts the text now contains `otter`
- Asserts it no longer contains `4.2`

Same prompt, same document, different bound source. This is what proves scope is
doing the work rather than the instruction.

**Model calls:** another plan and synthesis pair.

## Beat 4 — the document refreshes on its own

`pb1` is scoped back to `finance` and refreshed. Then the finance file is
overwritten **on disk**, with no API call of any kind:

> `Q3 revenue was 5.0M, up 42% after the Meridian deal closed.`

The suite polls the block for up to 45 seconds waiting for it to contain `5.0`
or `Meridian`. Nothing prompts it: the connector detector notices the external
change, re-syncs, and the reference cascade re-resolves the dependent block.

It then reads `/activity` and asserts an event exists for this document whose
actor is `system` — the self-driven edit has to be accountable, not invisible.

**Model calls:** an embedding for the re-sync, then a plan and synthesis pair for
the cascade-triggered resolution.

## Beat 4b — exact scoping, including exclude

`set_block_context` sets `{include: ["finance","trivia"], exclude: ["trivia"]}`
and refreshes.

- Asserts the text contains `Meridian`
- Asserts it does **not** contain `otter`

Include and exclude naming the same variable is the case where a sloppy
implementation leaks. The excluded source must lose.

**Model calls:** a plan and synthesis pair.

## Beat 5 — the agent authors and resolves new prompt blocks

The discriminating beat. The prompt-block count is recorded, then an Action task
is created with this objective:

> Add two prompt blocks to document `<id>`, both using the finance context: an
> 'Overview' prompt whose instruction is a one-sentence revenue headline, and a
> 'Details' prompt whose instruction is the growth rate and its driver. Use
> document.prompt.create for each with include ["finance"], then
> document.prompt.resolve each. Do not edit any other block.

The task runs under the `general` persona and is polled to a terminal state for
up to 120 seconds. If it fails once, the suite retries with a fresh action; a
second failure is a real failure.

Assertions:

1. The action settles `completed`
2. The document has more prompt blocks than before
3. Every prompt block in the document carries the finance context

The third is the one that catches sloppy work. An agent that creates the blocks
but drops `include ["finance"]` has produced something well-formed and wrong,
and a block that silently retrieves from the whole project instead of its
declared source is a defect a user would never see.

**Model calls:** the Action tool loop — one `reason.tools` call spanning every
round the agent takes — plus a plan and synthesis pair for each block it
resolves.

## The prompts this suite exercises

Four of the system's seven prompts run here. They are reproduced in full in
[the walkthrough appendix](../../../architecture/live-document-walkthrough.md).

| Prompt | Where it runs |
| --- | --- |
| Retrieval plan | not used — prompt blocks have their own plan step |
| Block plan | beats 3, 3b, 4, 4b, and each resolve in beat 5 |
| Block synthesis | the same beats, immediately after each plan |
| Action | beat 5, as the Action task's system prompt |
| Report re-ask | beat 5, only if the agent's execution report fails validation |

The block plan and block synthesis prompts are the ones that decide whether
scoping holds; the Action prompt is the one that decides whether the agent does
exactly what was asked, once.

## How to read a failure

Each beat's assertions are independent, so a failure names its beat directly:

- Beat 3 or 3b failing means retrieval scope is not being honoured
- Beat 4 failing means the detector or the reference cascade did not fire
- Beat 4b failing means `exclude` is not subtracting
- Beat 5 assertion 1 means the agent never settled — a timeout or an invalid
  execution report
- Beat 5 assertion 3 means the agent worked but dropped the scope qualifier
