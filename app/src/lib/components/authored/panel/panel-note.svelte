<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * A line of explanation under what it explains.
   *
   * Panels in this application say why. A rule that is not obvious, a control
   * that is absent on purpose, a count that means something narrower than it
   * looks — each is a sentence rather than a thing the reader has to infer, and
   * this is where those sentences are set.
   *
   * **`gap` is not decoration.** It marks something the model cannot store yet,
   * so a panel can draw a surface without implying the surface works. Keeping it
   * visually distinct from ordinary explanation is what stops a permanent
   * limitation reading as a passing hint.
   */
  let {
    tone = "muted",
    children
  }: {
    tone?: "muted" | "gap";
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelNote", () => ({ tone }));
</script>

<p
  {...trace}
  class={cn(
    "text-caption m-0 px-3 py-1",
    tone === "muted" && "text-ink-muted",
    tone === "gap" &&
      "border-attention-border bg-attention-surface text-attention-text rounded-control border border-dashed px-2 py-1.5"
  )}
>
  {@render children()}
</p>
