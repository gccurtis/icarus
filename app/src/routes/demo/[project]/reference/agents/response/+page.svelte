<script lang="ts">
  import { page } from "$app/state";

  import PageResponse from "$development-views/agents-reference/components/page-response.svelte";
</script>

<PageResponse project={page.params.project ?? ""} />
