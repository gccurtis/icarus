# Quiet document collaboration bar

## Made document-name editing visually seamless and width-aware

```svelte
<input
  bind:this={titleInput}
  bind:value={titleDraft}
  style:width={titleInputWidth(titleDraft)}
  class="dur-micro -ml-1 h-7 max-w-full border-0 border-b border-transparent bg-transparent px-1 text-body-sm font-medium text-primary outline-none transition-colors focus:border-border"
/>
```

The rename control now follows the title between an 18-character minimum and a
52-character cap instead of opening a wide boxed field. Its transparent surface and
quiet focus edge preserve the feeling that the title itself is being edited while still
providing a keyboard-visible editing state.

## Compressed the top bar into three deliberately balanced zones

```svelte
<div class="sticky top-0 z-10 grid h-9 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-work/85 px-4 backdrop-blur">
  <!-- seamless title | centered edit/save metadata | open viewers -->
</div>
```

The bar is now a fixed, quiet nine-unit row. Equal flexible tracks keep the edit
metadata visually centered while the title stays left and the live-presence affordance
stays right, reducing competition with the document page.

## Rendered edit time relatively beside save state

```ts
export function documentEditRelative(at: number, now = Date.now()): string {
  if (!Number.isFinite(at) || at <= 0) return 'at an unknown time';
  const delta = at - now;
  const absolute = Math.abs(delta);
  if (absolute < 60000) return 'just now';
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });
  if (absolute < 3600000) return formatter.format(Math.round(delta / 60000), 'minute');
  if (absolute < 86400000) return formatter.format(Math.round(delta / 3600000), 'hour');
  if (absolute < 604800000) return formatter.format(Math.round(delta / 86400000), 'day');
  if (absolute < 2592000000) return formatter.format(Math.round(delta / 604800000), 'week');
  if (absolute < 31536000000) return formatter.format(Math.round(delta / 2592000000), 'month');
  return formatter.format(Math.round(delta / 31536000000), 'year');
}
```

The center status reads naturally as “Edited just now by … · Saved” and refreshes
every 30 seconds. The underlying full date and time remain available on the time
element's hover title, retaining precision without spending permanent bar space.

## Added rich hover and focus cards to viewer avatars

```svelte
<DocumentCollaboratorAvatar collaborator={user} />
```

Each stacked avatar now exposes name, optional email and profile image, viewing state,
and access level through a document-owned hover/focus card. Placeholder collaborators
remain visibly marked as mock. The data boundary and backend request now carry the
profile fields Omega will eventually need to supply, so the intended interaction does
not have to be redesigned when real presence arrives.

## Extended browser coverage for compact status, hover profiles, and rename

```ts
await expect(editMetadata).toContainText('just now');
await expect(editMetadata).toContainText('Saved');
await presence.getByRole('button', { name: /Maya Chen/ }).hover();
await expect(page.getByRole('tooltip')).toContainText('maya@mock.taurus.local');
await documentName.dblclick();
await expect(page.getByLabel('Rename document')).toBeFocused();
```

The real-resource browser flow now covers relative metadata, the viewer-card details,
and the seamless double-click rename path. `pnpm check`, `pnpm build`, and the complete
five-test Playwright suite all passed before publication.
