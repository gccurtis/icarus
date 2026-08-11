<script lang="ts">
  import { StatePill } from '$lib/components';
  import { TASK_PILL, personalityById, type AgentTask } from './agents-mock';

  // The one task-row grammar, shared by the Activity monitor and a personality's
  // history so a task looks the same everywhere: state pill, objective, where it
  // runs, who it runs as, freshness. Selection is a detail-panel concern — the
  // row only reports the click.
  let {
    tasks,
    selectedId,
    onselect,
    showPersonality = true
  }: {
    tasks: AgentTask[];
    selectedId: string | null;
    onselect: (id: string) => void;
    showPersonality?: boolean;
  } = $props();
</script>

{#each tasks as t (t.id)}
  {@const pill = TASK_PILL[t.state]}
  <button
    onclick={() => onselect(t.id)}
    class="dur-micro grid w-full grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-0 {selectedId ===
    t.id
      ? 'bg-selection'
      : 'hover:bg-elevated'}"
  >
    <StatePill state={pill.state} label={pill.label} />
    <span class="min-w-0">
      <span class="block truncate text-body-sm text-primary">{t.objective}</span>
      <span class="block truncate text-caption text-muted">
        {t.project}
        {#if showPersonality}· {personalityById(t.personalityId)?.name}{/if}
        · {t.mode}
      </span>
    </span>
    <span class="whitespace-nowrap text-caption text-muted">{t.updated}</span>
  </button>
{/each}
