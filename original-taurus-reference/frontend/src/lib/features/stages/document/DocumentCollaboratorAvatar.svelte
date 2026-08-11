<script lang="ts">
  import type { DocumentCollaborator } from '$systems/documents/collaboration';
  import { IdentityHoverCard } from '$lib/components';
  import { identityProfileFromCollaborator } from '$data/identity-directory';

  let {
    collaborator,
    class: className = ''
  }: {
    collaborator: DocumentCollaborator;
    class?: string;
  } = $props();

  const profile = $derived(identityProfileFromCollaborator(collaborator));
</script>

<IdentityHoverCard
  {profile}
  align="right"
  class={className}
  avatarClass="ring-2 ring-work"
/>
