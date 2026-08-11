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
