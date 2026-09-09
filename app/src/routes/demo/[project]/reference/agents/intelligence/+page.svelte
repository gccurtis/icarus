<script lang="ts">
  import { page } from "$app/state";

  import PageIntelligence from "$development-views/agents-reference/components/page-intelligence.svelte";
</script>

<PageIntelligence project={page.params.project ?? ""} />
