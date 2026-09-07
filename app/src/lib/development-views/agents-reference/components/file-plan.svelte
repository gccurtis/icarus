<script lang="ts">
  import NoteBox from "$development-views/agents-reference/components/note-box.svelte";
  import { AREA_LABEL, FILES, PHASES } from "$development-views/agents-reference/procedures/plan";
  import type { Area } from "$development-views/agents-reference/types";

  let { phases = PHASES.map((phase) => phase.n) }: { phases?: readonly number[] } = $props();

  let area = $state<Area | "all">("all");

  const AREAS = Object.keys(AREA_LABEL) as Area[];

  const shown = $derived(FILES.filter((file) => area === "all" || file.area === area));

  const count = (status: "create" | "modify" | "delete") =>
    shown.filter((file) => file.status === status).length;
</script>

<div class="plan">
  <div class="controls" role="group" aria-label="Filter by area">
    <button type="button" class:on={area === "all"} onclick={() => (area = "all")}>
      All <span>{FILES.length}</span>
    </button>
    {#each AREAS as candidate (candidate)}
      {@const n = FILES.filter((file) => file.area === candidate).length}
      <button type="button" class:on={area === candidate} onclick={() => (area = candidate)}>
        {AREA_LABEL[candidate]} <span>{n}</span>
      </button>
    {/each}
    <span class="totals">
      <span class="ar-pill create">create {count("create")}</span>
      <span class="ar-pill modify">modify {count("modify")}</span>
      <span class="ar-pill delete">delete {count("delete")}</span>
    </span>
  </div>

  <div class="ar-frame">
    <table class="ar-table" aria-label="Planned files">
      <thead>
        <tr>
          <th>Path</th>
          <th>Change</th>
          <th>Area</th>
          <th>What it is for</th>
          <th class="ar-gutter">Notes</th>
        </tr>
      </thead>
      <tbody>
        {#each PHASES.filter((phase) => phases.includes(phase.n)) as phase (phase.n)}
          {@const files = shown.filter((file) => file.phase === phase.n)}
          {#if files.length > 0}
            <tr class="phase">
              <td colspan="5">
                <span class="n">Phase {phase.n}</span>
                <strong>{phase.title}</strong>
                <span class="produces">{phase.produces}</span>
              </td>
            </tr>
            {#each files as file (file.path)}
              <tr>
                <td class="ar-mono path">{file.path}</td>
                <td><span class="ar-pill {file.status}">{file.status}</span></td>
                <td>{AREA_LABEL[file.area]}</td>
                <td>{file.purpose}</td>
                <td class="ar-gutter"><NoteBox scope="file" label={file.path} /></td>
              </tr>
            {/each}
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .plan {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }

  .controls button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    cursor: pointer;
    font-size: var(--token-text-caption);
  }

  .controls button span {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
  }

  .controls button.on {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .totals {
    display: flex;
    gap: 0.35rem;
    margin-left: auto;
  }

  .phase td {
    padding-top: 0.9rem;
    background: var(--token-surface-panel);
    color: var(--token-ink-primary);
  }

  .phase .n {
    margin-right: 0.6rem;
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    letter-spacing: var(--token-tracking-caps);
    text-transform: uppercase;
  }

  .phase strong {
    font-weight: var(--token-weight-strong);
  }

  .phase .produces {
    display: block;
    margin-top: 0.2rem;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: var(--token-weight-regular);
  }

  .path {
    overflow-wrap: anywhere;
  }
</style>
