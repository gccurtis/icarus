# generate — what the suite does

Source: [dev-test/generate/run.sh](../../../../dev-test/generate/run.sh)

"Create with AI" end to end: one POST creates an empty document and starts an
agent Action that fills it. The suite is short because the feature is one call
plus a wait. What it proves is that the call returns something usable
immediately, and that the document is genuinely populated afterwards rather than
merely existing.

Skips entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Generate Live Test",
and select it into the session. The job runner is pinned to one worker with a
100ms poll and `max_attempts: 1` — a generation that fails should fail once and
be visible, not be retried until it looks healthy.

## Step 1 — one call creates the resource and starts the work

`POST /resources/generate` with kind `document` and this prompt:

> Write a short explainer about the water cycle: evaporation, condensation, and
> precipitation.

- Asserts 201
- Asserts the response carries both `resource.id` and `taskId`

Both halves matter. The document exists synchronously so the client can navigate
to it, and the task id is how the client watches it fill. A response with one and
not the other leaves the user looking at an empty page with nothing to poll.

**Model calls:** none yet. The handler creates the resource, enqueues the Action,
and returns.

## Step 2 — the populating Action runs to completion

The task is polled up to 180 times at half-second intervals until it reaches a
terminal state.

- Asserts the state is `completed`

The objective the agent receives is composed by the backend, not by the caller.
The user's prompt is embedded in it
([core/wiring/resource_generator.go](../../../../core/wiring/resource_generator.go)):

> Write the requested content into document `<id>` using the document.edit tool:
> append well-structured blocks (a heading and paragraphs) as markdown. Report
> only the confirmed change. Request: `<the user's prompt>`

**Model calls:** a retrieval-plan call, an embedding per planned query, then one
`reason.tools` call spanning every round the agent takes.

## Step 3 — the document actually has content

`GET /documents/<id>`, then every atom's text is joined.

- Asserts at least one row
- Asserts at least 80 characters of text

The floor is deliberately low. What is under test is that generation writes real
blocks through the document tools; how much prose a given model produces is model
variance, and a tight length assertion would fail on that rather than on the
feature.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Retrieval plan | step 2, before the Action's tool loop |
| Action | step 2, as the Action task's system prompt |
| Report re-ask | step 2, only if the execution report fails validation |

The composed objective above is not one of the shipped prompts. It is built in
the wiring layer, and it is what turns a user's free-text request into an Action.

## How to read a failure

- Step 1 failing is a handler problem: the resource or the task did not start.
- Step 2 not reaching `completed` means the Action itself failed. Read the task's
  runs for the cause — an invalid execution report and a provider error look
  different there.
- Step 3 failing while step 2 is green is the interesting case: the agent
  reported success and wrote nothing. That is a tool-path defect, not a model
  one.
