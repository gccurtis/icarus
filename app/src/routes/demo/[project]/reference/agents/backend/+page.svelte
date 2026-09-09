<script lang="ts">
  import { page } from "$app/state";

  import PageBackend from "$development-views/agents-reference/components/page-backend.svelte";
</script>

<PageBackend project={page.params.project ?? ""} />
