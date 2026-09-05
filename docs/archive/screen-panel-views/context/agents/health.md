# Health

| View | What it is for | Sections |
| --- | --- | --- |
| Health | What is broken, what has never run, and what works | Not working · Never fired · Working |

The state of every rule in one place. It is the view Project Overview's Health
links into.

## Layout

| 300px |
| --- |
| not working |
| never fired |
| working |
| working |

## Not working

**Shows** — *Nightly filing digest* — Today, 02:00 · tool not permitted

**Needs** — last-fire outcome and reason.

## Never fired

A rule that has never run is not broken, but it is not working either — usually
it is off, or its trigger has never occurred.

**Shows** — *Weekly board pack* — Off

**Needs** — a fire count of zero, plus enabled state to explain it.

## Working

Rules that dispatch, with roughly how often.

**Shows** — *Refresh outage summary* — ~412 times; *Brief on new finding* — ~37 times

**Needs** — an approximate fire count.

**Open** — no fabricated timeline. There is no run table, no retry model and no
history beyond the last fire, so this view can show state and a count and nothing
else. The tilde is load-bearing.
