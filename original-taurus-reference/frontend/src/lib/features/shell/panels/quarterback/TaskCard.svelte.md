# TaskCard.svelte

The spawned task card and, for Plan mode, the reviewable plan. Renders nothing without
`$aiAgent.activeTask` — the transcript simply has no card.

**The task card**: the task's mode ("Task · Plan" / "Task · Action"), its objective, and a
state badge via `taskLabels`/`taskTones` from [`helpers.ts`](helpers.ts.md). A failure message
gets its own danger-toned row; the working list renders each todo with its `todoMarks` glyph,
done items struck through.

**The plan card** (`task.plan`): title with an Accepted/Draft badge, optional summary, numbered
steps, and — while still a draft — the real **Accept plan** action (`acceptAiPlan()`, a real
Omega call, not a local flag).
