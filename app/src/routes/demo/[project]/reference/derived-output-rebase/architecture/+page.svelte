<script lang="ts">
  import { page } from "$app/state";
  import ArchitecturePage from "$development-views/derived-output-rebase/components/architecture-page.svelte";
</script>

<ArchitecturePage project={page.params.project ?? ""} />
