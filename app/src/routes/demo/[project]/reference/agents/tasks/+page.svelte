<script lang="ts">
  import { page } from "$app/state";

  import PageTasks from "$development-views/agents-reference/components/page-tasks.svelte";
</script>

<PageTasks project={page.params.project ?? ""} />
