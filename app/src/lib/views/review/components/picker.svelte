<script lang="ts">
  import type { Entry } from "$views/review/shared/create-review.svelte";

  /**
   * Which one is on the stage.
   *
   * A native `select` with `optgroup`s rather than a listbox built out of the
   * panel vocabulary, and that is deliberate: this page is scaffolding around the
   * vocabulary and must not be made of it. A reviewer looking at a `PanelSelect`
   * on the stage should never be unsure whether the one above it is the same
   * component being reviewed.
   *
   * The groups are the subject directories, so the picker reads like the
   * specification tree it came from.
   */
  let {
    grouped,
    value,
    onselect
  }: {
    grouped: { subject: string; entries: Entry[] }[];
    value: string;
    onselect: (id: string) => void;
  } = $props();

  const total = $derived(grouped.reduce((count, group) => count + group.entries.length, 0));
</script>

<label class="flex items-center gap-2">
  <span class="text-caption text-ink-muted">Showing</span>
  <select
    class="border-border-subtle bg-surface-panel text-body-sm rounded-control border px-2 py-1"
    {value}
    onchange={(event) => onselect(event.currentTarget.value)}
  >
    {#each grouped as group (group.subject)}
      <optgroup label={group.subject}>
        {#each group.entries as entry (entry.id)}
          <option value={entry.id}>{entry.name}</option>
        {/each}
      </optgroup>
    {/each}
  </select>
  <span class="text-caption text-ink-muted tabular-nums">of {total}</span>
</label>
