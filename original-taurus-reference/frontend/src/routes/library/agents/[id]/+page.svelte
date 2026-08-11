<script lang="ts">
  import AgentsConsole from '$lib/features/library/AgentsConsole.svelte';

  let { data }: { data: { personaId: string } } = $props();
</script>

<AgentsConsole personaId={data.personaId} />
