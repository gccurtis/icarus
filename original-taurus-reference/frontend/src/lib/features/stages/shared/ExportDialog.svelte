<script lang="ts">
  import { Download } from '@lucide/svelte';
  import { Modal, Button, SegmentedControl } from '$lib/components';
  import { exportFormats } from '$lib/features/shared/transfer';

  let {
    open = $bindable(false),
    count = 0,
    onconfirm
  }: { open?: boolean; count?: number; onconfirm: (format: string) => void } = $props();

  // The same shared table the editor's Export menu and the row download menu
  // read, so all three offer one format set. The old list here was invented
  // (Markdown / JSON / Taurus) and matched nothing else in the app.
  let format = $state('md');
  const formats = exportFormats.map((f) => ({ value: f.id, label: f.label.replace(' — soon', '') }));
  const chosen = $derived(exportFormats.find((f) => f.id === format));

  function confirm() {
    onconfirm(format);
    open = false;
  }
</script>

<Modal bind:open title="Export selected" size="md">
  <div class="space-y-4">
    <p class="text-body-sm text-secondary">
      Exporting <span class="font-medium text-primary">{count}</span> resource{count === 1 ? '' : 's'}.
    </p>
    <div>
      <p class="mb-1.5 text-label font-medium text-secondary">Format</p>
      <SegmentedControl bind:value={format} segments={formats} />
      {#if chosen && !chosen.built}
        <p class="mt-1.5 text-caption text-attention">
          {chosen.name} export isn’t built yet — only Markdown produces a file today.
        </p>
      {:else}
        <p class="mt-1.5 text-caption text-muted">
          Downloads the real content of each document. Other resource kinds are skipped.
        </p>
      {/if}
    </div>
    <div class="flex justify-end gap-2">
      <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
      <Button variant="primary" onclick={confirm}><Download class="size-4" /> Export</Button>
    </div>
  </div>
</Modal>
