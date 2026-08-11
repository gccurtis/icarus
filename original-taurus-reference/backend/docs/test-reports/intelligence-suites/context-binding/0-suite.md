# context-binding — what the suite does

Source: [dev-test/context-binding/run.sh](../../../../dev-test/context-binding/run.sh)

A document variable can bind to a **context** instead of to a single resource.
This suite proves that the context's membership — not the block's own selection —
is what decides retrieval scope, by changing the context and watching the same
block's reach change with it.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Context Binding
Project", and select it into the session. Window geometry narrowed to 200 runes
with 40 of overlap.

Two invented facts, mutually distinct so an answer can only contain one if that
source was actually in scope:

| Document | Text |
| --- | --- |
| Meridian | The Meridian tower is 512 meters tall. |
| Solace | The Solace bridge spans 1400 meters. |

## Step 1 — two sources, both indexed

Both documents are created and admitted to the knowledge lattice. Both are
retrievable from this point on — scope, not availability, is what the rest of the
suite tests.

**Model calls:** one embedding per window, per document.

## Step 2 — a context holding only one of them

`POST /contexts` with a single include: document A.

`GET /contexts/<id>/resolved`:

- Asserts doc A's id is present
- Asserts doc B's id is absent

Before any model call. Context resolution is structural, and checking it here
separates "the context is wrong" from "retrieval is wrong" in every later
failure.

## Step 3 — a report bound to the context

A document "Tower Report" is created with one prompt block `pb`:

> How tall is the Meridian tower? Answer only from the sources.

Three change-set operations wire it up:

1. `set_template` — one variable, `src`
2. `set_context_variable` — binds `src` to the **context**, not to a document
3. `set_block_context` — scopes `pb` to `{include: ["src"]}`

**Model calls:** none.

## Step 4 — the answer comes from the context's one member

`pb` is resolved in `reload` mode.

- Asserts the block's status is `ok`
- Asserts the answer contains `512`
- Asserts the answer does **not** contain `1400`

Doc B is indexed and retrievable. It stays out of the answer because the context
does not include it.

**Model calls:** a plan call, an embedding per query, then a synthesis call.

## Step 5 — widening the context, without touching the block

`PATCH /contexts/<id>` to include both documents, then `GET .../resolved`:

- Asserts both ids are now present

Still no model call. The document, the variable binding and the block's scope are
all untouched — only the context changed.

## Step 6 — the same block can now reach the new member

The block's instruction is changed to ask about the other source:

> How long is the Solace bridge? Answer only from the sources.

`pb` is resolved in `reload` mode.

- Asserts status `ok`
- Asserts the answer contains `1400`

This is the point of the suite. Nothing about the block's scope was edited; the
block still declares `include: ["src"]`. Its reach grew because the context it
points at grew. That indirection is what makes a context worth having — one edit
in one place changes what every block bound to it can see.

**Model calls:** a plan call, an embedding per query, then a synthesis call.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Block plan | steps 4 and 6 |
| Block synthesis | the same steps, immediately after each plan |

## How to read a failure

- Step 2 or step 5 failing is context resolution, before any model is involved.
- Step 4's `512` failing is retrieval or synthesis; `1400` appearing means scope
  is not restricting at all — the block is seeing the whole Project.
- Step 6 failing while step 4 passed means the widened context is not reaching
  the block: the binding is resolving to a stale membership snapshot rather than
  to the context's current contents.
