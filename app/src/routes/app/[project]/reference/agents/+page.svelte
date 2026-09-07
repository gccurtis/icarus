<script lang="ts">
  import { page } from "$app/state";

  import AgentsReference from "$development-views/agents-reference/agents-reference.svelte";
</script>

<AgentsReference project={page.params.project ?? ""} />
