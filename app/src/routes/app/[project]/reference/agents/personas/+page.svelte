<script lang="ts">
  import { page } from "$app/state";

  import PagePersonas from "$development-views/agents-reference/components/page-personas.svelte";
</script>

<PagePersonas project={page.params.project ?? ""} />
