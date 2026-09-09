<script lang="ts">
  import { page } from "$app/state";

  import PageResearchChat from "$development-views/agents-reference/components/page-research-chat.svelte";
</script>

<PageResearchChat project={page.params.project ?? ""} />
