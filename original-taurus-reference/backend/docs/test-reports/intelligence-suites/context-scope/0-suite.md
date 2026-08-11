# context-scope — what the suite does

Source: [dev-test/context-scope/run.sh](../../../../dev-test/context-scope/run.sh)

Per-block scope selection. A prompt block declares an include set and an exclude
set over the document's context variables, and retrieval is restricted to exactly
includes minus excludes. The suite runs the same three scope shapes twice: once
with variables bound to indexed **documents**, once with them bound to live
**connectors**.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Context Scope
Project", and select it into the session. Window geometry narrowed to 200 runes
with 40 of overlap.

Two invented identifiers appear nowhere else, so the model can only name one if
that source was genuinely in scope:

| Fixture | Text |
| --- | --- |
| Solar | The Zephyrite reactor generates electricity from concentrated sunlight. Zephyrite is a solar technology. |
| Wind | The Borealis turbine generates electricity from steady wind. Borealis is a wind technology. |

One instruction is used for every resolution in both parts:

> Name the power-generation technology described in the sources, using the exact
> name the sources use for it. Answer only from the sources.

## Part 1 — variables bound to documents

### Step 1 — two sources, both indexed

Both documents are created and admitted to the lattice. A report document is
created with one prompt block `pb`, then three change-set operations declare
variables `solar` and `wind` and bind each to its document.

**Model calls:** one embedding per window, per document.

### Step 2 — scope to solar

`set_block_context` sets `{include: ["solar"]}`; the block resolves in `reload`
mode.

- Asserts status `ok`
- Asserts the answer contains `Zephyrite`
- Asserts it does **not** contain `Borealis`

### Step 3 — swap to wind

`set_block_context` sets `{include: ["wind"]}`.

- Asserts the operation cleared `ResolvedAt`

That assertion is what makes `refresh` meaningful: a scope change must invalidate
the previous resolution, or a refresh would see a resolved block and do nothing,
and the answer would look correct while being stale.

The block is then resolved in `refresh` mode.

- Asserts the answer contains `Borealis`
- Asserts it does **not** contain `Zephyrite`

Same prompt, same document, different bound source. This is what proves scope is
doing the work rather than the instruction.

### Step 4 — include both, exclude one

`set_block_context` sets `{include: ["solar","wind"], exclude: ["wind"]}` and
refreshes.

- Asserts the answer contains `Zephyrite`
- Asserts it does **not** contain `Borealis`

Include and exclude naming the same variable is where a sloppy implementation
leaks. The excluded source must lose.

**Model calls per resolution:** a plan call, an embedding per query, then a
synthesis call.

## Part 2 — the same three shapes, bound to connectors

Two watchers are started over two temp folders holding the same solar and wind
text, two connectors are created and synced, and a second report binds `solar`
and `wind` to the **connectors** instead of the documents.

### Step 5 — scope to the solar connector

`{include: ["solar"]}`, resolved in `reload` mode.

- Asserts `Zephyrite`, and not `Borealis`

### Step 6 — switch to the wind connector

`{include: ["wind"]}`, resolved in `refresh` mode.

- Asserts `Borealis`, and not `Zephyrite`

Scope resolution is kind-agnostic: a variable's resource kind maps one-to-one
onto a knowledge source type, so both parts drive the same code path. Part 2
exists because connectors are the real live-data target, and a path that works
only for documents would be a feature nobody could use on their own files.

## The retry, and what it does not cover

The "answer contains X" assertion gets one bounded retry. A live model
occasionally declines perfectly good evidence or paraphrases instead of naming the
identifier, and one such sample should not fail the suite; a systematic decline or
paraphrase still does.

The "answer does not contain Y" assertion gets **no** such grace. That is the
scope-membership property itself, and it is asserted strictly on whichever answer
is final. Leniency there would let a genuine scope leak pass on the second try.

## The defect this suite found

Given `The Borealis turbine generates electricity from steady wind. Borealis is a
wind technology.`, an early run answered **"wind technology"**.

Against the synthesis prompt as it then stood, that answer was impeccable:
verbatim from the evidence, nothing invented, no outside knowledge. It simply did
not answer the question. Every rule in that prompt governed where facts may come
from; none governed whether the answer addressed what was asked.

The synthesis prompt gained an `ANSWER EXACTLY WHAT WAS ASKED` section — obey the
instruction's constraints literally, prefer the specific over the general, do not
generalize what the evidence states precisely. Its worked example deliberately
uses an invented pair ("Kestrel is a database engine") rather than this suite's
fixtures: a shipped prompt that names the values its test asserts on is an answer
key, not a prompt.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Block plan | every resolution in both parts |
| Block synthesis | the same resolutions, immediately after each plan |

## How to read a failure

- A `ResolvedAt` assertion failing means a scope change is not invalidating the
  previous resolution — every later answer in the suite becomes untrustworthy.
- The "contains" assertion failing after its retry is a synthesis-quality failure:
  the evidence was in scope and the answer did not use it.
- The "does not contain" assertion failing is a scope leak, and it is the most
  serious failure this suite can produce.
- Part 1 passing while Part 2 fails narrows the fault to the connector source
  type, not to scoping itself.
