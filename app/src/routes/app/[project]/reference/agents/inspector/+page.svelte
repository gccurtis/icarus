<script lang="ts">
  import { page } from "$app/state";

  import PageInspector from "$development-views/agents-reference/components/page-inspector.svelte";
</script>

<PageInspector project={page.params.project ?? ""} />
