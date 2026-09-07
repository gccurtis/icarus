<script lang="ts">
  import { page } from "$app/state";

  import PageTask from "$development-views/agents-reference/components/page-task.svelte";
</script>

<PageTask project={page.params.project ?? ""} />
