# notifications — what the suite does

Source: [dev-test/notifications/run.sh](../../../../dev-test/notifications/run.sh)

A settled task must tell the person who asked for it. This suite proves the toast
contract: one notification per settled task, delivered to its requester, scoped to
its Project, and drained exactly once.

It needs a real model because a toast only exists after a real task runs. Skips
entirely when `etc/config.local.yaml` carries no OpenRouter key.

## Setup

Register `dev@taurus.local`, log in, create a project named "Notifications Test",
and select it into the session. One job worker, 100ms poll, `max_attempts: 1`.

## Step 1 — the drain is empty before anything happens

`GET /notifications`.

- Asserts zero notifications

This is the baseline that makes the later count meaningful. Without it, "one
notification" could be one that was already sitting there.

**Model calls:** none.

## Step 2 — a real Plan task runs

A Plan task is created under the `general` persona:

> Produce a short three-step plan for writing a one-page project status update.

It is polled up to 180 times at half-second intervals to a terminal state.

**Model calls:** a retrieval-plan call, an embedding per planned query, then one
`reason.tools` call for the Plan itself.

## Step 3 — the settled state predicts the toast level

The suite does not require the model to succeed. It maps whatever terminal state
the task reached to the toast level the workflow must have pushed:

| Task state | Expected toast level |
| --- | --- |
| completed | success |
| partially_completed | warning |
| failed | error |

- Asserts the task settled into one of those three

A provider hiccup that fails the task is still a legitimate settled outcome, and
the requester must still be told. Requiring `completed` here would have made this
suite a test of model quality instead of a test of the notification contract.

## Step 4 — exactly one toast, correctly addressed

`GET /notifications`.

- Asserts exactly one notification
- Asserts its level matches the level derived in step 3
- Asserts it has a non-empty title
- Asserts its `projectId` is this suite's project

The Project scoping is the assertion that would catch a real leak: a toast
delivered to the right user but tagged with the wrong Project shows up in the
wrong workspace.

## Step 5 — draining is destructive

`GET /notifications` a second time.

- Asserts zero notifications

Toasts are ephemeral. A drain that returned them twice would show the user the
same completion notice on every poll.

## The prompts this suite exercises

| Prompt | Where it runs |
| --- | --- |
| Retrieval plan | step 2, before the Plan's tool loop |
| Plan | step 2, as the Plan task's system prompt |

No Action prompt and no report re-ask: a Plan produces a plan document, not an
execution report.

## How to read a failure

- Step 1 or step 5 failing is a drain-semantics bug, and neither involves the
  model at all.
- Step 3 failing means the task never settled — a stuck job or a poll window too
  short, not a notification defect.
- Step 4 failing on the count means the workflow pushed zero or several toasts;
  failing on level, title or project means it pushed one and addressed it wrong.
