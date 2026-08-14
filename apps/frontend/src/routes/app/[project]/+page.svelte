<script lang="ts">
  import { page } from "$app/state";
  import { list, set } from "$settings";

  /**
   * /app/[project] — the work surface, with nothing open in it yet.
   *
   * The settings panel below is the first thing in this application to read a
   * capability, and it is here because a remote function that nothing imports
   * is tree-shaken out of the build entirely: an unused capability is not a
   * quiet capability, it is an absent one.
   *
   * It reads the project token from its own URL and sends it with every call.
   * That is not ceremony — a remote function cannot see the page that called
   * it, because kit serves them all from `/_app/remote/…` with empty route
   * params. The token names which project; the session cookie names who is
   * asking; the server pairs them and neither the view nor the procedure gets a
   * say. See src/lib/runtime/server/scope.server.ts.
   */
  const project = page.params.project ?? "";

  // One project per client instance for its whole life, so this query is built
  // once rather than derived from something that could change under it.
  const settings = list({ project });

  let key = $state("");
  let value = $state("");
  let failure = $state<string | undefined>(undefined);

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    failure = undefined;

    try {
      await set({ project, key, value });
      await settings.refresh();
      key = "";
      value = "";
    } catch (error) {
      // The capability states its refusals with a code; showing the message is
      // enough to tell a rejected key from a broken server.
      failure = error instanceof Error ? error.message : String(error);
    }
  };
</script>

<svelte:head>
  <title>Icarus</title>
</svelte:head>

<div class="surface">
  <p class="empty">No object open.</p>

  <section class="settings">
    <h2>Project settings</h2>

    {#await settings}
      <p class="note">Loading.</p>
    {:then stored}
      {#if stored.length === 0}
        <p class="note">None set.</p>
      {:else}
        <dl>
          {#each stored as setting (setting.key)}
            <dt>{setting.key}</dt>
            <dd>{JSON.stringify(setting.value)} <span>— {setting.updatedBy}</span></dd>
          {/each}
        </dl>
      {/if}
    {:catch error}
      <p class="note failure">{error.message}</p>
    {/await}

    <form onsubmit={save}>
      <input bind:value={key} placeholder="editor.theme" aria-label="Setting key" />
      <input bind:value placeholder="dark" aria-label="Setting value" />
      <button type="submit" disabled={key.length === 0}>Save</button>
    </form>

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

  .empty,
  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
  }

  .failure {
    color: var(--token-ink-danger, var(--token-ink-muted));
  }

  .settings {
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

  dd span {
    color: var(--token-ink-muted);
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
