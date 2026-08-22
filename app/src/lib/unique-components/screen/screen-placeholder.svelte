<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Empty from "$lib/simple-components/empty";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * What a workspace shows where a framework surface will go.
   *
   * The three editors — document, slide deck, spreadsheet — are one region each,
   * and that region is ProseMirror, Fabric and Univer respectively. None is
   * installed. A placeholder that named the framework and said what it will do is
   * more honest than a drawn imitation nobody can tell from the real thing, and
   * it keeps the panels around it reviewable in the meantime.
   *
   * `simple-components/empty` underneath, because this is exactly what that
   * component is for: a centred, dashed, self-explaining stand-in for content
   * that is not there. Naming the framework is the part that is ours.
   */
  let {
    framework,
    children
  }: {
    /** What will live here. Named, because "coming soon" tells a reviewer nothing. */
    framework: string;
    /** What Icarus adds on top of it. */
    children: Snippet;
  } = $props();

  const trace = traceNode("ScreenPlaceholder", () => ({ framework }));
</script>

<div {...trace} class="bg-surface-canvas flex h-full min-h-0 items-center justify-center p-6">
  <Empty.Root class="border-border-strong bg-surface-panel rounded-panel max-w-md flex-none gap-2 border border-dashed">
    <Empty.Header class="gap-2">
      <Empty.Media class="text-caption text-ink-muted mb-0 font-semibold tracking-wide uppercase">
        The editor
      </Empty.Media>
      <Empty.Title class="text-body text-ink-primary font-medium">{framework}</Empty.Title>
      <Empty.Description class="text-body-sm text-ink-muted">
        {@render children()}
      </Empty.Description>
    </Empty.Header>
  </Empty.Root>
</div>
