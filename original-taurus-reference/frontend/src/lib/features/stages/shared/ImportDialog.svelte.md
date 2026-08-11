# src/lib/features/stages/shared/ImportDialog.svelte — breakdown

Companion to [ImportDialog.svelte](ImportDialog.svelte). The **import** modal opened
from the resource table's Name-column button: pick or drop a file, then Import.
**Mock** — no real ingestion yet; it passes only the selected file's base name through
`onimport(name)`. Current stage handlers report that import is unavailable and never
upload bytes or create a resource.

## Script

### File state and the confirm/drop handlers

```svelte
<script lang="ts">
  import { Upload } from '@lucide/svelte';
  import { Modal, Button, Badge, MockBadge } from '$lib/components';

  let { open = $bindable(false), onimport }: { open?: boolean; onimport: (name: string) => void } = $props();

  let file = $state<File | null>(null);
  let input = $state<HTMLInputElement>();

  // Reset the picked file each time the dialog opens.
  $effect(() => {
    if (open) file = null;
  });

  function pick(e: Event) {
    file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    file = e.dataTransfer?.files?.[0] ?? file;
  }
  function confirm() {
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '') || 'Imported';
    onimport(name);
    open = false;
  }
</script>
```

`open` is the bindable flag; `onimport(name)` hands the chosen file's base name back to
the calling stage. `file` holds the picked/dropped file (reset on open); `pick` reads
the file input, `drop` reads a drag-drop; `confirm` strips the extension and fires the
callback. No file bytes leave this component.

## Markup

### Drop zone, hidden input, and actions

```svelte

<Modal bind:open title="Import" size="md">
  <div class="space-y-4">
    <p class="flex items-center gap-2 text-caption text-muted">
      <MockBadge />
      Import isn't wired to Omega yet — selecting a file does not upload its bytes.
    </p>

    <button
      type="button"
      onclick={() => input?.click()}
      ondragover={(e) => e.preventDefault()}
      ondrop={drop}
      class="dur-small flex w-full flex-col items-center gap-2 rounded-panel border border-dashed border-border-strong bg-panel/40 px-4 py-8 text-center transition-colors hover:bg-panel"
    >
      <Upload class="size-6 text-muted" />
      {#if file}
        <span class="text-body-sm font-medium text-primary">{file.name}</span>
      {:else}
        <span class="text-body-sm text-secondary">Click to choose a file</span>
        <span class="text-caption text-muted">or drag it here</span>
      {/if}
    </button>
    <input bind:this={input} type="file" class="hidden" onchange={pick} />

    <div class="flex justify-end gap-2">
      <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
      <Button variant="primary" onclick={confirm} disabled={!file}>Import</Button>
    </div>
  </div>
</Modal>
```

A **Mock** disclaimer, a dashed **drop zone** (click to open the hidden file input, or
drop a file — it shows the chosen filename), and Cancel / Import buttons (Import
disabled until a file is chosen).
