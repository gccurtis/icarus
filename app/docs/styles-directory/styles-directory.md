# The Styles Directory

**Status:** Implemented architecture and maintenance specification. The
translation from `src/lib/style/` and `docs/style/` is complete; the style
linter enforces this structure and the generators extend it.

The directory exposes the styling process in the same way a capability exposes
its public functions and the procedure trees behind them:

```text
chromatic themes  ->  semantic tokens  ->  external integrations
physical material     public API           translated vocabulary
```

Form follows function. A reader should learn the execution order from the
directory listing and `app.css`, not reconstruct it from an abstract taxonomy.

## Target tree

```text
src/lib/styles/
├── app.css                              public door and execution manifest
├── chromatic-themes/
│   ├── chromatic-themes.md              theme interface and shared slot process
│   ├── slots.css                        palette ramps -> chromatic job slots
│   ├── celestial/
│   │   ├── celestial.md                 palette, theory, and contract notes
│   │   └── celestial.css
│   └── cyberpunk/
│       ├── cyberpunk.md
│       └── cyberpunk.css
├── semantic-tokens/
│   ├── semantic-tokens.md               complete public vocabulary and role table
│   ├── color.css
│   ├── typography.css
│   ├── spacing.css
│   ├── shape.css
│   └── motion.css
└── x-integrations/
    ├── x-integrations.md                external-boundary contract
    ├── tailwind/
    │   ├── tailwind.md
    │   └── tailwind.css
    └── shadcn/
        ├── shadcn.md
        ├── bridge.css
        ├── variants.css
        └── generated.css                quarantined CLI target; never imported
```

The two implementation stage names sort in execution order: `chromatic`,
`semantic`. The `x-` prefix places integrations last and identifies them as
cross-boundary adapters rather than a third source of design meaning. An
integration is not necessary to produce a token; semantic tokens are already the
complete framework-independent output.

Themes own directories because a theme has implementation, theory, a palette
contract, and room for theme-specific verification material. Integrations own
directories because each is an independently removable external boundary and
may need several adapter files.

Token domains remain files while one file tells the truth for each domain. A new
subdirectory requires an actual internal process, not merely a desire to make
the tree look symmetrical.

## `app.css`: public door and execution manifest

The root layout imports one stylesheet:

```ts
import "$lib/styles/app.css";
```

No other application file imports anything inside `styles/`. Components use
the public output; they do not select which implementation stages run.

`app.css` names every executed stylesheet directly. There are no CSS barrels
between the door and a stage, so the whole pipeline remains visible in one file:

```css
/* Build engines and local assets. These do not define design meaning. */
@import "tailwindcss";
@import "tw-animate-css";
@import "@fontsource/ibm-plex-sans/400.css";
@import "@fontsource/ibm-plex-sans/500.css";
@import "@fontsource/ibm-plex-sans/600.css";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/500.css";

/* 1. Chromatic themes: default, alternates, shared resolution. */
@import "./chromatic-themes/celestial/celestial.css";
@import "./chromatic-themes/cyberpunk/cyberpunk.css";
@import "./chromatic-themes/slots.css";

/* 2. Public tokens. */
@import "./semantic-tokens/color.css";
@import "./semantic-tokens/typography.css";
@import "./semantic-tokens/spacing.css";
@import "./semantic-tokens/shape.css";
@import "./semantic-tokens/motion.css";

/* x. External translations of the public vocabulary. */
@import "./x-integrations/tailwind/tailwind.css";
@import "./x-integrations/shadcn/variants.css";
@import "./x-integrations/shadcn/bridge.css";
```

Short universal rules for `html`, `body`, selection, focus, and reduced motion
remain at the bottom of `app.css`. They are the final application of the public
tokens. Creating `base/`, `document/`, and `accessibility/` directories around
a few selectors would hide that final step rather than expose it.

The order of alternate themes is load-bearing. The default theme binds to bare
`:root` as well as its explicit data selector; alternates bind to equal-
specificity data selectors, so source order must place the default first. Other
custom-property references resolve at computed-value time, but the same order is
kept because it tells the truth about the transformation.

## Stage 1: chromatic themes

A chromatic theme decides what material exists. It owns:

- literal color values;
- named hue ramps;
- `color-scheme`;
- neutral planes, seams, ink, and shadow tint;
- the visual theory explaining why those values belong together.

