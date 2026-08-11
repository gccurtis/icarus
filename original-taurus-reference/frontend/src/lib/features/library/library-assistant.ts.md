# `library-assistant.ts` — the library AI surface's state

The composer at the foot of the work surface and the **Agent** lens on the right are **one
surface**, so they share this store the way `QuarterbackDock` and `QuarterbackPanel` share
`aiAgent`. Sending from the bar opens the lens; the lens sets what the next request carries.

## A library send is a whole request

```ts
draft: { project: string; personalityId: string; contexts: string[] }
web: boolean;  mode: AiMode;
```

Not a chat turn — a request that runs **somewhere** (`project`), **as someone**
(`personalityId`), **over something** (`contexts`), in a mode, optionally with the live web. That
is the same anatomy as a request anywhere else in the app, which is why the library uses the same
`QuarterbackBar` with its full control set rather than a reduced copy.

`personaOptions` maps the library's personalities onto `AiPersona` so the bar's persona picker
*is* the personality picker. One control, not two.

`NO_PROJECT` (`'none'`) is the default project and a real scope, not a null: Omega will back it
with a per-user, unshareable internal project so library work always has somewhere to run.

## It is a mock, and the reply says so

```ts
body: `${intent(space, mode, assetName)} — but the library has no agent backend yet, so nothing has changed.`
```

Every agent route in Omega is project-scoped — `POST /agent/chats`, `/agent/plans`,
`/agent/actions` all sit behind `requireProject` — and the library deliberately stands outside
any one project. There is no endpoint a library turn could honestly call.

So the reply states **what it would do**, then says it cannot yet. That is the only honest shape
available: a silent no-op reads as a broken feature, and a fabricated answer is a lie. The
`intent()` table keeps those promises in one place, comparable side by side, instead of buried in
a switch — worth reading before building the real thing, because it is the spec for what each
mode means per space.

## On Agents the bar has two destinations

```ts
if (space === 'agents') {
  if (taskId) { messageAgentTask(taskId, body); return null; }
  const task = startAgentTask({…draft, objective: body, mode}); closeAssistant(); return task.id;
}
```

`submitLibraryPrompt` branches on the **selected task**, because that is the honest distinction:
with one selected you are talking to an agent that already exists, and with nothing selected the
send starts one. Two acts, one composer, and the selection is what tells them apart.

- **Continuing a task** appends to its transcript and returns `null` — nothing was born, and the
  task is already selected — and deliberately does *not* close the lens, so the line you just sent
  appears in the exchange you were reading.
- **Starting an agent** takes its objective from the bar's text and the rest from `draft`: the
  project it runs in (chosen once — an agent never moves between projects) and the personality it
  runs as. Ask has no durable-task equivalent, so an investigating agent is filed as an `action`.
  It returns the id so the console can select the new task, flipping the panel to its Task lens.
  That is why the function returns `string | null` rather than void: the caller needs to know
  whether anything was born.

On Context and Templates it stays a mocked exchange, and `taskId` is always absent.

## Context, adapted — there is no "this document"

The dock's sources (open document, selection, project knowledge) name things that do not exist
here, so there is no source table at all. The asset on screen is **implicitly in scope** — never a
checkbox, because asking someone to tick "this context" on the context screen is asking them to
confirm the obvious — and `draft.contexts` holds what they added deliberately, from the whole
library, through a modal. `addDraftContext` / `removeDraftContext` are the only writers.

## Copy that names the right thing

`placeholdersFor` and `cuesFor` exist because the shared `aiModeCopy` says "Ask about this
document…" and "Make a direct edit when possible" — correct over an editor, wrong over a library.
Both are keyed by space, and the Agents strings are deliberately **not tied to the open
personality**: the same bar serves the Activity view, where none is open and "this personality"
would be false.

Both also take an optional `target` — the agent the bar is addressing when a task is selected — and
this is where the two destinations are said out loud:

```ts
if (target) return { action: `Tell ${target} what to do next…`, … };
return { action: 'Start a new agent to…', … };
```

"What should the agent do?" reads identically whether you are steering a running task or starting a
fresh one, which is precisely the ambiguity to kill. The `target` strings name the agent; the
untargeted ones say **new** expressly.

`resetAssistant()` is called when the space or the open personality changes — a conversation about
a context means nothing on the templates screen. It re-seeds `personalityId` to the **default**
personality; the Agents console then overrides it with whoever the bar is addressing — the selected
task's agent, or failing that the personality you have open — so reaching for the bar on Planner
means Planner rather than the default.
