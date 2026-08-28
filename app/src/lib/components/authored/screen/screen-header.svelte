<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$components/development/trace.svelte";

  /**
   * A screen's title, what it is for, and the one thing you make here.
   *
   * The subtitle is not decoration. On every singleton screen it carries the rule
   * that is otherwise invisible — that there is one Research tab and not one per
   * thread, that a run is a dispatch, that a template hands back an independent
   * copy. Those sentences are the cheapest place in the application to say a
   * thing that would otherwise be learned by being surprised.
   */
  let {
    title,
    about,
    actions
  }: {
    title: string;
    /** One sentence. The rule this screen keeps, or what it is for. */
    about?: string;
    actions?: Snippet;
  } = $props();

  const trace = traceNode("ScreenHeader", () => ({ title, about }));
</script>

<header {...trace} class="flex flex-wrap items-start justify-between gap-4">
  <div class="flex min-w-0 flex-col gap-1">
    <h1 class="text-h3 leading-h3 m-0 font-semibold tracking-tight">{title}</h1>
    {#if about}
      <p class="text-body-sm text-ink-muted m-0 max-w-prose">{about}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
  {/if}
</header>
