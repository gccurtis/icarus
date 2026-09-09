<script lang="ts">
  import { page } from "$app/state";
  import CheckersPage from "$development-views/derived-output-rebase/components/checkers-page.svelte";
</script>

<CheckersPage project={page.params.project ?? ""} />
