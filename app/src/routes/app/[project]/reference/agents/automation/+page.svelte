<script lang="ts">
  import { page } from "$app/state";

  import PageAutomation from "$development-views/agents-reference/components/page-automation.svelte";
</script>

<PageAutomation project={page.params.project ?? ""} />
