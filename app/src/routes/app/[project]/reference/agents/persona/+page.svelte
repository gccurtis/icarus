<script lang="ts">
  import { page } from "$app/state";

  import PagePersona from "$development-views/agents-reference/components/page-persona.svelte";
</script>

<PagePersona project={page.params.project ?? ""} />
