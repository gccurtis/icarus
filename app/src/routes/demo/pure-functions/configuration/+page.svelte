<script lang="ts">
  import ConfigurationModelReference from "$development-views/pure-functions-reference/configuration-model-reference.svelte";

  let { data }: { data: { serverAdmissionSource: string } } = $props();
</script>

<ConfigurationModelReference serverAdmissionSource={data.serverAdmissionSource} />