It does not decide what `success`, `interactive`, or `primary` means.

Each theme directory has exactly one entry stylesheet and one same-name
document:

```text
chromatic-themes/<theme>/
├── <theme>.md
└── <theme>.css
```

The directory, document, stylesheet, and `[data-theme="<theme>"]` selector use
the same kebab-case name. Theme-specific supporting documents are added only
when the theme acquires information that cannot be understood in `<theme>.md`.

`slots.css` is shared by every theme and belongs to this stage. It converts the
physical ramps into a stable private chromatic interface:

```text
--palette-blue-faded
--palette-blue-normal       ->  --chromatic-blue-surface
--palette-blue-strong           --chromatic-blue-border
                                 --chromatic-blue-fill
                                 --chromatic-blue-text
                                 --chromatic-blue-on-fill
```

The theme's `color-scheme` controls the light/dark side selected by
`light-dark()`. Later stages therefore choose a hue and job without choosing an
intensity or knowing the theme polarity.

Every theme implements the same declaration interface. A theme changes values,
not names, meanings, or slot resolution.

## Stage 2: semantic tokens

Semantic tokens are the public styling API. Everything before
`semantic-tokens/` is private implementation.

`color.css` binds each role directly to one chromatic family, and aliases the
theme's achromatic material:

| Kind | Role | Hue |
| --- | --- | --- |
| Meaning | `success` | green |
| Meaning | `danger` | red |
| Meaning | `attention` | amber |
| Meaning | `inactive` | grey |
| Identity | `interactive` | blue |
| Identity | `active` | cyan |
| Identity | `intelligence` | violet |
| Brand | `primary` | blue |
| Brand | `secondary` | cyan |
| Brand | `accent-1` | pink |
| Brand | `accent-2` | teal |

Each role declares the full seven-slot family, and every declaration is a direct
matching alias:

```css
--token-color-interactive-fill: var(--chromatic-blue-fill);
```

The role table is the only place a hue is chosen, so a role's colour is a pure
function of the palette. Meaning roles are fixed. Identity and brand roles may
share a hue with one another but never with a meaning hue. `orange` and `yellow`
are declared by the chromatic stage and reserved. Theme planes, seams, and ink
alias `--theme-*` directly.

`color.css` also owns shadow colour, named by what a shadow physically does —
`ambient` for something resting above its plane, `cast` for something floating
clear of it, `occlusion` for something passing beneath something else. The theme
supplies the tint and this layer decides each strength, so no component computes
a shadow colour at its call site. Geometry stays in `shape.css`.

The other files publish independent domains:

| File | Owns |
| --- | --- |
| `typography.css` | Font families, type scale, and line height |
| `spacing.css` | Shared spacing scale and base unit |
| `shape.css` | Radius and elevation geometry |
| `motion.css` | Durations and easing |

The directory remains flat while one file tells the truth for each domain. If a
domain later contains multiple passes with private dependencies, it may become
`semantic-tokens/<domain>/`. File length alone does not create a directory.

Visibility is explicit in the names:

| Visibility | Namespace |
| --- | --- |
| Private theme material | `--palette-*`, `--theme-*` |
| Private chromatic interface | `--chromatic-*` |
| Public colors | `--token-color-*`, `--token-surface-*`, `--token-ink-*`, `--token-border-*` |
| Public non-color values | `--token-font-*`, `--token-text-*`, `--token-spacing-*`, `--token-radius-*`, `--token-shadow-*`, `--token-motion-*`, `--token-ease-*` |

A token names a job, never an implementation choice. Components request danger
text, not red text; a panel radius, not ten pixels.

## External integrations

An integration translates the complete public token API into a vocabulary
imposed by one external system. It is an adapter, never another source of design
decisions.

Every integration owns a directory and a matching boundary document:

```text
x-integrations/<integration>/
├── <integration>.md
└── one or more purpose-named CSS files
```

The document states:

- the external package or generated source being adapted;
- which vocabulary it assumes;
- each authored adapter file and its one responsibility;
- any generated files and whether they execute;
- how to remove the integration without damaging first-party tokens.

The current integrations are:

- `tailwind/tailwind.css`: public tokens exposed as Tailwind namespaces and the
  theme-aware `dark` variant;
- `shadcn/bridge.css`: shadcn color, surface, and radius names mapped to public
  tokens;
