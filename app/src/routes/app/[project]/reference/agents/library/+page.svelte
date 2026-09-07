<script lang="ts">
  import { page } from "$app/state";

  import PageLibrary from "$development-views/agents-reference/components/page-library.svelte";
</script>

<PageLibrary project={page.params.project ?? ""} />
