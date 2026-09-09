<script lang="ts">
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Plus from "@lucide/svelte/icons/plus";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";
  import Table from "@lucide/svelte/icons/table";

  import { ScreenAction } from "$authored-components/screen";

  const COLUMNS = ["Feeder", "Customer-minutes", "Share", "Events"];

  const ROWS = [
    ["Ridgeway 12", "1,284,900", "41%", "2"],
    ["Halloway 4", "612,400", "20%", "1"],
    ["Bramfield tie", "402,100", "13%", "1"],
    ["Selby 9", "188,700", "6%", "3"],
    ["All others", "624,300", "20%", "11"]
  ];

  const BARS = [96, 46, 30, 14, 47];
</script>

<div class="response">
  <p class="said">
    Three feeders account for three quarters of the customer-minutes lost in January. Ridgeway 12
    alone carries 41 per cent of them, and it is the only one of the three that failed twice in the
    same week.
  </p>

  <figure class="made">
    <figcaption>
      <Table class="text-intelligence-text size-4" aria-hidden="true" />
      <div>
        <strong>Customer-minutes by feeder, January</strong>
        <span>Made from the outage register · 318 rows</span>
      </div>
      <div class="actions">
        <ScreenAction label="Add" icon={Plus} onclick={() => {}} />
        <ScreenAction label="Open" icon={SquareArrowOutUpRight} onclick={() => {}} />
      </div>
    </figcaption>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            {#each COLUMNS as column, index (column)}
              <th class:numeric={index > 0}>{column}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each ROWS as row (row[0])}
            <tr>
              {#each row as cell, index (index)}
                <td class:numeric={index > 0}>{cell}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </figure>

  <figure class="made">
    <figcaption>
      <ChartColumn class="text-intelligence-text size-4" aria-hidden="true" />
      <div>
        <strong>The same table, as the chart the data asks for</strong>
        <span>Not built · one categorical column and one measure means bars</span>
      </div>
      <div class="actions">
        <ScreenAction label="Add" icon={Plus} onclick={() => {}} />
        <ScreenAction label="Open" icon={SquareArrowOutUpRight} onclick={() => {}} />
      </div>
    </figcaption>
    <div class="chart" role="img" aria-label="Five bars, the first far taller than the rest">
      {#each BARS as height, index (index)}
        <div class="bar">
          <span style:height="{height}%"></span>
          <small>{ROWS[index][0]}</small>
        </div>
      {/each}
    </div>
  </figure>
</div>

<style>
  .response {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.75rem;
    background: var(--token-surface-work);
  }

  .said {
    max-width: var(--token-measure-prose);
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
  }

  .made {
    display: flex;
    max-width: 46rem;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    padding: 1rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
  }

  figcaption {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  figcaption > div:first-of-type {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
  }

  figcaption strong {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    font-weight: var(--token-weight-medium);
  }

  figcaption span {
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
  }

  .actions {
    display: flex;
    flex: none;
    gap: 0.35rem;
  }

  .scroll {
    overflow-x: auto;
    scrollbar-width: thin;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--token-text-body-sm);
  }

  th {
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--token-border-strong);
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
    font-weight: var(--token-weight-strong);
    letter-spacing: var(--token-tracking-caps);
    text-align: start;
    text-transform: uppercase;
    white-space: nowrap;
  }

  td {
    padding: 0.45rem 0.75rem;
    border-bottom: 1px solid var(--token-border-subtle);
    color: var(--token-ink-secondary);
  }

  tr:last-child td {
    border-bottom: 0;
  }

  td:first-child {
    color: var(--token-ink-primary);
  }

  .numeric {
    font-variant-numeric: tabular-nums;
    text-align: end;
  }

  .chart {
    display: flex;
    height: 9rem;
    align-items: flex-end;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .bar {
    display: flex;
    height: 100%;
    flex: 1;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .bar span {
    display: block;
    border-radius: 2px 2px 0 0;
    background: var(--token-color-intelligence-fill);
  }

  .bar small {
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
    text-align: center;
  }
</style>
