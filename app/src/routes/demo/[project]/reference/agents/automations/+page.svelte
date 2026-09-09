<script lang="ts">
  import { page } from "$app/state";

  import PageAutomations from "$development-views/agents-reference/components/page-automations.svelte";
</script>

<PageAutomations project={page.params.project ?? ""} />
