<script lang="ts">
  import { page } from "$app/state";

  import PageExplore from "$development-views/agents-reference/components/page-explore.svelte";
</script>

<PageExplore project={page.params.project ?? ""} />
