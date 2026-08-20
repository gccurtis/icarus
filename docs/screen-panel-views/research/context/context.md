# Context

| View | What it is for | Sections |
| --- | --- | --- |
| Context | What this thread can search, and what that actually resolved to | This thread searches · Resolution · Warning |

Set once for the thread. There is no per-turn scope switch, which is why this is a
statement of fact rather than a set of controls.

## Layout

| 300px |
| --- |
| this thread searches |
| resolution |
| resolution |
| warning |

## This thread searches

The scope, plus whether the web is available.

**Shows** — *Field reports 2024–25* — 96 resources; *The web* — Enabled for this
thread

**Needs** — the thread's `ResourceSet` reference and its web flag.

## Resolution

What the scope actually came to when it was last resolved, and how much of it can
be retrieved from. The gap between contained and indexed is the useful number.

**Shows** — `Resolved · 96 resources`, `Indexed · 88 · 8 with no material`,
`At · 10:21:04`

**Needs** — a resolve with an indexed count and a timestamp.

## Warning

An absent or empty scope searches the whole lattice. A zero-member Context is
blocked rather than allowed to masquerade as "search nothing".

**Open** — this is a real gap, stated in the panel because the failure mode is
silent: a scope that matches nothing quietly becomes the widest possible scope.
