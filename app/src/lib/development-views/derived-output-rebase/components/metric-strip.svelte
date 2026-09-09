<script lang="ts">
  let {
    items
  }: {
    items: readonly { value: string | number; label: string; tone?: "plain" | "pass" | "attention" | "danger" }[];
  } = $props();
</script>

<dl class="reb-metrics">
  {#each items as item (item.label)}
    <div class={item.tone ?? "plain"}>
      <dd>{item.value}</dd>
      <dt>{item.label}</dt>
    </div>
  {/each}
</dl>
