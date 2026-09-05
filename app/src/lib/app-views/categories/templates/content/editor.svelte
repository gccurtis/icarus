<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";

  import { ScreenEmpty, ScreenHeader, ScreenNote, ScreenSurface } from "$authored-components/screen";
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
  <ScreenHeader title="Template authoring">
    {#snippet actions()}
      <Button variant="outline" size="sm" onclick={back}>
        <ArrowLeft aria-hidden="true" />
        Back to library
      </Button>
    {/snippet}
  </ScreenHeader>

  <ScreenEmpty title="Templates use the regular editors" icon={FilePenLine}>
    Document and slide-deck templates will be staged into their ordinary editors rather than
    maintained in a separate authoring surface.
  </ScreenEmpty>

  <ScreenNote tone="gap">
    Safe authoring still needs a represented edit-session identity so a staged resource can resume
    after reload and be cleaned up without breaking workspace undo or racing an unfinished save.
  </ScreenNote>
</ScreenSurface>
