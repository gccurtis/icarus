<script lang="ts">
  import { page } from "$app/state";
  import DerivedOutputRebase from "$development-views/derived-output-rebase/derived-output-rebase.svelte";
</script>

<DerivedOutputRebase project={page.params.project ?? ""} />
