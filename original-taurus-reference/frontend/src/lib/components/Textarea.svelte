<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    value = $bindable(''),
    rows = 4,
    invalid = false,
    class: className = '',
    ...rest
  }: {
    value?: string;
    rows?: number;
    invalid?: boolean;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<textarea
  bind:value
  {rows}
  aria-invalid={invalid}
  class={cn(
    'dur-small w-full resize-y rounded-control border bg-work px-3 py-2 text-body-sm text-primary transition-colors placeholder:text-muted',
    invalid ? 'border-danger' : 'border-border hover:border-border-strong',
    className
  )}
  {...rest}
></textarea>
