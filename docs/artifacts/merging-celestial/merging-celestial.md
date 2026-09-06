# Merging Celestial

**Written:** 2026-09-05 · https://claude.ai/code/artifact/0591b243-92f2-4a60-8e45-bac060de3758
**From:** `work/styling` (branch ref still at `98d9cd0`) · **Into:** `main` at `239d028`

Nothing in this document has been run. It is the plan, not a record.

## Where things stand

- **`work/styling` has no commits.** The branch ref is still at the branch point; all 107 changes
  are uncommitted in the worktree — 57 modified, 34 deleted, 16 added. A rebase or merge operates
  on commits, so `git merge work/styling` today is a no-op that looks like success.
- **`main` is two commits ahead:** `d371c6f feat(templates): replay library onto current main` and
  `239d028 docs: refresh editor handoff and wiki assets`.
- Main changed 101 files. **Five are files this branch also touches.**

## The five files

Four are modify/delete — the branch moved the file main edited. One is a real content conflict.

| File | Main did | Branch did | Resolve |
| --- | --- | --- | --- |
| `styles/semantic-tokens/color.css` | added 7 `--token-color-slide-*` aliases onto orange | deleted → `styles/tokens/color.css` | keep the delete, port the seven lines |
| `styles/semantic-tokens/semantic-tokens.md` | added the `slide \| orange` row, rewrote the reserved-hue sentence | deleted → `styles/tokens/tokens.md` | keep the delete, port the row |
| `styles/x-integrations/tailwind/tailwind.css` | added 7 `--color-slide-*` registrations | deleted → `styles/integrations/tailwind/tailwind.css` | keep the delete, port the seven lines |
| `scripts/lint/shared/styles.mjs` | added `slide: "orange"` to `BRAND_ROLES` | deleted | **keep the delete, port nothing** — every check that read it is gone |
| `development-views/demo/components/roles.svelte` | added a `slide` row | rewritten as a `.data-table` with a `kind` column | take the branch version, add the row with its `kind` |

### The three ports

`styles/tokens/color.css`, after the `accent-2` block — no comment, the stylesheets on this branch
carry values only:

```css
  --token-color-slide-surface: var(--chromatic-orange-surface);
  --token-color-slide-surface-hover: var(--chromatic-orange-surface-hover);
  --token-color-slide-border: var(--chromatic-orange-border);
  --token-color-slide-fill: var(--chromatic-orange-fill);
  --token-color-slide-fill-hover: var(--chromatic-orange-fill-hover);
  --token-color-slide-text: var(--chromatic-orange-text);
  --token-color-slide-on-fill: var(--chromatic-orange-on-fill);
```

`styles/integrations/tailwind/tailwind.css`, alphabetically after `--color-secondary-text`:

```css
  --color-slide-border: var(--token-color-slide-border);
  --color-slide-fill-hover: var(--token-color-slide-fill-hover);
  --color-slide-fill: var(--token-color-slide-fill);
  --color-slide-on-fill: var(--token-color-slide-on-fill);
  --color-slide-surface-hover: var(--token-color-slide-surface-hover);
  --color-slide-surface: var(--token-color-slide-surface);
  --color-slide-text: var(--token-color-slide-text);
```

`development-views/demo/components/roles.svelte`:

```js
    { kind: "Brand", role: "slide", hue: "orange", means: "Slide-deck identity" }
```

Nothing needs adding to the scale list in `components/vendored/utils.ts` — colours are not in it,
because `tailwind-merge` already recognises the `--color-*` namespace. A new *size* or *radius*
would need an entry there; a new role does not.

## The orange problem

The conflict git will not report, because it lives in prose git sees as unchanged.

**Orange stops being reserved.** Three claims on this branch say otherwise, and this branch is the
side that gives — a role in the product beats a hue held in reserve.

| File | Line | Says | Should say |
| --- | --- | --- | --- |
| `styles/tokens/tokens.md` | 43 | "`orange` and `yellow` are declared by the material and reserved" | only `yellow`; add the `slide \| orange` row to the role table above |
| `styles/material/helios/helios.md` | 28 | "`orange` and `yellow` are claimed by no role" | yellow alone; orange carries slide-deck identity |
| `styles/material/selene/selene.md` | — | makes no claim about orange | nothing to change |

