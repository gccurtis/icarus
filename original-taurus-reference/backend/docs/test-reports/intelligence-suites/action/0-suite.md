# action — what the suite does

Source: [dev-test/action/run.sh](../../../../dev-test/action/run.sh)

An Action task that has to read before it writes: a real reasoning model opens two
documents, then appends a section to the second that combines what both say. The
edits go through the block-markdown document tools, so the agent never does
byte-offset arithmetic — it names a block and appends markdown.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Action Live Test",
and select it into the session. The job runner uses one worker and a 100ms poll.

`max_attempts` is deliberately left at the production value. Production retries a
failed job five times, and that retry is what absorbs a transient "model busy"
from the provider. Pinning it to 1 here made suites fail on hiccups production
rides out, and a test harness must not be less resilient than the thing it tests.

## Step 1 — two source documents, deliberately not indexed

Two single-block documents are created:

- **Solar**: `Solar panels convert sunlight into electricity via the photovoltaic
  effect and produce the most power on clear days around midday.`
- **Wind**: `Wind turbines convert moving air into electricity and often generate
  the most power at night and in winter, when solar output is lowest.`

Neither is admitted to the knowledge lattice. That is the point: the agent has to
reach them with `document.get`, not with retrieval, which is what makes this a
test of the document tools rather than of search.

**Model calls:** none. This step is plain document creation.

## Step 2 — the objective

An Action task is created under the `general` persona with this objective:

> Read document `<A>` and document `<B>` with document.get. Then append to
> document `<B>` a heading_2 titled 'Synthesis' followed by a paragraph that
> combines the key facts from both documents about how solar and wind power
> complement each other across the day and seasons. Use document.edit append
> operations, then report only the confirmed change.

**Model calls:** a retrieval-plan call, an embedding per planned query, then one
`reason.tools` call spanning every round the agent takes.

## Step 3 — the task settles

The task is polled up to 180 times at half-second intervals.

- Asserts the state is `completed`

The task's model usage is summed across runs — planning, retrieval and answer —
and added to the suite's token total.

## Step 4 — document B gained the section

`GET /documents/<B>`.

- Asserts at least one `heading_2` block exists
- Asserts the document body mentions "synthesis" (case-insensitive)

Row count and the appended prose are printed but not asserted. The property under
test is that the agent produced the requested structure in the right document,
not that it wrote a particular number of words.

## The citation trap this suite sits on

The objective tells the agent to read both documents. A document opened with
`document.get` is **not** evidence: its offsets are not evidence offsets, and
citing it fails report validation. Early runs on a cheaper model did exactly
that — they followed the instruction to read, then cited what they had read, and
the task failed on paperwork after doing the work correctly.

The fix was in the prompt, not the model. The Action prompt now says outright
that a document you opened is the resource you are working on rather than a
source, and that most Action tasks legitimately produce no citations at all.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Retrieval plan | step 2, before the Action's tool loop |
| Action | step 2, as the Action task's system prompt |
| Report re-ask | step 2, only if the execution report fails validation |

## How to read a failure

- Step 3 not reaching `completed` means the Action failed. If the task's runs
  show a rejected execution report, read the citation rules above before blaming
  the model.
- Step 4 failing while step 3 is green means the agent reported an edit it did
  not make, or made it in the wrong document.
