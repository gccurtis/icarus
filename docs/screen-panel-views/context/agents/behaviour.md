# Behaviour

| View | What it is for | Sections |
| --- | --- | --- |
| Behaviour | The five sections of the agent's definition | Sections |

Prompt material — text sent on every call. Distinct from Context, which is
material the agent can go and look things up in. The two never share a panel.

## Layout

| 300px |
| --- |
| sections |
| sections |
| sections |

## Sections

The five, each with whether it is written and how long it is.

**Shows**

- Focus — 168 characters
- Background — 402 characters
- Approach — 291 characters
- Output — 184 characters
- Verification — 143 characters

The character count is the honest measure of what each section costs, since every
one of them is sent on every call.

**Needs** — the persona's five definition fields.

Empty sections are left out of the prompt entirely. A persona with five empty
sections and a scope is legal, so the panel shows emptiness as a state rather
than as an error.

**Open** — the five names are fixed. Whether that is the right five, and whether
they should be reorderable, is a product question the model currently answers by
having exactly these fields.
