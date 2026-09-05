<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";

  import { ScreenEmpty, ScreenNote, ScreenSurface } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import { workspaceState } from "$model/client/workspace-state";

  /**
   * Compatibility landing for workspace snapshots that still name `templates.editor`.
   *
   * Template authoring is not a fourth editor. The intended implementation stages a
   * represented body into the ordinary document/deck editor, flushes that runtime,
   * commits the resulting body with a template-revision check, then removes the stage.
   * That lifecycle needs a durable session record before it is safe across reload,
   * workspace undo, and reopened tabs, so this route states the boundary instead of
   * preserving the former 700-line session-local editor mock.
   */
  const view = workspaceState();
  const back = () => view.showContent("templates.library", view.active.focus);
</script>

<ScreenSurface>
  <header class="editor-bar">
    <Button variant="ghost" size="sm" onclick={back}>
      <ArrowLeft aria-hidden="true" />
      Library
    </Button>
  </header>

  <ScreenEmpty title="The editor shell is intentionally deferred" icon={FilePenLine}>
    This remains inside the Template category. A later pass can mount the ordinary document or
    slide-deck runtime beneath this quiet return bar without creating another workspace tab.
  </ScreenEmpty>

  <ScreenNote tone="gap">
    Name, description, variable help text, and tags autosave in the Inspector today. Body authoring
    still needs a collaborative edit-session identity, Template blocks for variable-bearing Prompt
    positions, and deterministic scratch cleanup after the editor flushes.
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
