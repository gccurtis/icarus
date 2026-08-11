# 2026-07-29 — The AI bar reaches the library, and Agents trades chat for "start one"

The AI composer now sits at the foot of all three library spaces, with its own half of the
right-hand panel. Three things were document-specific and had to change; one space turned out not to
want a conversation at all.

## Composer and panel are one surface, as in the workspace

```svelte
<div role="tablist">…{detailsLabel}…{secondaryLabel}…</div>
{#if $assistant.open}{#if secondary}{@render secondary()}{:else}<LibraryAssistant/>{/if}{:else}{@render details()}{/if}
```

`LibraryPanel` owns the `<aside>`, its scroll, and one switch: **what you are looking at**, or the
lens working on it. Sending from the bar flips that switch, exactly as the dock flips the inspector.
`LibraryDetails` and `TaskDetails` became plain content components so the frame lives in one place
and the three spaces cannot drift in width, scroll, or material.

## There is no "this document" out here

The dock's context sources name the open document, the current selection, project knowledge — none
of which exist in a library. A library turn draws on **the asset you are looking at** and **the rest
of the library**, which is the whole reason these screens exist. `placeholdersFor` and `cuesFor`
replace the shared mode copy for the same reason: "Ask about this document…" is correct over an
editor and wrong over a context.

`QuarterbackBar` gained one additive, optional `placeholders` prop rather than being reimplemented.
It is a Lego block; improving it beat forking it.

## Agents has no assistant

There is nothing useful to say to the library *about* agents that is not "start one" — a
conversational lens that only ever produced that would be decoration. So the Agents space overrides
the panel's second lens with **New agent**: the bar's text is the objective, and the lens supplies
the two things the bar cannot — the project it runs in and the personality it runs as.

The project picker carries the rule that makes it necessary: **an agent never moves between
projects**, so the project is chosen once, at birth. Not a modal: a modal would interrupt to collect
two fields that fit in a panel already on screen, and would put the objective on the far side of a
dialog from the settings it belongs with. A `New agent` button in the Activity header opens the same
lens, so there is a visible path as well as the bar.

Sending starts a task, and the console selects it — the agent appears at the top of Working now
**and** the panel flips to its Task lens. A new-agent flow whose result you cannot see is not a flow.

`TaskDetails` lost its Send button in the process: two composers for one act, on one screen, is worse
than either alone.

## Honest by construction

Every agent route in Omega sits behind `requireProject`, and the library stands outside any project,
so no library turn could reach a real endpoint. The reply states **what it would do**, then that it
cannot yet — a silent no-op reads as broken, a fabricated answer is a lie. Started tasks are
`queued`, never `running`, and say so themselves.

## A real bug the e2e caught

```ts
onstarted?.(submitLibraryPrompt(space, prompt, mode, assetName));   // WRONG
```

An **optional call does not evaluate its arguments when the callee is nullish**. Context and
Templates pass no `onstarted`, so on those two spaces the turn was silently never submitted — the
composer cleared and nothing happened. Agents passed the prop, which is exactly why only that path
worked and the bug looked like a stale dev server for several minutes. Fixed by submitting first and
notifying second, with the trap written down beside it.
