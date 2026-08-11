# Change record — 2026-07-20 — Drop board, rename Sheet, New-tab eyebrow headers

## Removed the `board` resource kind

```ts
export type ResourceKind = 'document' | 'spreadsheet' | 'slides' | 'chat' | 'general';
```

**Why:** board isn't needed for now, and dropping it (plus shortening "Spreadsheet")
frees enough room to fully spell out the create buttons. **How:** removed `board`
everywhere — the `ResourceKind` type, `RESOURCE_KINDS`, `kindMeta` (and its now-unused
`LayoutGrid` icon), the create panel's `NEW_KINDS`, and the AI dialog's kind options.
The seed's board resource ("System Map") becomes `general`, and `load` **migrates any
stored kind that no longer exists** (e.g. old `board` resources) to `general`, so
existing local data doesn't break.

## Renamed Spreadsheet → Sheet

```ts
spreadsheet: { icon: Table, tone: 'success', label: 'Sheet' },
```

**Why:** shorter label, and it fits the create row cleanly. **How:** `kindMeta`'s
spreadsheet label is now **Sheet** (the create button reads "New sheet"; the badge, kebab
"Sheet settings", and AI option all follow); `RESOURCE_KINDS` reads "Sheets".

## New tab: understated section headers

```svelte
<p class="… text-label uppercase tracking-wide text-muted">Templates …</p>
<p class="… text-label uppercase tracking-wide text-muted">Resources</p>
```

**Why:** the big bold `Templates` / `Resources` headings felt like too much on the
launcher. **How:** knocked both down to the same **eyebrow** style as the "New tab" label
(small, uppercase, muted). Overview's headings are unchanged.
