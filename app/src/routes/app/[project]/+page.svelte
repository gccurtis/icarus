<script lang="ts">
  import { clientModel } from "$model/client";
  import { define, list as listVariables } from "$name-manager";
  import { applyStyle, create, display } from "$rich-content";
  import { list, set } from "$settings";

  /**
   * /app/[project] — the work surface, with nothing open in it yet.
   *
   * The settings panel below is the first thing in this application to read a
   * capability, and it is here because a remote function that nothing imports
   * is tree-shaken out of the build entirely: an unused capability is not a
   * quiet capability, it is an absent one.
   *
   * The project comes off the model rather than out of `page`. The layout read
   * it from the route once and built the client instance around it, so this is
   * the same token by construction — and a view that reached for `page` itself
   * could disagree with the workbench it is rendering.
   *
   * Every capability call carries it, which is not ceremony: a remote function
   * cannot see the page that called it, because kit serves them all from
   * `/_app/remote/…` with empty route params. The token names which project; the
   * session cookie names who is asking; the server pairs them and neither the
   * view nor the procedure gets a say.
   */
  const { project } = clientModel();

  // One project per client instance for its whole life, so these queries are
  // built once rather than derived from something that could change under them.
  const settings = list({ project });
  const variables = listVariables({ project });

  let key = $state("");
  let value = $state("");
  let failure = $state<string | undefined>(undefined);

  let variableName = $state("");
  let variableValue = $state("");
  let variableFailure = $state<string | undefined>(undefined);

  let contentId = $state<string | undefined>(undefined);
  let contentText = $state("");
  let contentFailure = $state<string | undefined>(undefined);
  let projection = $state<Awaited<ReturnType<typeof display>> | undefined>(undefined);

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

  /**
   * Declares a number-valued scalar, which is the smallest declaration Name
   * Manager accepts.
   *
   * The shape is spelled out rather than inferred because that is the
   * capability's whole point: a scalar and a one-element list both hold one
   * value, so nothing downstream could recover which the author meant.
   */
  const declare = async (event: SubmitEvent) => {
    event.preventDefault();
    variableFailure = undefined;

    try {
      await define({
        project,
        variable: {
          name: variableName,
          type: { kind: "scalar", field: { name: "value", type: { kind: "number" } } },
          value: Number(variableValue)
        }
      });
      await variables.refresh();
      variableName = "";
      variableValue = "";
    } catch (error) {
      variableFailure = error instanceof Error ? error.message : String(error);
    }
  };

  /**
   * Creates a content object and renders its projection.
   *
   * The projection is held rather than re-derived, because the segment handles
   * in it are what `boldFirstWord` needs — and they are only valid for the
   * revision they were rendered at.
   */
  const compose = async (event: SubmitEvent) => {
    event.preventDefault();
    contentFailure = undefined;

    try {
      const created = await create({ project, initialText: contentText });
      contentId = created.contentId;
      projection = await display({ project, contentId: created.contentId });
      contentText = "";
    } catch (error) {
      contentFailure = error instanceof Error ? error.message : String(error);
    }
  };

  /**
   * Styles the first four characters, then re-reads.
   *
   * The re-read is not optional: every mutation returns only an id and a
   * revision, and the handles in the projection above are now stale — they embed
   * the version they were rendered at, so reusing them would be refused.
   */
  const boldFirstWord = async () => {
    contentFailure = undefined;
    const current = projection;
    if (!current || !contentId) return;

    const segment = current.lines[0]?.segments[0];
    if (!segment || segment.text.length === 0) return;

    try {
      await applyStyle({
        project,
        contentId,
        expectedVersion: current.version,
        range: {
          start: { segmentId: segment.id, offset: 0 },
          end: { segmentId: segment.id, offset: Math.min(4, segment.text.length) }
        },
        properties: { bold: true }
      });
      projection = await display({ project, contentId });
    } catch (error) {
      contentFailure = error instanceof Error ? error.message : String(error);
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

  <section class="settings">
    <h2>Named variables</h2>

    {#await variables}
      <p class="note">Loading.</p>
    {:then declared}
      {#if declared.length === 0}
        <p class="note">None declared.</p>
      {:else}
        <dl>
          {#each declared as variable (variable.name)}
            <dt>{variable.name}</dt>
            <dd>{JSON.stringify(variable.value)} <span>— {variable.type.kind}</span></dd>
          {/each}
        </dl>
      {/if}
    {:catch error}
      <p class="note failure">{error.message}</p>
    {/await}

    <form onsubmit={declare}>
      <input bind:value={variableName} placeholder="TaxRate" aria-label="Variable name" />
      <input bind:value={variableValue} placeholder="0.0825" aria-label="Variable value" />
      <button type="submit" disabled={variableName.length === 0}>Declare</button>
    </form>

    {#if variableFailure}
      <p class="note failure">{variableFailure}</p>
    {/if}
  </section>

  <section class="settings">
    <h2>Rich content</h2>

    {#if projection}
      <p class="content">
        {#each projection.lines as line (line.id)}
          <span class="line">
            {#each line.segments as segment (segment.id)}<span
                class:bold={segment.style.bold}>{segment.text}</span
              >{/each}
          </span>
        {/each}
      </p>
      <button type="button" onclick={boldFirstWord}>Bold the first word</button>
    {:else}
      <p class="note">Nothing composed.</p>
    {/if}

    <form onsubmit={compose}>
      <input bind:value={contentText} placeholder="the quick brown fox" aria-label="Content text" />
      <button type="submit" disabled={contentText.length === 0}>Compose</button>
    </form>

    {#if contentFailure}
      <p class="note failure">{contentFailure}</p>
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

  .content {
    font-size: var(--token-text-body-sm);
    margin: 0;
  }

  .line {
    display: block;
  }

  .bold {
    font-weight: 700;
  }
</style>
