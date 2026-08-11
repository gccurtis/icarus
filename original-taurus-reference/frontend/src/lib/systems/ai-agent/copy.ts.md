# src/lib/systems/ai-agent/copy.ts — breakdown

Companion to [copy.ts](copy.ts). The dock's static presentation data: the mode
selector options, the per-mode placeholder + cue strings, and the context-source
toggle descriptors. Keeping this copy in one module lets the composer and the panel
share exactly the same labels, and lets the `wired` flags declare which context
sources actually reach the backend today.

## Imports

### Import the mode and context-source types

```ts
import type { AiMode, AiContextSource, AiContextSourceId } from './types';

```

Type-only import of the three shapes this module produces literals for. The trailing
blank line separates the import from the first export.

## Mode options

### The Ask / Action / Plan selector options

```ts
export const aiModeOptions = [
  { value: 'ask', label: 'Ask' },
  { value: 'action', label: 'Action' },
  { value: 'plan', label: 'Plan' }
] as const;

```

`aiModeOptions` is the ordered list the mode selector renders. It is declared
`as const` so each `value` narrows to its literal mode string, letting consumers index
`aiModeCopy` and the tone maps without casting.

## Mode copy

### Per-mode composer placeholder and cue text

```ts
export const aiModeCopy: Record<AiMode, { placeholder: string; cue: string }> = {
  ask: {
    placeholder: 'Ask about this document…',
    cue: 'Answer from the document and its working context, with trace when useful.'
  },
  action: {
    placeholder: 'Describe a change to make…',
    cue: 'Make a direct edit when possible; route larger work through Tasks.'
  },
  plan: {
    placeholder: 'Describe the outcome to plan…',
    cue: 'Turn an outcome into a reviewable sequence without leaving the document.'
  }
};

```

`aiModeCopy` maps each mode to its input `placeholder` and a one-line `cue` describing
what that mode does. The composer shows the placeholder in the bar; the panel shows the
cue under the mode heading. Typing it as a `Record<AiMode, …>` guarantees all three
modes are covered.

## Context source options

### The four context-toggle descriptors with their wired flags

```ts
export const aiContextSourceOptions: AiContextSource[] = [
  {
    id: 'document',
    label: 'Document',
    detail: 'The open document and its current content',
    wired: true
  },
  {
    id: 'selection',
    label: 'Current selection',
    detail: 'Surfaced for review; not yet sent to the agent',
    wired: false
  },
  {
    id: 'knowledge',
    label: 'All knowledge',
    detail: 'Surfaced for review; not yet sent to the agent',
    wired: false
  },
  {
    id: 'sources',
    label: 'Linked sources',
    detail: 'Surfaced for review; not yet sent to the agent',
    wired: false
  }
];
```

`aiContextSourceOptions` is the grid the context picker renders. Only `document` is
`wired: true` — the one source that actually reaches the backend today — so the other
three carry the honest "Surfaced for review; not yet sent to the agent" detail and get
a mock badge in the UI. This is the single place that declares which context toggles
are real versus aspirational.
