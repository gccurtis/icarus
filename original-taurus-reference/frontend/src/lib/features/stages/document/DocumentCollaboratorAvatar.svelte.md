# src/lib/features/stages/document/DocumentCollaboratorAvatar.svelte — breakdown

Companion to
[DocumentCollaboratorAvatar.svelte](DocumentCollaboratorAvatar.svelte). Renders one
document-presence avatar and its hover/focus profile card.

## Imports

### The presence type, the shared hover card, and the profile adapter

```svelte
<script lang="ts">
  import type { DocumentCollaborator } from '$systems/documents/collaboration';
  import { IdentityHoverCard } from '$lib/components';
  import { identityProfileFromCollaborator } from '$data/identity-directory';

```

Imports the `DocumentCollaborator` presence type, the shared `IdentityHoverCard`
component, and `identityProfileFromCollaborator` — the adapter that maps a presence
record onto the common identity-profile shape.

## Props and derived profile

### Take a collaborator plus optional class, and derive the shared profile

```svelte
  let {
    collaborator,
    class: className = ''
  }: {
    collaborator: DocumentCollaborator;
    class?: string;
  } = $props();

  const profile = $derived(identityProfileFromCollaborator(collaborator));
</script>

```

Takes a required `collaborator` plus an optional `class`, and derives the shared
`profile` from that collaborator. Converting to the common profile here is what lets
a single identity component back both top-bar people and context-panel personas.

## Markup

### Delegate to the shared hover card with a work-tinted avatar ring

```svelte
<IdentityHoverCard
  {profile}
  align="right"
  class={className}
  avatarClass="ring-2 ring-work"
/>
```

Delegates rendering to `IdentityHoverCard`, passing the derived `profile`,
right-aligning the card, forwarding the caller's class, and giving the avatar a
work-tinted ring to mark it as document presence.
