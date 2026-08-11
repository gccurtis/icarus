# agents — what the suite does

Source: [dev-test/agents/run.sh](../../../../dev-test/agents/run.sh)

Authoring from nothing. The agent is given an empty document and has to produce a
titled, sectioned story with inline emphasis — a title block, several section
headings, bold and italic marks — all landing as real blocks and marks through
the markdown tool path.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Agent Live Test", and
select it into the session. One job worker, 100ms poll, production
`max_attempts`.

This suite also overrides the backend default persona in the test manifest, which
is a real configuration surface rather than a test shim:

| Field | Value |
| --- | --- |
| name | General |
| description | Backend-configured general-purpose Project assistant |
| focus | Complete the user's Project task accurately. |
| instructions | Act as Taurus's general Project assistant. Read a target document before editing it, preserve the requested structure, and report only tool-confirmed effects. |
| default_verification | Verify the final document structure and formatting from successful document tool results. |
| output_preferences | Be direct and distinguish completed effects from unresolved work. |

## Step 1 — an empty target and a resolvable persona

A document "The Clockmaker Story" is created with `rows: []`, and the default
persona is fetched.

- Asserts `GET /personas/default` returns 200
- Asserts its id is `general`

The persona check is here because the objective below names `personaId: general`.
If the backend-configured persona did not resolve, the Action would run under a
different set of instructions and every later assertion would be measuring the
wrong thing.

**Model calls:** none.

## Step 2 — the objective

> Write an original short story of at least 250 words in document `<id>` using
> document.edit append operations with markdown. First read the document. Use the
> exact heading_1 title The Clockmaker's Orchard, then at least three heading_2
> section headings. Put story prose in paragraph blocks. Use \*\*bold\*\* on at
> least two important phrases and \_italic\_ on at least two atmospheric phrases.
> Read the document again to verify it, and report only the confirmed change.

**Model calls:** a retrieval-plan call, an embedding per planned query, then one
`reason.tools` call spanning every round.

## Step 3 — the task settles

Polled up to 120 times at half-second intervals. Terminal states here include
`waiting`, since an Action that pauses for input has stopped running.

- Asserts the state is `completed`

## Step 4 — the structure landed

`GET /documents/<id>`, then five counts are taken from the stored document.

- Asserts a `heading_1` block exists
- Asserts the exact title text `The Clockmaker's Orchard`
- Asserts `heading_1` count at least 1
- Asserts `heading_2` count at least 3
- Asserts bold marks at least 2
- Asserts italic marks at least 2
- Asserts at least 120 words of text

## Why the word floor is so far below the objective

The objective asks for 250 words and the assertion accepts 120. That gap is
deliberate, and the reasoning is recorded in the suite itself.

Length adherence is sampled, not the property under test: observed runs against
this same objective produced 239, 157 and 280 words. Asking for more backfired —
at 400 words the agent appended enough blocks to exhaust the tool-loop round
limit and the task failed outright. (The suite's comment records that from when
the limit was 16 rounds; it is 64 today.) So the objective stays at a realistic
length and the floor absorbs the variance.

Structure, by contrast, came out right every time. That is why the heading and
mark counts are asserted strictly while the word count is only a proxy for "it
wrote prose, not a stub".

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Retrieval plan | step 2, before the Action's tool loop |
| Action | step 2, as the Action task's system prompt |
| Report re-ask | step 2, only if the execution report fails validation |

The persona instructions above are prepended to the Action prompt, so the system
message the model actually sees is the persona followed by the Action rules.

## How to read a failure

- Step 1 failing on the persona means configuration, not intelligence.
- Step 3 not settling means the Action failed or ran past its poll window.
- Step 4 failing on `heading_1` or the exact title means the agent did not follow
  a literal instruction. Failing only on the word count is the tolerated
  variance — check the printed counts before treating it as a regression.
