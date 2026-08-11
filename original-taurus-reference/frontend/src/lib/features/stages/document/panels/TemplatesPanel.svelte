<script lang="ts">
  import SharedTemplatesPanel from '$lib/features/shared/templates/TemplatesPanel.svelte';

  // Rail sections render with no props, so this wrapper pins the document scope
  // onto the shared Templates panel (features/shared/templates/).
</script>

<SharedTemplatesPanel scope="document" />
