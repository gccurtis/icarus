# `PersonalitySpace.svelte` — the definition over the receipts

The work surface for one personality: what it runs as, above what it has actually done.

## The definition is the substance

```svelte
<h2>Definition <Badge>… v{personality.version}</Badge></h2>
<Button variant="ghost" …>Save as new revision</Button>
```

Four fields mirroring Omega's `PersonaDefinition` one for one — Focus, Behavioral guidance,
Output preferences, Verification — each with a one-line hint saying what the field *means*
("the contract every task inherits"), because these are authored by people who should not need
the backend docs. Edits become a **new version**, never a silent rewrite: Omega's
`personas.revise` machinery is real, a task records the version it ran as, and the badge keeps
that model visible. The save action toasts until wired.

## Working on the definition releases the task

```svelte
<section onfocusin={ondefinitionfocus} …>
```

The work surface holds **one** selection, and putting the caret in the definition means you have
selected the personality — not a task. Without this, editing Focus while a task from the history was
still selected left the panel describing that task and, worse, left the AI bar pointed at its agent:
you would have typed a note to yourself and sent it into a running task.

`onfocusin` rather than a click, so arriving by keyboard counts too. The console handles it by
clearing the selection, which flips the panel back to the personality's Details and the bar's second
tab back to **New agent**.

## Task history is the accountability half

The same container + [`TaskList`](TaskList.svelte.md) rows as the monitor (minus the redundant
personality byline), bounded to roughly five rows. It mirrors Omega's real
`GET /personas/:personaID/tasks` — a personality page that showed only the definition would be a
form; showing what it has done is what makes editing the definition feel consequential.

## Room for the AI bar

The outer column carries `pb-24` so [`LibraryQuarterback`](LibraryQuarterback.svelte.md), which
anchors to the foot of the work surface, never covers this space's last row.
