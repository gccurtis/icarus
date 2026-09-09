<script lang="ts">
  import { page } from "$app/state";

  import PageRebase from "$development-views/agents-reference/components/page-rebase.svelte";
</script>

<PageRebase project={page.params.project ?? ""} />
