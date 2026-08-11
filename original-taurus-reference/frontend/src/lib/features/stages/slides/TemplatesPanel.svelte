<script lang="ts">
  import SharedTemplatesPanel from '$lib/features/shared/templates/TemplatesPanel.svelte';

  // Rail sections render with no props, so this wrapper pins the slides scope
  // (This slide / Whole deck in Make a template) onto the shared Templates panel.
</script>

<SharedTemplatesPanel scope="slides" />
