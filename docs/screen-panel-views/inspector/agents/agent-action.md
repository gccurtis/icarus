# Ask an agent

| Selecting | What it is | Sections |
| --- | --- | --- |
| The agent action in the Do this view | Who is asked, what they are asked, and what comes out | Ask an agent · Ask it to · That agent · What comes out |

## Layout

| 300px |
| --- |
| ask an agent |
| ask it to |
| ask it to |
| that agent |
| what comes out |

## Ask an agent

Which agent.

**Shows** — Filing Editor, as an avatar and a name

**Needs** — a `Persona` reference.

## Ask it to

The instruction, sent verbatim. Nothing is added to it and nothing is templated
into it.

**Shows** — "Summarise last night's outage reports by substation and flag anything
that changes the filing position."

**Needs** — the prompt string on the action.

**Open** — a scheduled prompt often wants to refer to "last night" or "this week".
Whether any substitution is available, and if not, how a prompt stays correct as
time passes, is unaddressed.

## That agent

What the chosen agent can see and do — because a rule that asks an agent to do
something it lacks the tools for fails at 02:00, silently, every night. Starts
collapsed.

**Shows** — `Can look up · Regulatory corpus · 34`, `Tools · 2 allowed`

**Needs** — the persona's scope and tool allowance.

## What comes out

A task, marked as started by this Automation. That task is the whole trace, and
it opens in the Copilot.

Stated because it is the answer to "where do I see what happened" — the
Automation records only that it dispatched.

**Needs** — the dispatched `AgentTask`, attributed to this rule.
