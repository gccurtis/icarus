# prompt — what the suite does

Source: [dev-test/prompt/run.sh](../../../../dev-test/prompt/run.sh)

The full grounded-generation journey for a prompt block: resolve it against a
source, change the source eight times and watch each change propagate cleanly,
then prove the two stable non-answers — insufficient evidence, and a genuine
contradiction between sources.

It is the longest-running suite in the set, and almost all of that is the
stability loop, which exists to shake out an intermittent failure rather than to
sample one.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Prompt Project", and
select it into the session. Window geometry narrowed to 200 runes with 40 of
overlap.

## Part 1 — grounding and change propagation

### Step 1 — a source with editable ids

A document "Tower" is created with explicit row, block and atom ids so the suite
can edit one atom later:

> The Eiffel Tower is 300 meters tall. It stands on the Champ de Mars in Paris.

It is admitted to the knowledge lattice.

**Model calls:** one embedding per window.

### Step 2 — a report that draws on it

A second document holds one prompt block `pb`:

> Describe the Eiffel Tower: how tall it is and where it stands. Answer only from
> the sources.

The instruction asks for **both** the height and the location on purpose. That
gives the answer one fact that will change and one that will not, which is what
makes the stability assertions below possible.

### Step 3 — resolve, grounded

`pb` is resolved in `reload` mode.

- Asserts the block's status is `ok`
- Asserts the block carries `evidence`
- Asserts the evidence's `sourceId` is the Tower document
- Asserts the answer contains `300`
- Asserts the answer contains `Champ de Mars`
- Asserts the answer does not contain `450`

**Model calls:** a plan call, an embedding per query, then a synthesis call.

### Step 4 — eight source changes, eight clean propagations

The height in the source is rewritten, the source re-indexed, and the block
refreshed — eight times, through this sequence:

`450 → 275 → 512 → 189 → 333 → 617 → 208 → 741`

Each iteration asserts four things:

- The status is `ok`
- The status is **not** `contradiction`
- The answer contains the new height
- The answer contains `Champ de Mars` — the unchanged prose survived
- The answer does not contain the previous height followed by "meters"

The trap being tested is in the synthesis prompt. The previous answer is handed
to the model for wording and format consistency, and it must be treated as an
earlier draft rather than as a fact source: when the evidence now says 450 and the
prior answer says 300, the evidence wins and that is **not** a contradiction. The
prompt states this explicitly, with a worked example, because getting it wrong
turns every source edit into a false conflict.

Eight iterations rather than one because this failure is intermittent on a small
model. A single pass proves nothing about a behaviour that fails one time in
five.

**Model calls per iteration:** an embedding for the re-index, a plan call, an
embedding per query, then a synthesis call.

## Part 2 — the two stable non-answers

### Step 5 — no evidence produces "insufficient", not a guess

A document "Ask" holds a prompt block:

> What is the boiling point of water in Celsius? Answer only from the sources.

Nothing in the Project addresses it.

- Asserts the status is **not** `ok`
- Asserts the status is `insufficient`

The model plainly knows the answer. Refusing to give it is the correct behaviour:
a prompt block is a claim about the Project's own sources, and answering from
world knowledge would make every resolved block untrustworthy.

### Step 6 — a real contradiction is reported as one

A second source is added:

> The Eiffel Tower is 900 meters tall, one of the shortest structures in Paris.

Then a new block asks:

> Exactly how tall is the Eiffel Tower? Answer only from the sources.

- Asserts the status is **not** `ok`
- Asserts the status is `contradiction`

This is the mirror of step 4. There, a disagreement between the prior answer and
the evidence had to resolve in favour of the evidence. Here, a disagreement
between two evidence items has to be reported rather than resolved. The prompt
draws the line precisely: a contradiction can only ever be a disagreement between
evidence items, and with one evidence item on the point it is impossible.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Block plan | steps 3, 4 (eight times), 5 and 6 |
| Block synthesis | the same steps, immediately after each plan |

This suite is the primary exercise for the synthesis prompt's `STATUS` and
`PRIOR ANSWER` rules — every one of those rules has an assertion here.

## How to read a failure

- Step 3 failing means grounding never worked, and everything after it is noise.
- Step 4 failing on `contradiction` means the prior answer is being read as
  evidence. That is the single most important behaviour in this suite.
- Step 4 failing on `Champ de Mars` means the unchanged prose was rewritten —
  the block churns text on every refresh even where nothing changed.
- Step 5 returning `ok` means the model answered from world knowledge.
- Step 6 returning `ok` means a real conflict was silently resolved, which is
  worse than either non-answer: the user gets one height and no sign the sources
  disagree.
