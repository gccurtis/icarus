<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";

  import { Button } from "$vendored-components/button";
  import { workspaceState, type SpreadsheetRuntime, type SyncState } from "$model/client/workspace-state";

  let {
    notice
  }: {
    /** What the last refused gesture said, if anything. */
    notice?: string;
  } = $props();

  const view = workspaceState();
  const zoom = $derived(view.zoom ?? 100);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    const id = view.active.resourceId;
    runtime = id === undefined ? undefined : view.spreadsheetRuntime(id);
  });

  const SYNC_LABEL: Record<SyncState, string> = {
    loading: "Loading",
    saved: "Saved",
    saving: "Saving",
    rebasing: "Rebasing",
    "needs-review": "Needs review",
    offline: "Offline",
    error: "Not saved"
  };

  const ZOOM_STEP = 10;
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;

  const clamped = (value: number): number =>
    Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)));
</script>

<div class="area-strip bg-surface-panel border-border-subtle flex items-center gap-2 border-t">
  {#if notice}
    <span class="text-caption text-attention-text min-w-0 truncate">{notice}</span>
  {/if}
  <span class="ms-auto flex shrink-0 items-center gap-1">
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Undo"
      title="Undo"
      disabled={!runtime?.canUndo}
      onclick={() => runtime?.undo()}
    >
      <Undo2 aria-hidden="true" />
    </Button>
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Redo"
      title="Redo"
      disabled={!runtime?.canRedo}
      onclick={() => runtime?.redo()}
    >
      <Redo2 aria-hidden="true" />
    </Button>
    <span class="border-border-subtle mx-1 h-4 border-l" aria-hidden="true"></span>
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Zoom out"
      onclick={() => view.setZoom(clamped(zoom - ZOOM_STEP))}
    >
      <Minus aria-hidden="true" />
    </Button>
    <button
      type="button"
      class="text-caption text-ink-secondary hover:text-ink-primary rounded-control w-12 tabular-nums"
      title="Back to 100%"
      onclick={() => view.setZoom(100)}
    >
      {zoom}%
    </button>
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Zoom in"
      onclick={() => view.setZoom(clamped(zoom + ZOOM_STEP))}
    >
      <Plus aria-hidden="true" />
    </Button>
    <span class="text-caption text-ink-muted ms-2">· {SYNC_LABEL[runtime?.sync ?? "loading"]}</span>
  </span>
</div>

<style>
  .area-strip {
    min-width: 0;
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 3);
  }
</style>
