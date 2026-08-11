# src/lib/features/shell/Wordmark.svelte — breakdown

Companion to [Wordmark.svelte](Wordmark.svelte). The centered brand mark in the top
bar — deliberately faint, and the single swap-point for a stylized logo/font later.

## Script

### Import the class combiner and accept an optional class prop

```svelte
<script lang="ts">
  // The centered brand mark in the top bar. Deliberately faint for now — this is
  // the single place to swap in a stylized logo / display font later (drop the
  // logo here and the top bar picks it up unchanged).
  import { cn } from '$lib/utils';

  let { class: className = '' }: { class?: string } = $props();
</script>

```

The script does almost nothing by design: it imports the `cn` class-combiner and
declares a single optional `class` prop. The comment marks this component as the one
place to later drop in a real logo or display font — callers keep rendering
`<Wordmark />` unchanged.

## Markup

### The dimmed, wide-tracked lowercase wordmark

```svelte
<span
  class={cn(
    'select-none font-mono text-caption lowercase tracking-[0.3em] text-muted/50',
    className
  )}
>
  taurus
</span>
```

A `<span>` whose classes (merged via `cn` with any caller-supplied `className`) make
it non-selectable, monospace, caption-sized, lowercase, widely letter-spaced, and
dimmed to half-opacity muted. The literal text is the lowercase wordmark `taurus`.
