<script lang="ts">
  import { onDestroy } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";

  import { ScreenEmpty, ScreenNote, ScreenSurface } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import {
    editTemplate,
    templateLibrary,
    templatesIn
  } from "$app-views/categories/templates/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = templateLibrary();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  let opening = $state<string | undefined>(undefined);
  let refused = $state<string | undefined>(undefined);

  const back = () => view.showContent("templates.library", view.active.focus);

  $effect(() => {
    const focus = view.active.focus;
    if (!library.ready || focus === undefined || opening !== undefined || refused !== undefined) return;
    const row = templatesIn(library.current, Date.now()).find((candidate) => candidate.id === focus);
    if (row === undefined) return;
    opening = row.id;
    void editTemplate(view, row).then(
      (result) => {
        if (!live) return;
        if (result.accepted) view.showContent("templates.library", focus);
        else refused = result.detail;
        opening = undefined;
      },
      (error: unknown) => {
        if (!live) return;
        refused = error instanceof Error ? error.message : String(error);
        opening = undefined;
      }
    );
  });
</script>

<ScreenSurface>
  <header class="editor-bar">
    <Button variant="ghost" size="sm" onclick={back}>
      <ArrowLeft aria-hidden="true" />
      Library
    </Button>
  </header>

  {#if refused !== undefined}
    <ScreenEmpty title="This template cannot be opened for editing" icon={FilePenLine}>
      {refused}
    </ScreenEmpty>
  {:else}
    <ScreenEmpty title="Opening the template in its editor" icon={FilePenLine}>
      A template is edited as a staged copy in the ordinary document or slide-deck editor. The
      editor's Templates panel saves the copy back or discards it.
    </ScreenEmpty>
  {/if}

  <ScreenNote tone="gap">
    Spreadsheet templates wait for the spreadsheet editor; their name, description, variables and
    tags still change in the Inspector.
  </ScreenNote>
</ScreenSurface>

<style>
  .editor-bar {
    display: flex;
    min-height: calc(var(--token-spacing-unit) * 8);
    align-items: center;
    border-bottom: 1px solid var(--token-border-subtle);
  }
</style>
