<script lang="ts">
  import type { Grid } from "$authored-components/reference/types";

  let { grid }: { grid: Grid } = $props();

  const mono = (index: number): boolean => (grid.mono ?? [0]).includes(index);
</script>

<div class="frame">
  <table>
    <thead>
      <tr>
        {#each grid.columns as column (column)}
          <th>{column}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each grid.rows as row, index (index)}
        <tr>
          {#each row as cell, at (at)}
            <td>{#if mono(at)}<code>{cell}</code>{:else}{cell}{/if}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
