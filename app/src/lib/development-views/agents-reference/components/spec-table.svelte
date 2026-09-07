<script lang="ts">
  import NoteBox from "$development-views/agents-reference/components/note-box.svelte";

  let {
    label,
    columns,
    rows,
    mono = [],
    pills = [],
    noted
  }: {
    label: string;
    columns: readonly string[];
    rows: readonly (readonly string[])[];
    mono?: readonly number[];
    pills?: readonly number[];
    noted?: string;
  } = $props();

  const pillClass = (value: string): string => value.toLowerCase().replace(/[^a-z]+/g, "-");
</script>

<div class="ar-frame">
  <div class="scroll">
    <table class="ar-table" aria-label={label}>
      <thead>
        <tr>
          {#each columns as column (column)}
            <th>{column}</th>
          {/each}
          {#if noted}<th class="ar-gutter">Notes</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, index (index)}
          <tr>
            {#each row as cell, at (at)}
              <td class:ar-mono={mono.includes(at)}>
                {#if pills.includes(at) && cell !== ""}
                  <span class="ar-pill {pillClass(cell)}">{cell}</span>
                {:else}
                  {cell}
                {/if}
              </td>
            {/each}
            {#if noted}
              <td class="ar-gutter"><NoteBox scope={noted} label={row[0] ?? String(index)} /></td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .scroll {
    overflow-x: auto;
  }
</style>
