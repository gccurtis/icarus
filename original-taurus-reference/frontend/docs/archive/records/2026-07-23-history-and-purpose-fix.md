# Remove rejected editor history and stabilize the purpose field

## Rebuild main without the rejected document-editor integration

```text
Accepted base: 516717c (stable prompt-resolve route)
Retained post-base work: managed Alpha/Omega development stack
Excluded history: rejected editor merge, editor-only refinements, its revert,
and the follow-up archival commit
Published shape: accepted base → replayed managed-stack commit → this change
```

The rejected editor was already absent from the working tree but remained reachable
through a merge-and-revert sequence on `main`. Rebuilding the branch directly from the
last accepted base removes that entire sequence from published ancestry instead of
preserving thousands of lines of abandoned implementation behind a revert. The
unrelated managed-stack change was replayed on the clean base so current development
commands and behavior remain intact.

## Give the Overview purpose field one displayed source at a time

```svelte
let draft = $state<string | null>(null);
const text = $derived(draft ?? project?.purpose ?? '');

function edit(event: Event) {
  draft = (event.currentTarget as HTMLTextAreaElement).value;
}

await updateProject(current.id, { purpose });
draft = null;
```

The purpose control previously copied the persisted Project purpose into a second
mutable value through an effect. The field now renders the canonical Omega-backed
purpose until the user types, then renders exactly one explicit draft until the save
succeeds. Clearing the draft after a confirmed save returns the display to canonical
state, while clearing it on a project switch preserves strict project isolation.

## Verify source integrity, production gates, and real browser behavior

```text
PurposeStatement companion oracle → exact byte-for-byte source reconstruction
pnpm check                       → 0 errors, 0 warnings
pnpm build                       → passed
pnpm test:e2e                    → 5 passed
Live Chromium + Omega regression → one purpose field; edit, save, and reload retain
                                    one canonical value
Rejected editor merge ancestry  → absent from rewritten main
```

The repository gates cover static diagnostics, production compilation, and all existing
browser integrations. The focused live regression additionally exercises the exact
purpose failure boundary against Omega rather than relying on component structure
alone, and the ancestry check proves the rewrite removed the rejected merge rather than
merely hiding its files in the current tree.
