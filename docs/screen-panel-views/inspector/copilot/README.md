# The Copilot's lenses

The Copilot is the one surface that belongs to no tab. It lives in the middle of
the status bar, under the work surface and exactly as wide as it — a composer
that grows upward out of the row rather than making the row taller. Its lenses
take over the inspector while it is open.

**A row of the frame, not a dock floating over it.** A bar hovering over the work
covers the bottom of every screen and has to be made translucent to be bearable,
which would leave the one always-available input in the application as the
hardest thing on it to read.

**Disabled on Research.** That screen is already a conversation with an agent,
and a second composer under it would be two ways to say the same thing. Recorded
in full on [the status bar](../../screens/_shared/status-bar.md), which is also
where it says that the bar does not act on it yet.

Opening one of these records the prior inspection and collapse state; closing
restores them if the selected object still exists. An ordinary work-surface
selection returns the inspector to that object immediately, without stopping
background work.

| Selecting | What it is | File |
| --- | --- | --- |
| The Copilot, opened | Everything in flight, and everything recent | [home.md](home.md) |
| A conversation | One thread with one agent | [conversation.md](conversation.md) |
| A task, from anywhere | What was asked, the plan, and where it has got to | [task.md](task.md) |
| The scope control | What this request will be able to look up | [what-it-can-see.md](what-it-can-see.md) |

[task.md](task.md) is reached from well outside the Copilot — a Tasks context
view, a persona's work list, an Automation's last run — because a task is a task
wherever it is named. It is one lens, and the only thing that varies is that the
*Agent* row drops out when the breadcrumb already names the persona.

## The composer

The composer itself is not a lens, so it is not in this directory. It is the
middle part of
[the status bar](../../screens/_shared/status-bar.md) — mode, draft, persona and
send — written as a workspace, beside the screens rather than under one, because
it belongs to no tab. Not a third: it is as wide as the work surface, because the
bar takes its outer columns from the frame's own. The client model has
[the copilot object](../../../client-model/copilot.md) behind it.