### Orange is safe as a role, measured, in both materials

| Material | wash | hover wash | border ≥3 | fill + on-fill ≥4.5 | text ≥7 |
| --- | --- | --- | --- | --- | --- |
| Celestial Helios | 1.07 | 1.29 | 3.08 | 5.33 | 8.07 |
| Celestial Selene | 1.27 | 2.02 | 6.05 | 7.04 | 12.65 |

**Helios' orange border is the tightest number in the system at 3.08**, and it only clears because
this branch darkened `orange-normal` from `#DD6F1A` to `#D06816`. On main's palette that step
measures **2.75** against the panel plane — so `slide` shipped with a boundary below the 3:1 floor.
The merge fixes that as a side effect. Worth knowing it was ever broken, and worth not nudging that
value later without re-measuring.

## Integration — not conflicts, but the merge is not done without them

- **Templates is missing from the demo shell.** Main added `template-library-demo` and a card for
  it; the branch's shell lists eleven pages. Add `{ href: "/demo/templates", label: "Templates" }`
  to the first group in `demo-shell.svelte`.
- **`/demo/templates` has no page component.** Main ships `routes/demo/templates/+page.server.ts`
  and nothing else — no `+page.svelte` — while `demo-index` links to it. Open the route after
  merging; if it errors it needs one.
- **Three new screen components.** Check whether any needs an entry in `vocabulary-nav.svelte` and
  the catalogue, both of which are hand-written lists.
- **The review pages pick up new views for free** — the branch's globs walk
  `app-views/categories/*/<surface>/`. Confirm the three pages list the new template views.
- **The wiki describes the old tree.** `wiki/src/prose/trees/styles.md` documents four stages, two
  themes and eight checks. All three numbers are wrong after this lands. Out of scope for the
  merge, but it will read as false immediately.

## Order of operations

Rebase rather than merge: main is two commits ahead and the branch is one logical change.

1. **Commit the worktree.** `git add -A && git commit -m "feat(styles): Celestial, with Helios and Selene"`
2. **Rebase.** `git rebase main` — the worktree shares the repository, so no fetch. Expect conflicts
   in exactly the five files above; four report as *deleted by us*.
3. **Confirm the four deletions.** `git rm` each of the four moved/removed files.
4. **Take the branch's `roles.svelte`.** `git checkout --theirs <path>` — **`--theirs`, not
   `--ours`.** During a rebase the flags invert: you are replaying your commits *onto* main, so
   `--ours` is main. Getting it backwards silently discards the rewritten file and still
   typechecks. Open it afterwards and confirm it is the `.data-table` version.
5. **Port the slide role**, plus the two prose fixes. This is the part no merge tool can do.
   `git add` them and `git rebase --continue`.
6. **Add Templates to the shell**, then run the gate.
7. **Fast-forward.** From the main checkout: `git merge --ff-only work/styling`. `--ff-only` on
   purpose — after a clean rebase it must fast-forward, and if it cannot, something moved
   underneath and you want to know before it becomes a merge commit.

## The gate

```
cd app
nix develop ../infra/devshell --command pnpm lint
nix develop ../infra/devshell --command pnpm typecheck
nix develop ../infra/devshell --command pnpm test
nix develop ../infra/devshell --command pnpm test:scripts
nix develop ../infra/devshell --command pnpm build
```

On the branch today: **56 lint checks clean** (was 63 — seven style checks removed deliberately),
**0 typecheck errors** across 2,189 files, **591 unit tests**, **99 script tests**, production build
succeeds.

The check count will rise after the merge, because main added capabilities and model methods with
checks of their own. What matters is that none *fails*, and that the seven style checks stay gone —
if `lint` reports `themes-agree-with-each-other` or `literal-colours-in-themes-only`, a deleted file
came back during the rebase.

### Then look at it

The gate does not catch a colour that resolves to nothing. Open `/demo` in both materials and check
the Roles table has a `slide` row with seven filled swatches. **An unregistered token paints
transparent and fails silently** — that is the one failure mode this merge can actually produce.

Unrelated to main, and worth knowing: the section rail on `/demo` and the catalogue rail on
`/demo/vocabulary` both hard-code their section lists. They are correct today and nothing tells you
when they stop being.
