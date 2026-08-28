<script lang="ts">
  import type { Snippet } from "svelte";

  import { Badge } from "$lib/components/vendor/badge";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * A small tinted label carrying a state or a category.
   *
   * `simple-components/badge` underneath, for its shape, its focus ring and its
   * icon sizing — but not for its variants. The registry thinks in default,
   * secondary, destructive and outline; this application thinks in the roles the
   * colour system names, and a chip that could not say `intelligence` or `active`
   * would push every caller into a literal colour. So the base is the registry's
   * and the palette is ours: one map from a role to its three tokens, and no
   * caller ever writing the third one.
   *
   * **State is never carried by colour alone.** A chip always has a word in it,
   * so the tint is a second channel rather than the only one.
   */
  let {
    tone = "neutral",
    children
  }: {
    tone?:
      | "neutral"
      | "success"
      | "danger"
      | "attention"
      | "inactive"
      | "interactive"
      | "active"
      | "intelligence"
      | "accent-1"
      | "accent-2";
    children: Snippet;
  } = $props();

  // The marker is forwarded through `Badge` onto the element it renders.
  const trace = traceNode("PanelChip", () => ({ tone }));

  /**
   * Whole class strings rather than an interpolated role name: Tailwind's
   * scanner reads source text, and `bg-${tone}-surface` is not text it can find.
   */
  const TONE: Record<NonNullable<typeof tone>, string> = {
    neutral: "bg-surface-panel border-border-subtle text-ink-secondary",
    success: "bg-success-surface border-success-border text-success-text",
    danger: "bg-danger-surface border-danger-border text-danger-text",
    attention: "bg-attention-surface border-attention-border text-attention-text",
    inactive: "bg-inactive-surface border-inactive-border text-inactive-text",
    interactive: "bg-interactive-surface border-interactive-border text-interactive-text",
    active: "bg-active-surface border-active-border text-active-text",
    intelligence: "bg-intelligence-surface border-intelligence-border text-intelligence-text",
    "accent-1": "bg-accent-1-surface border-accent-1-border text-accent-1-text",
    "accent-2": "bg-accent-2-surface border-accent-2-border text-accent-2-text"
  };
</script>

<!--
  `outline` is the variant that paints nothing of its own, so the role map is
  the only thing colouring this. The overrides are the panel's shape: a control
  radius rather than a pill, and caption rather than the registry's own step.
-->
<Badge
  {...trace}
  variant="outline"
  class={cn("text-caption rounded-control border px-1.5 py-0.5 font-normal", TONE[tone])}
>
  {@render children()}
</Badge>
