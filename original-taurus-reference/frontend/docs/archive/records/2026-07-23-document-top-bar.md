# Add the collaboration-shaped document top bar

## Make the canonical document name editable in place

```svelte
<button ondblclick={() => void beginTitleEdit()}>
  {currentTitle}
</button>

<input
  bind:value={titleDraft}
  onkeydown={onTitleKeydown}
  onblur={() => void commitTitle()}
  aria-label="Rename document"
/>
```

Double-clicking the document name swaps it for a focused, selected input. Enter or blur
commits through Omega's shipped Resource rename endpoint, while Escape cancels. The
canonical response flows into both the Resource store and a new `renameResourceTab`
workspace action, keeping the document bar, persisted tab strip, and runtime panel
metadata aligned without rebuilding the editor.

## Show a real edit timestamp that advances with document changes

```ts
const changeSet = await appendChanges(this.docId, ops);
this.meta = { ...this.meta, updatedAt: changeSet.createdAt };
this.setInfo({ save: 'saved', updatedAt: changeSet.createdAt });
```

The bar combines the Resource catalog's real `updatedAt` with the attached runtime's
latest canonical change-set time. Loading, renaming, typing, conflict reloads, and tab
switches therefore retain an honest date-and-time value instead of a component-local
clock guess.

## Preview last-editor attribution and open-user presence behind an explicit mock boundary

```svelte
Edited <time datetime={editedIso}>{editedStamp}</time> by
{$documentBarCollaboration.lastEditor.name}
<Badge tone="attention">Mock</Badge>

{#each $documentBarCollaboration.openUsers as user}
  <Avatar name={user.name} size="xs" />
{/each}
```

Omega does not yet return the actor behind the latest document edit or ephemeral
document presence. `data/document-collaboration.ts` keeps those placeholder people out
of the component, anchors the projection with the real signed-in user, and supplies two
mock collaborators so the intended stacked-avatar UX is visible and honestly badged.
The new backend request specifies durable last-edit attribution separately from
TTL-backed, project-authorized presence.

## Update the active architecture and backend ledgers

```text
docs/architecture/document-editor.md
docs/discrepancies/documents.md
docs/backend-requests/document-collaboration.md
docs/backend-requests/README.md
docs/orientation/README.md
```

The active documentation now distinguishes shipped rename/timestamp behavior from
mocked attribution/presence and gives Omega an actionable contract to close the gap.
The orientation matrix and data-boundary map were updated so later work does not mistake
the collaboration projection for backend truth.

## Verify the real and mocked boundaries in Chromium

```text
double-click name → focused rename input
Enter rename      → Omega catalog + tab title updated
edit timestamp    → visible with date and time
open-user avatars → three visible, mock boundary badged
reload            → renamed resource persists

Companion oracle  → 71 exact source reconstructions
Active link scan  → 106 files, 0 missing targets
pnpm check        → 0 errors, 0 warnings
pnpm build        → passed
pnpm test:e2e     → 5 passed
```

The expanded resource integration journey covers the top bar and still exercises real
document creation, persistence, and catalog identity. The full browser suite confirms
the change does not regress authentication, project settings, sharing, or project
purpose editing.
