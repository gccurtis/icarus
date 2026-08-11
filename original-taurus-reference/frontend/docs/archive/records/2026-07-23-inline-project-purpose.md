# Make the project purpose a single in-place editor

## Remove the repeated instruction and explicit Save control

```diff
- <p>Describe what this project is for.</p>
- <Button onclick={save}>Save</Button>
+ <textarea onblur={() => void commit()} ...></textarea>
```

The empty purpose previously presented the same instruction twice: once as the field
placeholder and again as helper copy below it. The helper and Save button are removed so
the purpose reads as one direct, in-place editing surface. Viewers retain the explicit
read-only message because it communicates access rather than repeating the field prompt.

## Persist changed purpose text when editing finishes

```ts
async function commit() {
  const current = project;
  const next = draft;
  if (!current || !canEdit || saving || next === null) return;
  const purpose = next.trim();
  if (purpose === current.purpose) {
    draft = null;
    return;
  }
  await updateProject(current.id, { purpose });
  if (draft === next) draft = null;
}
```

Leaving the field commits changed text through the existing Omega-backed project update
boundary. No-op drafts return to canonical state without a request, successful writes
clear only the draft they submitted, and failed writes remain visible while the existing
error toast explains the failure.

## Cover the complete in-place interaction in Chromium

```text
single purpose placeholder → present
repeated helper text       → absent
Save button                → absent
edit + blur                → Omega purpose updated
browser reload             → edited purpose restored
```

The resource integration test now guards the visual and persistence behavior together.
Its new Markdown companion reproduces the test byte-for-byte so the regression coverage
also follows the repository's source-documentation rule.

## Verify source, build, and browser behavior

```text
Touched companion reconstruction → 2 files exact
pnpm check                       → 0 errors, 0 warnings
pnpm build                       → passed
pnpm test:e2e                    → 5 passed
```

The static diagnostics, production build, and full real-stack browser suite pass with
the in-place interaction. The generated Overview screenshot also confirms that the
purpose occupies a single card with no repeated prompt or separate action row.
