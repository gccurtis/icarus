<script lang="ts">
  import { useMutation, useQuery } from "convex-svelte";

  import { accessRefusal } from "$access/errors";
  import { api } from "$convex/_generated/api";
  import { clientModel } from "$model/client";

  /**
   * A refusal the server chose, or an opaque fault.
   *
   * Convex serializes a `ConvexError`'s payload and redacts everything else, so
   * this is the whole client side of that contract: if a payload is there, the
   * server meant to say something and the message is worth showing. If it is
   * not, something broke and the only honest thing to show is that it did.
   */
  const stated = (error: unknown): string =>
    accessRefusal(error)?.message ?? "Something went wrong.";

  /**
   * The Convex round trip, with nothing else on the page.
   *
   * This proves one property: **nothing in this file re-fetches.** `useQuery`
   * holds a subscription, so a write anywhere — this tab, another tab, another
   * machine — arrives on its own. It lives at `/mock` rather than in the
   * application because it is a probe rather than a surface: it belongs to no
   * tab, answers to no resource kind, and would have to be pretended into the
   * workbench to sit inside the frame.
   *
   * What it sends is a **project token**, never a project id. The token is a
   * handle this user holds for this project, resolved server-side within their
   * own memberships, so it names which project without asserting any right to
   * it. Which project a call acts on is decided by that lookup and never by the
   * payload.
   *
   * The token comes off the model rather than out of `page`, so this reads the
   * same value the layout built the client instance around.
   */
  const { project: projectToken } = clientModel();

  const settings = useQuery(api.capabilities.settings.list, () => ({ projectToken }));
  const set = useMutation(api.capabilities.settings.set);

  let key = $state("");
  let value = $state("");
  let failure = $state<string | undefined>(undefined);

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    failure = undefined;

    try {
      await set({ projectToken, key, value: JSON.stringify(value) });
      key = "";
      value = "";
    } catch (error) {
      failure = stated(error);
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
      await set({ projectToken, key: "demo.clicks", value: JSON.stringify(next) });
    } catch (error) {
      failure = stated(error);
    }
  };
</script>

<svelte:head>
  <title>Settings mock — Icarus</title>
</svelte:head>

<div class="surface">
  <section class="panel">
    <h2>Project settings</h2>

    {#if settings.isLoading}
      <p class="note">Loading.</p>
    {:else if settings.error}
      <p class="note failure">{stated(settings.error)}</p>
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
    min-height: 100vh;
    padding: calc(var(--token-spacing-unit) * 6);
    background-color: var(--token-surface-work);
    color: var(--token-ink-primary);
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
