# chats — what the suite does

Source: [dev-test/chats/run.sh](../../../../dev-test/chats/run.sh)

An ask-mode chat turn, both ways it can go. A question about the Project is
answered from indexed evidence; a general question is answered from the model's
own knowledge with no retrieval at all. The branch between them is a decision the
system makes, not a mode the caller selects, so both paths run in one suite.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Chat Live Test", and
select it into the session. One job worker, 100ms poll, production
`max_attempts`.

## Step 1 — a source document, indexed

A document "Solar Notes" is created with one block:

> Solar panels convert sunlight directly into electricity using the photovoltaic
> effect: photons knock electrons loose in silicon cells, and that flow of
> electrons is an electric current.

It is then admitted to the knowledge lattice with
`POST /dev/knowledge/documents/<id>`.

- Asserts 201 on creation and on indexing

**Model calls:** one embedding per window, admitting the document.

## Step 2 — an ask-mode chat bound to that document

`POST /agent/chats` with `mode: ask` and `resourceId` set to the document.

- Asserts 201
- Asserts the response carries `"mode":"ask"`

## Step 3 — the grounded turn

`POST /agent/chats/<id>/turns` with:

> How do solar panels make electricity?

- Asserts 200
- Asserts the user turn's body is echoed back exactly
- Asserts the agent turn's role is `agent`
- Asserts the answer is non-empty

**Model calls:** a triage call that decides retrieval is needed, an embedding per
retrieval query, then one `reason.tools` call that answers under the Ask
contract — which requires at least one citation pointing at retrieved text.

## Step 4 — history persists

`GET /agent/chats/<id>`.

- Asserts the chat holds exactly 2 turns

One user turn and one agent turn. A turn that answered correctly but was not
recorded would leave the next question with no conversation behind it.

## Step 5 — a general question skips retrieval entirely

A second chat is opened with no bound resource, and asked:

> What is 1 + 1? Reply with just the number.

- Asserts the answer contains 2

This is the triage branch. The planning call reports that the question needs no
Project evidence, so retrieval never runs and the answer comes back through the
direct path — no evidence, no citation obligation. Routing this through the
grounded path instead would fail: there is no evidence in the Project for
arithmetic, so a citation-requiring contract could not be satisfied.

**Model calls:** a triage call and one direct reasoning call. No embeddings.

## Step 6 — an observation, not an assertion

The same chat is asked:

> How many times does the letter r appear in the word strawberry? Reply with just
> the number.

The answer is printed and nothing is asserted. Letter counting is a known weak
spot for language models, and asserting on it would make the suite fail for a
reason that has nothing to do with the platform. It stays in the run as a visible
sample.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Retrieval plan | steps 3, 5 and 6, as the triage decision |
| Ask | step 3, as the grounded turn's system prompt |

Step 5 and step 6 use no system prompt beyond the resolved persona — the direct
branch deliberately carries no grounding contract.

## How to read a failure

- Step 1 failing is indexing, before any reasoning happens.
- Step 3 failing with a 500 is usually the citation contract: a grounded answer
  arrived with no citations. The request log carries the cause.
- Step 4 failing means the turn answered and was not persisted.
- Step 5 failing means triage sent a general question down the grounded path, or
  the direct answer came back empty.
