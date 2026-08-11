# src/lib/features/stages/shared/ExportDialog.svelte — breakdown

Companion to [ExportDialog.svelte](ExportDialog.svelte). The **export** modal opened from the
resource table's selection bar: pick a format and export the checked resources. It is **not**
a mock — the table's `onconfirm` runs the real per-kind exporters and downloads actual
document content, skipping kinds that have no exporter yet.

## Script

### Count, the shared format list, and confirm

```svelte
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
```

`open` is the bindable flag, `count` is how many resources are selected (for display), and
`onconfirm(format)` runs the actual export back in the table. `format` holds the chosen format
id — a real choice now, not decoration — and defaults to `'md'`, the only format with a
serializer.

The segments come straight from `exportFormats`, the shared per-kind transfer table's format
list, so this dialog, the editor's Export menu, and the row Download menu cannot offer
different sets. The one local adjustment is cosmetic: `label.replace(' — soon', '')` strips the
suffix each unbuilt format carries in its label, because a segmented control's segments are
too narrow for it — the same warning is delivered below the control instead, once the user has
actually picked one. `chosen` resolves the selected id back to its full format record so the
markup can branch on `built`.

## Markup

### Count, format picker, the honesty line, and actions

```svelte
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
```

The selected count, a `SegmentedControl` format picker fed by the shared list, one line of
copy under it, and Cancel / Export buttons.

That line under the picker is the dialog's whole disclosure, and it swaps with the choice.
Pick an unbuilt format and it turns `text-attention` and names it — "PDF export isn’t built
yet" — so the answer arrives at pick time rather than after a confirm. Pick Markdown and it
states the two things worth knowing about a bulk export: the content is real, and resource
kinds with no exporter are skipped rather than silently failing.

There is no `MockBadge` here any more. It was correct while the confirm downloaded a
placeholder per resource; now that the table runs the genuine per-kind exporters, a mock
marker would be the misleading label.
