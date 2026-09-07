<script lang="ts">
  let {
    value,
    label,
    placeholder,
    size = "title",
    disabled = false,
    onsave
  }: {
    value: string;
    label: string;
    placeholder: string;
    size?: "title" | "line";
    disabled?: boolean;
    onsave: (next: string) => void;
  } = $props();

  const commit = (element: HTMLInputElement) => {
    const next = element.value.trim();
    if (next === "") {
      element.value = value;
      return;
    }
    if (next !== value) onsave(next);
  };
</script>

<input
  class="name {size}"
  {value}
  {placeholder}
  {disabled}
  aria-label={label}
  onchange={(event) => commit(event.currentTarget)}
  onkeydown={(event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }}
/>

<style>
  .name {
    width: 100%;
    margin: 0 0 0 calc(var(--token-spacing-unit) * -1);
    padding: 0 var(--token-spacing-unit);
    border: 1px solid transparent;
    border-radius: var(--token-radius-control);
    background: transparent;
    color: var(--token-ink-primary);
    outline: none;
  }

  .title {
    font-size: var(--token-text-h3);
    font-weight: var(--token-weight-strong);
    letter-spacing: var(--token-tracking-heading);
    line-height: var(--token-text-h3-leading);
  }

  .line {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .name:hover,
  .name:focus {
    border-color: var(--token-border-subtle);
    background: var(--token-surface-elevated);
  }

  .name:disabled {
    opacity: 0.6;
  }
</style>