- `shadcn/variants.css`: registry state shorthand mapped to attributes emitted
  by bits-ui;
- `shadcn/generated.css`: the CSS destination used by `components.json` when the
  registry CLI attempts to inject declarations.

`generated.css` is quarantined and is never imported. Its fixed header says it
may be overwritten. A declaration is accepted only by expressing it manually in
`bridge.css` or `variants.css`; generated output is not silently promoted.

Integration declarations reference public tokens only. Shadcn destructive
colors map to `--token-color-danger-*`, never directly to `--chromatic-red-*`.
Removing an integration must leave the token layer complete.

## What does not belong here

The existing `mandate.md` is a broader statement of product and aesthetic
preferences. Its target is:

```text
docs/design-preferences.md
```

The styling pipeline should satisfy those preferences, but does not own them.
They also govern views, interaction, content, and future rendering platforms.

View-specific geometry and component styling remain with the component tree. A
shell zone width is not a global token merely because CSS expresses it. A value
moves into `tokens/` only when unrelated rendered owners intentionally share the
same visual decision.

Interaction and accessibility theory are broader frontend contracts. Their
eventual locations should follow the code they govern rather than remaining in
`styles/` to preserve the old documentation tree. The concrete universal focus
and reduced-motion selectors remain visible in `app.css`.

## Documentation contract

Documentation mirrors the process without creating a second architecture.

- `docs/styles-directory/styles-directory.md` is the single system document. It
  defines the end-to-end transformation, directory structure, enforcement,
  generation, and consumer surface.
- `chromatic-themes.md` defines the theme and chromatic-slot interfaces.
- Every theme owns `<theme>.md` because its palette and theory are substantive.
- `semantic-tokens.md` enumerates the public API, the role table, and usage
  laws.
- `x-integrations.md` defines adapter rules.
- Every integration owns `<integration>.md` because it is an external removal
  boundary.

Tests and generated quarantine files do not need documents of their own. Any
other Markdown file must describe information genuinely owned by its directory.

## Enforcement implementation

Style enforcement follows the existing capability-script pattern but checks a
single transformation graph rather than discovering repeatable capabilities.

```text
scripts/lint/styles/
├── lint.mjs
├── rules.mjs
└── test/
    ├── build-fixtures.mjs
    └── lint.test.mjs
```

### Responsibilities

`lint.mjs` is the package-aware CLI. It resolves paths from its own location, so
it behaves identically from the repository root and `app/`. It calls
the exported rules, sorts failures by path, line, and rule id, prints all
failures in one run, and exits nonzero when any exist.

`rules.mjs` contains no process exit or console output. It exports functions over
explicit roots so tests can run them against temporary fixture trees:

```js
checkStyleStructure({ stylesRoot, packageRoot })
checkStyleImports({ stylesRoot, packageRoot })
checkStyleDeclarations({ stylesRoot })
checkStyleConsumers({ sourceRoot, stylesRoot })
checkRegistrySurface({ sourceRoot, stylesRoot })
```

Each returns failures with a stable shape:

```ts
type StyleFailure = {
  rule: string;
  path: string;
  line: number;
  message: string;
};
```

The CSS rules should use an actual syntax tree, not regular expressions over
whole files. Add `postcss` as an explicit development dependency; do not rely on
whatever version Tailwind happens to install transitively. Unknown at-rules such
as `@theme` and `@custom-variant` remain visible in the PostCSS tree.

The parser records, with source locations:

- local and package `@import` statements;
- custom-property declarations;
- `var()` references in every declaration value;
- selectors containing `data-theme`;
- `color-scheme` declarations;
- literal color syntax;
- custom variants and their selector parameters.

Literal-color detection covers hex values and `rgb()`, `hsl()`, `hwb()`,
`lab()`, `lch()`, `oklab()`, `oklch()`, and `color()`. `transparent` and
`currentColor` are permitted keywords; `color-mix()` is permitted only when all
of its color inputs are token references or permitted keywords.

Consumer checking scans authored `.svelte`, `.ts`, and `.css` files. Svelte
style blocks are obtained through `svelte/compiler`; private custom-property
references in script strings and inline style expressions are checked from the
source text.

Components are split by provenance, and the two halves are checked by opposite
rules:

