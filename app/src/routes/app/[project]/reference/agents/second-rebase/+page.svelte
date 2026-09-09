<script lang="ts">
  import { page } from "$app/state";

  import PageSecondRebase from "$development-views/agents-reference/components/page-second-rebase.svelte";
</script>

<PageSecondRebase project={page.params.project ?? ""} />
