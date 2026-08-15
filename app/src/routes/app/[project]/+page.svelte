<script lang="ts">
  import { useMutation, useQuery } from "convex-svelte";

  import { api } from "$convex/_generated/api";
  import { clientModel } from "$model/client";

  /**
   * /app/[project] — the work surface, with nothing open in it yet.
   *
   * The panel below is the first thing in this application to read a capability
   * through Convex, and it is here to prove one property: **nothing in this file
   * re-fetches.** `useQuery` holds a subscription, so a write anywhere — this
   * tab, another tab, another machine — arrives on its own.
   *
   * The project comes off the model rather than out of `page`. The layout read
   * it from the route once and built the client instance around it, so this is
   * the same value by construction, and a view that reached for `page` itself
   * could disagree with the workbench it is rendering.
   */
  const { project } = clientModel();

  const settings = useQuery(api.capabilities.settings.list, () => ({ projectId: project }));
  const set = useMutation(api.capabilities.settings.set);

  let key = $state("");
  let value = $state("");
  let failure = $state<string | undefined>(undefined);

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    failure = undefined;

    try {
      await set({ projectId: project, key, value: JSON.stringify(value) });
      key = "";
      value = "";
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  };

  /**
   * Writes a counter. Reads its current value out of the live query rather than
   * holding one, so two windows clicking alternately still count up rather than
   * each continuing from whatever they last saw.
   */
  const bump = async () => {
    failure = undefined;

    const current = settings.data?.find((setting) => setting.key === "demo.clicks");
    const next = typeof current?.value === "number" ? current.value + 1 : 1;

    try {
      await set({ projectId: project, key: "demo.clicks", value: JSON.stringify(next) });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  };
</script>

<svelte:head>
  <title>Icarus</title>
</svelte:head>

<div class="surface">
  <section class="panel">
    <h2>Project settings</h2>

    {#if settings.isLoading}
      <p class="note">Loading.</p>
    {:else if settings.error}
      <p class="note failure">{settings.error.toString()}</p>
    {:else if settings.data.length === 0}
      <p class="note">None set.</p>
    {:else}
      <dl>
        {#each settings.data as setting (setting.key)}
          <dt>{setting.key}</dt>
          <dd>{JSON.stringify(setting.value)}</dd>
        {/each}
      </dl>
    {/if}

    <form onsubmit={save}>
      <input bind:value={key} placeholder="editor.theme" aria-label="Setting key" />
      <input bind:value placeholder="dark" aria-label="Setting value" />
      <button type="submit" disabled={key.length === 0}>Save</button>
    </form>

    <button type="button" onclick={bump}>Bump demo.clicks</button>

    {#if failure}
      <p class="note failure">{failure}</p>
    {/if}
  </section>
</div>

<style>
  .surface {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(var(--token-spacing-unit) * 6);
    height: 100%;
    padding: calc(var(--token-spacing-unit) * 6);
  }

  .panel {
    width: 100%;
    max-width: 32rem;
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  h2 {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
  }

  .failure {
    color: var(--token-ink-danger, var(--token-ink-muted));
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 3);
    font-size: var(--token-text-body-sm);
    margin: 0;
  }

  dt {
    color: var(--token-ink-muted);
  }

  dd {
    margin: 0;
  }

  form {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: var(--token-text-body-sm);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 2);
  }
</style>