| Directory | Contents | Rule |
| --- | --- | --- |
| `components/vendor/` | vendored shadcn, run as shipped | `restrict-registry-surface` — bridge vocabulary only |
| `components/authored/` | authored here, real engineering on top | `restrict-consumer-surface` — `--token-*` required, no literal colors |

A component that needs more than the bridge already gives it belongs in
`components/authored/`. Anything in `components/vendor/` that looks wrong is
fixed in `bridge.css`, not in the component.

The palette demo is the only diagnostics exception: it may read `--palette-*`,
but may not import internal CSS or author literal colors.

### Rule set

Rules are named, not numbered, and each starts with the verb for what it does to
the thing it names — so a failure says what was violated without a lookup table.
`rules.mjs` exports `RULE_NAMES`; this table must list exactly those names.

| Rule | Enforcement |
| --- | --- |
| `restrict-stage-entries` | Only `app.css` and the three named stage directories exist at the root. Theme and integration directories have matching documents and required CSS. Token domains remain files. All authored names are kebab-case. |
| `require-stage-document` | The system document exists at `docs/styles-directory/styles-directory.md`; required stage, theme, and integration documents exist beside the code they describe. No duplicate root document or legacy implementation document remains. |
| `confine-style-door` | `src/routes/+layout.svelte` imports `$lib/styles/app.css` exactly once. No other file imports `styles/*.css`. |
| `require-manifest-import` | Every authored stage CSS file is imported exactly once by `app.css`; no missing, duplicate, or transitive local imports exist. `generated.css` is the sole unreachable CSS file. |
| `order-stage-imports` | Imports are contiguous in prelude, chromatic-theme, token, integration order. The default theme precedes alternates; `slots.css` follows all theme files. |
| `match-declaration-namespace` | A declaration's namespace is owned by its stage and file — themes declare `--palette-*`/`--theme-*`, slots declare `--chromatic-*`, semantic tokens declare `--token-*`, integrations declare none of these. |
| `restrict-stage-references` | Theme files reference their own palette values; slots reference theme material; tokens reference theme or chromatic values; integrations reference public tokens only. References cannot point backward or skip the public boundary. |
| `confine-literal-colors` | Literal colors occur only in `<theme>/<theme>.css`. Every later stage names a value rather than writing one. |
| `match-theme-interface` | Directory, file, document, and selector names agree. Exactly one default binds `:root`; every theme declares one `color-scheme`; all themes declare identical theme token sets. |
| `match-theme-registration` | The default theme agrees with `app.html`. Themes declaring dark `color-scheme` exactly match the theme list in Tailwind's `dark` custom variant. |
| `require-role-slots` | Every `--token-color-*` declaration names a role from the table and one of the seven slots, and is a direct `var(--chromatic-<hue>-<slot>)` alias whose slot matches. Every role declares its complete seven-slot family. |
| `pin-meaning-hues` | Meaning roles bind their fixed hues; no identity or brand role reuses a meaning hue; no role spans more than one chromatic family. |
| `confine-integration-boundary` | Integration CSS declares only external compatibility namespaces or variants and references only public tokens. The integration document names every authored and generated file in its directory. |
| `quarantine-generated-css` | `x-integrations/shadcn/generated.css` is the exact `components.json` CSS target, has the quarantine header, and is not imported anywhere. No other file is silently exempt from reachability. |
| `restrict-consumer-surface` | Authored consumers — including `components/authored/` — cannot reference private stage variables, import an internal stylesheet, or contain literal colors. Only the named palette diagnostic may read `--palette-*`. |
| `restrict-registry-surface` | Registry components under `components/vendor/` use shadcn's bridge vocabulary only. A utility whose root is a first-party `--color-*` alias registered by the Tailwind adapter is rejected: a registry component that looks wrong is fixed in `bridge.css`. |

Contrast is deliberately not a structural rule. A separate contract test parses
theme values, resolves the light and dark slot mappings, and measures each
documented foreground/background pairing. Rendered themes, focus behavior, and
reduced motion belong to browser or visual tests when that harness exists.

### Fixture strategy

`build-fixtures.mjs` creates a minimal valid style tree in a temporary directory.
It is generated rather than committed as dozens of copied trees, so changes to
the valid contract have one source.

Each linter test applies one mutation to that valid tree and asserts the exact
rule id, path, and relevant message. Required mutations include:

