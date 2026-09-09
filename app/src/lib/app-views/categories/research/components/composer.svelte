<script lang="ts">
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Globe from "@lucide/svelte/icons/globe";
  import Square from "@lucide/svelte/icons/square";
  import X from "@lucide/svelte/icons/x";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";

  import { Button } from "$vendored-components/button";
  import * as Select from "$vendored-components/select";
  import { Textarea } from "$vendored-components/textarea";

  let {
    value = $bindable(""),
    mode = "explore",
    scope = "project",
    pending = false,
    stopping = false,
    canScopeResource = false,
    persona = "",
    personaNames = "",
    personaIds = "",
    resource = "",
    resourceNames = "",
    resourceIds = "",
    placeholder = "Ask anything about this project",
    onsend,
    onmode,
    onscope,
    onpersona,
    onstop
  }: {
    value?: string;
    mode?: string;
    scope?: string;
    pending?: boolean;
    /** A stop has been asked for, so the control now cancels. */
    stopping?: boolean;
    canScopeResource?: boolean;
    persona?: string;
    /** The choosable personas, as two aligned newline-separated lists. */
    personaNames?: string;
    personaIds?: string;
    /** The chosen resource as "kind id", and the choosable ones, aligned. */
    resource?: string;
    resourceNames?: string;
    resourceIds?: string;
    placeholder?: string;
    onsend: (text: string) => void;
    onmode?: (mode: string) => void;
    onscope?: (scope: string) => void;
    onpersona?: (personaId: string) => void;
    onstop?: () => void;
  } = $props();

  const MODES = [
    { id: "explore", label: "Explore", ready: true },
    { id: "question", label: "Question", ready: false },
    { id: "hypothesis", label: "Hypothesis", ready: false }
  ];

  const people = $derived(
    personaIds === ""
      ? []
      : personaIds.split("\n").map((id, index) => ({ id, name: personaNames.split("\n")[index] ?? id }))
  );
  const personaLabel = $derived(
    persona === "" ? "Default" : (people.find((entry) => entry.id === persona)?.name ?? "Default")
  );
  const modeLabel = $derived(MODES.find((entry) => entry.id === mode)?.label ?? "Explore");
  const things = $derived(
    resourceIds === ""
      ? []
      : resourceIds
          .split("\n")
          .map((id, index) => ({ id, name: resourceNames.split("\n")[index] ?? id }))
  );
  const scopeLabel = $derived(
    resource === "" ? "All project" : (things.find((entry) => entry.id === resource)?.name ?? "One resource")
  );
  const written = $derived(value.trim());

  const send = () => {
    if (written === "" || pending) return;
    onsend(written);
  };

  /**
   * Enter sends; Shift-Enter is the newline.
   *
   * An IME composition also ends on Enter, and sending there would send a
   * half-written word.
   */
  const typed = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    send();
  };
</script>

<form
  class="composer"
  onsubmit={(event: SubmitEvent) => {
    event.preventDefault();
    send();
  }}
>
  <div class="head">
    <Select.Root type="single" value={mode} onValueChange={(chosen: string) => onmode?.(chosen)}>
      <Select.Trigger size="sm" aria-label="Mode" class="blend">
        {modeLabel}
      </Select.Trigger>
      <Select.Content>
        {#each MODES as entry (entry.id)}
          <Select.Item value={entry.id} label={entry.label} disabled={!entry.ready}>
            {entry.label}
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Select.Root
      type="single"
      value={resource === "" ? "project" : resource}
      onValueChange={(chosen: string) => onscope?.(chosen)}
    >
      <Select.Trigger size="sm" aria-label="Context" class="blend">
        {scopeLabel}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="project" label="All project">All project</Select.Item>
        {#each things as thing (thing.id)}
          <Select.Item value={thing.id} label={thing.name}>{thing.name}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Select.Root type="single" value={persona} onValueChange={(chosen: string) => onpersona?.(chosen)}>
      <Select.Trigger size="sm" aria-label="Answering as" class="blend">
        {personaLabel}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="" label="Default">Default</Select.Item>
        {#each people as entry (entry.id)}
          <Select.Item value={entry.id} label={entry.name}>{entry.name}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="blend"
      disabled
      title="Searching the web is not built yet"
      aria-label="Search the web"
      aria-pressed="false"
    >
      <Globe aria-hidden="true" />
      Web
    </Button>

    {#if pending}
      <Button
        type="button"
        size="icon"
        variant={stopping ? "destructive" : "outline"}
        class="send"
        onclick={() => onstop?.()}
        aria-label={stopping ? "Cancel" : "Stop and answer now"}
        title={stopping ? "Cancel and keep nothing" : "Answer now with what it has"}
      >
        {#if stopping}
          <X aria-hidden="true" />
        {:else}
          <Square aria-hidden="true" />
        {/if}
      </Button>
    {:else}
      <Button type="submit" size="icon" class="send" disabled={written === ""} aria-label="Send">
        <ArrowUp aria-hidden="true" />
      </Button>
    {/if}
  </div>

  <Textarea
    bind:value
    rows={3}
    {placeholder}
    aria-label="Message"
    onkeydown={typed}
    class="field"
  />
</form>

<style>
  .composer {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .composer:focus-within {
    border-color: var(--token-color-interactive-border);
  }

  .head {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .composer :global(.blend) {
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
  }

  .composer :global(.blend:hover) {
    background: var(--token-surface-work);
    color: var(--token-ink-primary);
  }

  .composer :global(.send) {
    margin-inline-start: auto;
    border-radius: 999px;
  }

  .composer :global(.spin) {
    animation: composer-spin 1s linear infinite;
  }

  .composer :global(.field) {
    min-height: calc(var(--token-spacing-unit) * 22);
    max-height: calc(var(--token-spacing-unit) * 60);
    padding: calc(var(--token-spacing-unit) * 3);
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    font-size: var(--token-text-body-sm);
    resize: none;
  }

  .composer :global(.field:focus-visible) {
    outline: none;
    box-shadow: none;
  }

  @keyframes composer-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
