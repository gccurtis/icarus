# 2026-07-29 — One bar, two destinations; a calmer detail panel

Two corrections to the library routes, both about a surface saying which of two things it is about
to do.

## The Agent lens had one shape and needed two

Selecting a task pointed the *panel* at that agent but left the *bar* pointed at a new one. Click
the bar over a selected task and you got a start-an-agent form — a second composer for a
conversation already on screen — so the same keystroke meant "steer this" or "launch that"
depending on nothing visible.

The selected task is now the hinge of the whole Agents screen:

| Selection | Panel tabs | The bar |
| --- | --- | --- |
| A task | `Task` · `Agent` | continues that task's exchange |
| A personality | `Details` · `New agent` | starts an agent, as that personality |
| Nothing | `Now` · `New agent` | starts an agent, as the default personality |

`AgentLens` grew a `task` branch: identification (state pill, personality, project, objective) over
the exchange, and **no Project picker or Add context** — where a task runs and what it reads were
settled when it was born, and an agent never moves between projects, so offering to change them
would promise something the model does not allow.

`submitLibraryPrompt` branches on the same fact: `messageAgentTask` when a task is selected,
`startAgentTask` when not. Continuing returns `null` (nothing was born, and the task is already
selected) and deliberately leaves the lens open so the line you just sent appears where you are
looking.

### Both directions of the switch work

```svelte
function selectTask(id) { selectedTaskId = selectedTaskId === id ? null : id; closeAssistant(); }
```

Reach for the bar and the panel shows the agent; click a task and it shows the task. The second half
was missing — with the Agent lens open, clicking a row left the composer's lens up, answering a
question you had not asked.

### One selection per work surface

The task is released when you engage something that is not a task: navigating (already true) and now
focusing a personality's **definition** (`onfocusin` → `ondefinitionfocus`). Without it, editing
Focus while a history task was selected left the bar aimed at that task's agent — you would have
typed a note to yourself into a running task.

### Said three times, on purpose

The composer's text is identical either way, so the distinction is carried by the tab (`Agent` /
`New agent`), the bar's own leading mark (`This task` / `New agent`, via the primitive's unused
`leading` slot, keeping the `AI` mark alongside), and the placeholder (`Tell Analyst what to do
next…` / `Start a new agent to…`). The [AI surface
spec](../../style/ai-quarterback-surface.md) requires that before a material action the user knows
*where the result goes*.

The mark says "This task" rather than "Analyst · this task" because the persona picker two controls
along already names the agent. Destination and persona are different facts — *to this task, as
Analyst* — one control each, which is the same rule that put the picker in the bar to begin with.

Tab labels are `New agent`, not `New`: beside `Now` on the Activity view, `New` is one letter away
from its neighbour.

## Two extractions the third copy would have made worse

- **`TaskExchange.svelte`** — the transcript is *one conversation*, read by the Task lens beside the
  working list and by the Agent lens as the thing the bar continues. It must not have two
  appearances depending on which tab is open. Only the height cap varies.
- **`TASK_PILL`** in `agents-mock` — Omega's `TaskState` → `StatePill`, previously copied in two
  components and about to be copied into a third. That is how `waiting` ends up reading "Needs you"
  in the monitor and "Needs review" in a panel.

## The detail panel was crowded, and said the wrong thing about contexts

**Sharing and About are closed at rest.** Three expanded sections filled the panel top to bottom and
read as crowding — against the second design law, *few things visible, right things visible.*
Details is what you came for; the other two answer questions you have to ask first.

**The copy rule moved out of About to the foot of the panel.** It is a standing condition of the
whole screen rather than a detail about one asset, and inside a now-closed section it would have
been hidden behind a disclosure. It is the part of the model most likely to surprise someone, so it
must be readable without opening anything.

**And it is now worded by the caller, because the rule genuinely differs.** The old text told
everyone that "bringing it into a project copies it again" — naming a motion **the Context screen
does not offer**. The console's own header already encodes that asymmetry: `Bring into project`
appears on Templates only, because you reach for a context from inside the project that needs it. So
Templates keeps both clauses, while Context and a personality keep the one that matters — your edits
here stay here.

## Verification

`pnpm check` 0 errors / 0 warnings · 385 unit tests · `pnpm build` clean · companions verified ·
`library-and-theme.spec.ts` **7/7**, with new assertions covering: the tab and bar naming `New
agent` with nothing selected; a selected task re-pointing tab, mark and placeholder at its agent;
the Agent lens showing the exchange and *not* the composing controls; a send landing in the
transcript with its honest "Not delivered" reply; clicking a task switching back to `Task` from an
open Agent lens; focusing the definition releasing the selection; and Sharing closed at rest but
still opening.
