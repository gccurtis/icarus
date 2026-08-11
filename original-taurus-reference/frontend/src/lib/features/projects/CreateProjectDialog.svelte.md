# src/lib/features/projects/CreateProjectDialog.svelte — breakdown

Companion to [CreateProjectDialog.svelte](CreateProjectDialog.svelte). A modal
that creates a real project via Omega (`POST /projects`), then enters it.

## Script

### State and the create action

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { Modal, Field, Input, Button, toast } from '$lib/components';
  import { isApiError } from '$data/api';
  import { createProject, openProject } from '$data/projects';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let name = $state('');
  let creating = $state(false);
  let error = $state('');

  async function create() {
    if (!name.trim()) return;
    creating = true;
    error = '';
    try {
      const id = await createProject(name);
      toast('Project created', { tone: 'success' });
      open = false;
      name = '';
      await openProject(id).catch(() => {});
      goto(`/projects/${id}`);
    } catch (e) {
      error = isApiError(e) ? e.message : 'Could not create project.';
    } finally {
      creating = false;
    }
  }
</script>
```

`open` is bindable. `create` calls the real `createProject` (owner is assigned by
the backend), toasts, resets, best-effort selects the new project, and navigates
into it. A failure sets `error` for the field; `creating` drives the button
spinner.

## Markup

### Name field and footer

```svelte

<Modal bind:open title="New project">
  <div class="space-y-3">
    <Field label="Project name" error={error}>
      {#snippet children({ id, describedby })}
        <Input
          {id}
          aria-describedby={describedby}
          bind:value={name}
          placeholder="e.g. Star Map Research"
          invalid={!!error}
          oninput={() => (error = '')}
        />
      {/snippet}
    </Field>
    <p class="text-caption text-muted">
      You'll be the owner. Access controls and sharing are managed in project settings.
    </p>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button onclick={create} loading={creating} disabled={!name.trim()}>Create project</Button>
  {/snippet}
</Modal>
```

Just a name (the only field the create endpoint takes), with its error surfaced
via `Field`/`Input`, and a note that access/sharing live in settings. The footer
has Cancel and a Create button that's disabled until a name is entered and shows a
spinner while creating.
