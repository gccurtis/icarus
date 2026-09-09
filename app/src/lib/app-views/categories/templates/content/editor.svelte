<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";

  import { ScreenEmpty, ScreenNote, ScreenSurface } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import { EditorOpenState } from "$app-views/categories/templates/content/editor.state.svelte";
  import {
    templateLibrary,
    templatesIn
  } from "$app-views/categories/templates/procedures/library.svelte";
  import { synchronizeEditorOpen } from "$app-views/categories/templates/procedures/effects/editor-open.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = templateLibrary();
  const state = new EditorOpenState();

  const back = () => view.showContent("templates.library", view.active.focus);
  synchronizeEditorOpen({
    state,
    view,
    row: () => {
    const focus = view.active.focus;
      if (!library.ready || focus === undefined) return undefined;
      return templatesIn(library.current, Date.now()).find((candidate) => candidate.id === focus);
    }
  });
</script>

<ScreenSurface>
  <header class="editor-bar">
    <Button variant="ghost" size="sm" onclick={back}>
      <ArrowLeft aria-hidden="true" />
      Library
    </Button>
  </header>

  {#if state.refused !== undefined}
    <ScreenEmpty title="This template cannot be opened for editing" icon={FilePenLine}>
      {state.refused}
    </ScreenEmpty>
  {:else}
    <ScreenEmpty title="Opening the template in its editor" icon={FilePenLine}>
      A template is edited as a staged copy in the ordinary document or slide-deck editor. The
      editor's Templates panel saves the copy back or discards it.
    </ScreenEmpty>
  {/if}

  <ScreenNote tone="gap">
    Spreadsheet templates wait for the spreadsheet editor; their name, description, holes and
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