- a theme missing one palette value;
- an alternate theme imported before the default;
- a role missing one slot;
- a role aliasing a mismatched slot;
- a role landing on a fixed-meaning hue;
- a token reaching directly into a palette;
- an integration reaching into a chromatic variable;
- a literal color in a view;
- a registry component reaching past the bridge;
- an undocumented integration file;
- generated CSS becoming reachable;
- a private stylesheet import from a component;
- a dark theme absent from the Tailwind variant.

The test suite also runs the valid fixture through every rule and expects no
failures. A rule is not complete until both its passing and failing behavior are
tested.

### Package scripts and output

The implementation adds:

```json
{
  "scripts": {
    "lint:styles": "node scripts/lint/styles/lint.mjs",
    "new-style-theme": "node scripts/generation/styles/new-theme.mjs"
  }
}
```

The existing `test:scripts` glob already discovers
`scripts/lint/styles/test/lint.test.mjs` and the generator tests. The eventual
package-wide `lint` aggregates capabilities, models, views, and styles; the
style CLI remains independently runnable during translation.

A successful run reports counts instead of listing every file:

```text
style lint: 2 themes, 5 token domains, 2 integrations; graph, roles, registry, and consumer surface clean
```

## Generation implementation

Only repeatable, fully specified variants get generators.

```text
scripts/generation/styles/
├── new-theme.mjs
├── shared.mjs
└── test/
    └── generation.test.mjs
```

Integrations do not get a generic generator initially. Their common structure is
only a directory and a document; their actual adapter surfaces differ. A
generator that creates an empty CSS file would conceal the design work rather
than automate repetition. Add one only after two new integrations demonstrate a
real shared template.

### Shared generator behavior

`shared.mjs` owns behavior both commands must not reimplement:

- kebab-case parsing and reserved-name rejection;
- explicit package/style path resolution independent of the caller's cwd;
- collision checks before any write;
- PostCSS parsing and formatting of generated declarations;
- insertion into the correct `app.css` stage without string-position guesses;
- update of the generated inventory table in the matching stage document;
- an in-memory write plan containing every create and edit;
- rollback to the original bytes if applying any planned write fails;
- a final run of the style rule functions against the resulting tree.

Commands never overwrite an existing variant and never accept a path, slash, or
unresolved glob as a name. They print the created files and edited registration
files on success.

The generated inventory in `chromatic-themes.md` is bounded by explicit
comments:

```md
<!-- generated:theme-inventory:start -->
...
<!-- generated:theme-inventory:end -->
```

Only those bounded tables are rewritten. Human rationale outside the markers is
never reformatted by a generator.

### `new-theme.mjs`

Usage:

```text
pnpm new-style-theme -- <name> --from <existing-theme> --scheme <light|dark>
```

`--from` is required because a theme has a large complete interface and a valid
starting palette is safer than 100 invalid placeholder values. Copying does not
claim the new theme is designed; its document is generated with `Status: draft`
and records the source theme.

The command:

1. validates the new name and resolves the source theme directory;
2. parses the source CSS and verifies it already satisfies the theme interface;
3. copies the interface into `<name>/<name>.css`;
4. replaces selectors with `[data-theme="<name>"]` and writes the explicitly
   selected `color-scheme`;
5. creates `<name>/<name>.md` from the theme template, including palette table,
   theory prompts, source theme, and verification checklist;
6. inserts the CSS import after the default theme and among alternates in
   alphabetical order, always before `slots.css`;
7. adds the theme inventory row;
8. adds or omits the theme in Tailwind's dark variant from `--scheme`;
9. validates the full planned result with style rules before reporting success.

The generator cannot change the default theme. That operation changes bare
`:root`, `app.html`, import precedence, and possibly the initial paint, so it is
a deliberate manual migration checked by `match-theme-interface` and
`match-theme-registration`.

Roles do not get a generator. The role table is a single fixed assignment
checked by `require-role-slots` and `pin-meaning-hues`, not a repeatable
variant.

### Generator tests

Generator tests run in temporary copies of a minimal valid package and cover:

- invocation from both repository and package working directories;
- valid light and dark theme generation;
- selector, import, documentation, and Tailwind registration updates;
- invalid names and missing sources;
- refusal to overwrite existing variants;
- rollback after a simulated write failure;
- idempotent failure on a repeated command;
- a clean style-lint result after successful generation.
