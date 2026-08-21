<script lang="ts">
  import { insert, list } from "$json-store/client";

  /**
   * The store end to end: this view reads and writes `app/data/projects.json`
   * without knowing a file exists.
   *
   * `projects` is a live handle rather than a fetched value, so `refresh()`
   * after a write is what puts the new row on screen.
   */
  const projects = list("projects");

  const add = async () => {
    await insert("projects", {
      name: `Project ${(projects.current?.length ?? 0) + 1}`,
      revision: 1,
      settings: "{}",
      updatedAt: Date.now()
    });
    await projects.refresh();
  };
</script>

<h1>JSON store</h1>

<button onclick={add}>Add a project</button>

{#if projects.error}
  <p>{projects.error}</p>
{:else}
  <ul>
    {#each projects.current ?? [] as project (project._id)}
      <li>{project._id} — {project.name}</li>
    {/each}
  </ul>
{/if}
