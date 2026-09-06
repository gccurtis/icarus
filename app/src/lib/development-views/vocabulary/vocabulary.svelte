<script lang="ts">
  import { onMount } from "svelte";

  import Choosing from "$development-views/vocabulary/components/choosing.svelte";
  import Commented from "$development-views/vocabulary/components/commented.svelte";
  import Compositions from "$development-views/vocabulary/components/compositions.svelte";
  import DataShapes from "$development-views/vocabulary/components/data-shapes.svelte";
  import Dragging from "$development-views/vocabulary/components/dragging.svelte";
  import Editing from "$development-views/vocabulary/components/editing.svelte";
  import PanelFacts from "$development-views/vocabulary/components/panel-facts.svelte";
  import PanelParts from "$development-views/vocabulary/components/panel-parts.svelte";
  import PanelShapes from "$development-views/vocabulary/components/panel-shapes.svelte";
  import PanelValues from "$development-views/vocabulary/components/panel-values.svelte";
  import ScreenParts from "$development-views/vocabulary/components/screen-parts.svelte";
  import ScreenPlane from "$development-views/vocabulary/components/screen-plane.svelte";
  import VocabularyNav from "$development-views/vocabulary/components/vocabulary-nav.svelte";
  import { createCommentLog, provideCommentLog } from "$development-views/vocabulary/shared/comment-log.svelte";
  import { Separator } from "$vendored-components/separator";

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

<div class="flex min-h-0 flex-1">
  <VocabularyNav />

  <div class="flex w-full min-w-0 max-w-[86rem] flex-col gap-10 p-8">
  <div
    class="surface-veil border-border-subtle sticky top-11 z-10 -mx-8 -mt-8 flex flex-wrap items-center justify-between gap-3 border-b px-8 py-2"
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
    <header class="flex flex-col gap-4">
      <span class="surface-eyebrow">Celestial · composition</span>
      <h1 class="text-display tracking-display max-w-title m-0 font-semibold text-balance">
        Which shape holds it.
      </h1>
      <p class="font-reading text-body-lg leading-reading text-ink-secondary max-w-lede m-0">
        The design system says what a colour and a size are. This says what a <em>shape</em> is:
        given something to put on a screen, which of these holds it, and why that one rather than
        its neighbour.
      </p>
      <div class="surface-rail surface-rail-quiet max-w-prose p-3">
        <p class="text-body-sm text-ink-secondary m-0">
          Two families, because a panel is not a workspace. A flank is narrow and vertical; a
          workspace is the generous plane. Panel examples below are shown at a flank's real width —
          a shape that reads well across a plane and breaks in a flank is exactly what this page
          exists to catch.
        </p>
      </div>
    </header>
  </Commented>

  <div id="choosing" class="scroll-mt-16"><Choosing /></div>
  <Separator />
  <div id="panel-parts" class="scroll-mt-16"><PanelParts /></div>
  <Separator />
  <div id="editing" class="scroll-mt-16"><Editing /></div>
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
  <div id="panel-values" class="scroll-mt-16"><PanelValues /></div>
  <Separator />
  <div id="panel-facts" class="scroll-mt-16"><PanelFacts /></div>
  <Separator />
  <div id="panel-shapes" class="scroll-mt-16"><PanelShapes /></div>
  <Separator />
  <div id="screen-parts" class="scroll-mt-16"><ScreenParts /></div>
  <Separator />
  <div id="screen-plane" class="scroll-mt-16"><ScreenPlane /></div>
  <Separator />

  <div id="dragging" class="scroll-mt-16"><Dragging /></div>
  <Separator />
  <div id="compositions" class="scroll-mt-16"><Compositions /></div>
  <Separator />
  <div id="data-shapes" class="scroll-mt-16"><DataShapes /></div>
  </div>
</div>
