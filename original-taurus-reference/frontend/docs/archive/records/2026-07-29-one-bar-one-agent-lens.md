# 2026-07-29 — One quarterback bar, one Agent lens

A same-day correction to the library AI surface. The first pass shipped a bar with fewer controls
than the app's own and two different second lenses; both were wrong, and for the same reason.

## The library had a lesser bar

`QuarterbackBar` renders its persona picker only when `personas` is non-empty, and its Web toggle
only when `onwebchange` is passed. The library passed **neither** — so it had a mode picker and a
send button, and nothing else, while a personality `<Select>` sat in the side panel doing the job
the bar's persona picker already does.

```svelte
<QuarterbackBar … personas={personaOptions} personaId={$assistant.draft.personalityId}
  web={$assistant.web} onpersonachange={setDraftPersonality} onwebchange={setAssistantWeb} … />
```

There is **one bar in this product**. A surface that needs different data passes different data;
it does not grow a reduced copy. `personaOptions` maps the library's personalities onto
`AiPersona`, so the bar's persona picker *is* the personality picker — one control, not two.

## The lens was two answers to one question

`LibraryAssistant` (a chat panel, Context and Templates) and `NewAgentPanel` (start-an-agent,
Agents) are both **"describe work, say where it runs and what it reads, send"**. They are now one
`AgentLens`, and the tab is labelled **Agent** on all three spaces. The left tab still names what
it shows — Task over a task, Now over the Activity summary, Details over an asset.

The Agents space differs only in what Send does: a task appears in the monitor instead of a reply
in the panel.

## Context: implicit asset, deliberate additions

The dock-inherited "sources" grid had two checkboxes — *This context* and *Your contexts* — the
first of which asks the user to confirm the obvious and the second of which is a toggle standing
in for a choice nobody has made. Replaced by: the asset on screen shown as an always-in-scope
chip, plus **Add context**, a modal over the whole context library.

## Project, including None

Every space's lens now picks a project, defaulting to **None** — which is a real scope, not a null
case: Omega will back it with a per-user, unshareable internal project so library work always has
somewhere to run. An agent never moves between projects, so this is chosen up front.

## The bar points at what you are looking at

```svelte
$effect(() => { if (personality) setDraftPersonality(personality.id); });
```

Open Planner, reach for the bar, and you meant Planner. Defaulting to the roster's default there
would be a small lie about what you had just selected.

## Two affordances removed

The **New agent** button is gone: starting an agent is what the bar is for, and a button that
opens a lens you can open by clicking the bar is a second door to one room. The rail's `+` moved
off the *Agents* heading onto **Personalities**, which is the thing you actually create here.
