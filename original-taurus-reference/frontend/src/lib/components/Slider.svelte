<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    class: className = '',
    ...rest
  }: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    class?: string;
    [key: string]: unknown;
  } = $props();

  const pct = $derived(((value - min) / (max - min)) * 100);
</script>

<input
  type="range"
  bind:value
  {min}
  {max}
  {step}
  style={`--pct:${pct}%`}
  class={cn('trs-slider h-1.5 w-full cursor-pointer appearance-none rounded-full', className)}
  {...rest}
/>

<style>
  .trs-slider {
    background: linear-gradient(
      to right,
      var(--role-action) 0 var(--pct),
      var(--border-subtle) var(--pct) 100%
    );
  }
  .trs-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background: var(--role-action);
    border: 2px solid var(--surface-work);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
    cursor: pointer;
  }
  .trs-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 2px solid var(--surface-work);
    border-radius: 9999px;
    background: var(--role-action);
    cursor: pointer;
  }
  .trs-slider:focus-visible {
    outline: 2px solid var(--role-focus);
    outline-offset: 2px;
  }
</style>
