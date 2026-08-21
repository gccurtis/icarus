<script lang="ts">
  import { onMount } from "svelte";

  import Choosing from "$views/vocabulary/components/choosing.svelte";
  import Commented from "$views/vocabulary/components/commented.svelte";
  import Compositions from "$views/vocabulary/components/compositions.svelte";
  import DataShapes from "$views/vocabulary/components/data-shapes.svelte";
  import Dragging from "$views/vocabulary/components/dragging.svelte";
  import Editing from "$views/vocabulary/components/editing.svelte";
  import PanelFacts from "$views/vocabulary/components/panel-facts.svelte";
  import PanelParts from "$views/vocabulary/components/panel-parts.svelte";
  import PanelShapes from "$views/vocabulary/components/panel-shapes.svelte";
  import PanelValues from "$views/vocabulary/components/panel-values.svelte";
  import ScreenParts from "$views/vocabulary/components/screen-parts.svelte";
  import ScreenPlane from "$views/vocabulary/components/screen-plane.svelte";
  import { createCommentLog, provideCommentLog } from "$views/vocabulary/shared/comment-log.svelte";
  import { Separator } from "$lib/simple-components/separator";

  /**
   * The composition vocabulary, rendered at `/demo/vocabulary`.
   *
   * A companion to `/demo`, and a deliberately different kind of page. The design
   * system reference answers "what colour, what size, what radius". This one
   * answers the question above that: given something to put on a screen, which
   * shape holds it.
   *
   * **It is a reference, not a mock.** Nothing here pretends to work. The sample
   * content is illustrative and obvious, and the last section says, form by form,
   * what a real one would have to ask the backend for and whether that question
   * can be answered yet. A page that showed convincing fake data would be making
   * exactly the claim this page exists to avoid.
   *
   * **The right column is the review gutter.** Every row carries a note box, and
   * a note is written to a file on disk the moment it is entered — the page is
   * read once, argued with a row at a time, and a thought that needs a second
   * gesture to keep is one that does not get written down.
   */
  const log = createCommentLog("/demo/vocabulary/comments");
  provideCommentLog(log);

  // A read rather than an effect: nothing on the page changes what is loaded, so
  // this runs once on mount and never again.
  onMount(() => {
    void log.load();
  });
</script>

<svelte:head>
  <title>Composition vocabulary — Icarus</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-[86rem] flex-col gap-10 p-8">
  <div
    class="border-border-subtle bg-surface-canvas sticky top-0 z-10 -mx-8 -mt-8 flex flex-wrap items-center justify-between gap-3 border-b px-8 py-2"
  >
    <span class="text-caption text-ink-muted">
      Notes go in the right-hand column. Enter saves; nothing is kept in the browser.
    </span>
    <span class="text-caption flex items-center gap-3">
      {#if log.status === "unavailable"}
        <span class="text-danger-text">
          The log is unreachable — notes will not save.
        </span>
      {:else if log.status === "ready"}
        <span class="text-ink-muted font-mono">{log.path}</span>
      {/if}
      <span class="text-ink-secondary tabular-nums">
        {log.total}
        {log.total === 1 ? "note" : "notes"}
      </span>
    </span>
  </div>

  <Commented scope="section" label="Composition vocabulary">
    <header class="flex flex-col gap-3">
      <a href="/demo" class="text-caption text-interactive-text w-fit hover:underline">
        ← Design system
      </a>
      <h1 class="text-h1 font-semibold">Composition vocabulary</h1>
      <p class="text-body text-ink-secondary max-w-[70ch]">
        The design system says what a colour and a size are. This says what a
        <em>shape</em> is: given something to put on a screen, which of these holds
        it, and why that one rather than its neighbour.
      </p>
      <p class="text-body-sm text-ink-muted max-w-[70ch]">
        Two families, because a panel is not a workspace. A flank is 300px and
        vertical; a workspace is the generous plane. Panel examples below are shown
        at 300px — a shape that reads well at 800 and breaks at 300 is exactly what
        this page exists to catch.
      </p>
    </header>
  </Commented>

  <Choosing />
  <Separator />
  <PanelParts />
  <Separator />
  <Editing />
  <Separator />

  <!--
    The four sections the second pass added, in the order a reader meets them:
    the controls, then what a panel shows without asking, then the shapes that
    carry order and change, then the plane.

    They sit after `Editing` rather than at the end because they are more of the
    same two families, and a reader looking for a field should find every field
    in one stretch. The three sections after them are compositions and questions
    about data, which are a different kind of thing.
  -->
  <PanelValues />
  <Separator />
  <PanelFacts />
  <Separator />
  <PanelShapes />
  <Separator />
  <ScreenParts />
  <Separator />
  <ScreenPlane />
  <Separator />

  <Dragging />
  <Separator />
  <Compositions />
  <Separator />
  <DataShapes />
</div>
