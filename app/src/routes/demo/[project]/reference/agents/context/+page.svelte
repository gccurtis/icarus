<script lang="ts">
  import { page } from "$app/state";

  import PageContext from "$development-views/agents-reference/components/page-context.svelte";
</script>

<PageContext project={page.params.project ?? ""} />
