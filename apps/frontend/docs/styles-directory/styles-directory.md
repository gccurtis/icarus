# The Styles Directory

**Status:** Implemented architecture and maintenance specification. The
translation from `src/lib/style/` and `docs/style/` is complete; the style
linter enforces this structure and the generators extend it.

The directory exposes the styling process in the same way a capability exposes
its public functions and the procedure trees behind them:

```text
chromatic themes  ->  semantic sets  ->  tokens  ->  external integrations
physical material     identity            public     translated vocabulary
                                           API
```

Form follows function. A reader should learn the execution order from the
directory listing and `app.css`, not reconstruct it from an abstract taxonomy.

## Target tree

```text
src/lib/styles/
├── styles.md
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
├── semantic-sets/
│   ├── semantic-sets.md                 assignment contract and comparison table
│   ├── blue-primary.css
│   ├── cyan-primary.css
│   └── pink-primary.css
├── tokens/
│   ├── tokens.md                        complete public vocabulary and usage laws
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

The first three stage names already sort in execution order: `chromatic`,
`semantic`, `tokens`. The `x-` prefix places integrations last and identifies
them as cross-boundary adapters rather than a fourth source of design meaning.
Numbering all four directories would also sort them, but would imply that an
integration is necessary to produce a token. It is not; tokens are already the
complete framework-independent output.

Themes own directories because a theme has implementation, theory, a palette
contract, and room for theme-specific verification material. Integrations own
directories because each is an independently removable external boundary and
may need several adapter files.

Semantic sets remain files. Each is one complete five-anchor assignment table
with no supporting tree. Token domains remain files while one file tells the
truth for each domain. A new subdirectory requires an actual internal process,
not merely a desire to make the tree look symmetrical.

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

/* 2. Semantic identity: default, then alternates. */
@import "./semantic-sets/blue-primary.css";
@import "./semantic-sets/cyan-primary.css";
@import "./semantic-sets/pink-primary.css";

/* 3. Public tokens. */
@import "./tokens/color.css";
@import "./tokens/typography.css";
@import "./tokens/spacing.css";
@import "./tokens/shape.css";
@import "./tokens/motion.css";

/* x. External translations of the public vocabulary. */
@import "./x-integrations/tailwind/tailwind.css";
@import "./x-integrations/shadcn/variants.css";
@import "./x-integrations/shadcn/bridge.css";
```

Short universal rules for `html`, `body`, selection, focus, and reduced motion
remain at the bottom of `app.css`. They are the final application of the public
tokens. Creating `base/`, `document/`, and `accessibility/` directories around
a few selectors would hide that final step rather than expose it.

The order of alternate themes and sets is load-bearing. Defaults bind to bare
`:root` as well as their explicit data selector; alternates bind to equal-
specificity data selectors, so source order must place defaults first. Other
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

## Stage 2: semantic sets

A semantic set assigns identity to the chromatic interface:

```css
--semantic-primary-fill: var(--chromatic-blue-fill);
--semantic-secondary-fill: var(--chromatic-violet-fill);
--semantic-tertiary-fill: var(--chromatic-cyan-fill);
```

Each set is one flat file because the complete implementation is an assignment
table: five anchors times seven jobs. It has no private supporting process to
expose.

The parent document contains the contract and a comparison table for every set.
An individual set document is added only if a future assignment needs rationale
that cannot fit truthfully in that table.

A set decides identity only. It cannot assign fixed meaning. Success remains
chromatic green, danger red, attention amber, and inactive grey; public bindings
for those meanings are made in `tokens/color.css`.

Primary, secondary, and tertiary must be distinguishable hues. Accent hues must
not reuse fixed meaning hues. Every set is total: a consumer never handles a
missing anchor or job.

## Stage 3: tokens

Tokens are the public styling API. Everything before `tokens/` is private
implementation.

`color.css` combines chromatic meaning, semantic identity, and theme-neutral
material into canonical `--token-*` properties:

```text
chromatic green -----------------------> success tokens
chromatic red -------------------------> danger tokens
semantic primary ----------------------> interactive and primary tokens
semantic secondary --------------------> intelligence and secondary tokens
semantic tertiary ---------------------> active tokens
theme planes, seams, and ink ----------> public neutral tokens
```

The other files publish independent domains:

| File | Owns |
| --- | --- |
| `typography.css` | Font families, type scale, and line height |
| `spacing.css` | Shared spacing scale and base unit |
| `shape.css` | Radius and elevation geometry |
| `motion.css` | Durations and easing |

The directory remains flat while one file tells the truth for each domain. If a
domain later contains multiple passes with private dependencies, it may become
`tokens/<domain>/`. File length alone does not create a directory.

Visibility is explicit in the names:

| Visibility | Namespace |
| --- | --- |
| Private theme material | `--palette-*`, `--theme-*` |
| Private chromatic interface | `--chromatic-*` |
| Private semantic identity | `--semantic-*` |
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

- `styles.md` explains the end-to-end transformation and consumer surface.
- `chromatic-themes.md` defines the theme and chromatic-slot interfaces.
- Every theme owns `<theme>.md` because its palette and theory are substantive.
- `semantic-sets.md` defines and compares the flat assignments.
- `tokens.md` enumerates the public API and usage laws.
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
it behaves identically from the repository root and `apps/frontend/`. It calls
the exported rules, sorts failures by path, line, and rule id, prints all
failures in one run, and exits nonzero when any exist.

`rules.mjs` contains no process exit or console output. It exports functions over
explicit roots so tests can run them against temporary fixture trees:

```js
checkStyleStructure({ stylesRoot, packageRoot })
checkStyleImports({ stylesRoot, packageRoot })
checkStyleDeclarations({ stylesRoot })
checkStyleConsumers({ sourceRoot, stylesRoot })
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
- selectors containing `data-theme` and `data-set`;
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
source text. `simple-components/` is excluded because it is generated or
vendor-derived. The palette demo is the only diagnostics exception: it may
read `--palette-*`, but may not import internal CSS or author literal colors.

### Rule set

Rule ids are stable so fixture names and future suppressions can name a precise
contract.

| Rule | Enforcement |
| --- | --- |
| `STY001 structure` | Only `styles.md`, `app.css`, and the four named stage directories exist at the root. Theme and integration directories have matching documents and required CSS. Semantic sets and token domains remain files. All authored names are kebab-case. |
| `STY002 documentation` | Required stage, theme, and integration documents exist. No parallel implementation document remains under `docs/style/` after migration. |
| `STY003 public-door` | `src/routes/+layout.svelte` imports `$lib/styles/app.css` exactly once. No other file imports `styles/*.css`. |
| `STY004 manifest` | Every authored stage CSS file is imported exactly once by `app.css`; no missing, duplicate, or transitive local imports exist. `generated.css` is the sole unreachable CSS file. |
| `STY005 stage-order` | Imports are contiguous in prelude, chromatic-theme, semantic-set, token, integration order. The default theme/set precedes alternates; `slots.css` follows all theme files. |
| `STY006 declaration-owner` | A declaration's namespace is owned by its stage and file. Duplicate custom-property declarations are rejected except the same interface intentionally repeated once per mutually exclusive theme or set selector. |
| `STY007 dependency-edge` | Theme files reference their own palette values; slots reference theme material; sets reference chromatic values; tokens reference theme, chromatic, or semantic values; integrations reference public tokens only. References cannot point backward or skip the public boundary. |
| `STY008 literal-owner` | Literal colors occur only in `<theme>/<theme>.css`. Literal durations/easing occur only in `tokens/motion.css`; shared font/type values only in typography; shared radii/shadows only in shape. |
| `STY009 theme-interface` | Directory, file, document, and selector names agree. Exactly one default binds `:root`; every theme declares one `color-scheme`; all themes declare identical theme token sets. |
| `STY010 theme-integration` | The default theme agrees with `app.html`. Themes declaring dark `color-scheme` exactly match the theme list in Tailwind's `dark` custom variant. |
| `STY011 set-interface` | File and selector names agree. Exactly one default binds `:root`. Every set declares the same five anchors times seven jobs and every value is a direct `--semantic-*` to `--chromatic-*` alias. |
| `STY012 set-semantics` | Primary, secondary, and tertiary hues are pairwise distinct. Accent assignments do not use the fixed success, danger, attention, or inactive hues listed by the semantic-set contract. |
| `STY013 integration-boundary` | Integration CSS declares only external compatibility namespaces or variants and references only public tokens. The integration document names every authored and generated file in its directory. |
| `STY014 quarantine` | `x-integrations/shadcn/generated.css` is the exact `components.json` CSS target, has the quarantine header, and is not imported anywhere. No other file is silently exempt from reachability. |
| `STY015 consumer-surface` | Authored consumers cannot reference private stage variables, import an internal stylesheet, or contain literal colors. Only the named palette diagnostic may read `--palette-*`. |

Contrast is deliberately not a structural rule. A separate contract test parses
theme values, resolves the light and dark slot mappings, and measures each
documented foreground/background pairing. Rendered theme-by-set combinations,
focus behavior, and reduced motion belong to browser or visual tests when that
harness exists.

### Fixture strategy

`build-fixtures.mjs` creates a minimal valid style tree in a temporary directory.
It is generated rather than committed as dozens of copied trees, so changes to
the valid contract have one source.

Each linter test applies one mutation to that valid tree and asserts the exact
rule id, path, and relevant message. Required mutations include:

- a theme missing one palette value;
- an alternate theme imported before the default;
- a semantic set missing one job;
- a token reaching directly into a palette;
- an integration reaching into a chromatic variable;
- a literal color in a view;
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
    "new-style-theme": "node scripts/generation/styles/new-theme.mjs",
    "new-semantic-set": "node scripts/generation/styles/new-semantic-set.mjs"
  }
}
```

The existing `test:scripts` glob already discovers
`scripts/lint/styles/test/lint.test.mjs` and the generator tests. The eventual
package-wide `lint` aggregates capabilities, models, views, and styles; the
style CLI remains independently runnable during translation.

A successful run reports counts instead of listing every file:

```text
style lint: 2 themes, 3 semantic sets, 5 token domains, 2 integrations; graph and consumer surface clean
```

## Generation implementation

Only repeatable, fully specified variants get generators.

```text
scripts/generation/styles/
├── new-theme.mjs
├── new-semantic-set.mjs
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

Generated inventories in `chromatic-themes.md` and `semantic-sets.md` are bounded
by explicit comments:

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
a deliberate manual migration checked by `STY009` and `STY010`.

### `new-semantic-set.mjs`

Usage:

```text
pnpm new-semantic-set -- <name> \
  --primary <hue> \
  --secondary <hue> \
  --tertiary <hue> \
  --accent-1 <hue> \
  --accent-2 <hue>
```

The command reads valid hue and job names from `slots.css`; they are not
duplicated as a second hard-coded list in the generator.

It then:

1. validates the name and five assignments against the semantic-set rules;
2. expands each assignment across the seven discovered jobs, producing the full
   35 direct aliases;
3. binds the new set only to `[data-set="<name>"]`;
4. writes `semantic-sets/<name>.css`;
5. inserts its import after the default and among alternates alphabetically;
6. adds the assignment row to the generated comparison table;
7. validates the full planned result with the style rules.

The default set, like the default theme, is changed manually and verified by
lint. A set does not get a Markdown file because the comparison row exposes its
entire decision.

### Generator tests

Generator tests run in temporary copies of a minimal valid package and cover:

- invocation from both repository and package working directories;
- valid light and dark theme generation;
- selector, import, documentation, and Tailwind registration updates;
- exact 35-alias semantic-set generation;
- invalid names, missing sources, unknown hues, and assignment violations;
- refusal to overwrite existing variants;
- rollback after a simulated write failure;
- idempotent failure on a repeated command;
- a clean style-lint result after successful generation.

## Translation record

The migration was performed in dependency order so each step had a defined
input and output. These stages remain the rollback and review boundaries.

### 1. Build enforcement against fixtures

The PostCSS dependencies, rule module, CLI, and fixture tests were established
before translating production. `lint:styles` is now part of aggregate lint.

### 2. Establish the chromatic stage

- Create `styles/chromatic-themes/<theme>/` directories.
- Merge each current palette and theory document into `<theme>/<theme>.md`.
- Move the theme CSS without changing its literal values.
- Move `system/color/slots.css` to `chromatic-themes/slots.css`.
- Rename `--hue-*` to `--chromatic-*` and theme-owned neutral implementation
  values to the documented private `--theme-*` surface where necessary.
- Compare theme declaration sets and contrast results before continuing.

### 3. Establish semantic sets

- Move `system/color/sets/*.css` to flat `semantic-sets/*.css`.
- Rename `--anchor-*` to `--semantic-*`.
- Condense the current set documents into the generated comparison table and
  retain non-tabular rationale in `semantic-sets.md`.
- Verify that every file contains exactly 35 direct aliases.

### 4. Establish the public token API

- Merge current `roles.css` and first-party `utilities.css` decisions into
  `tokens/color.css`.
- Move typography, spacing, shape, and motion into same-name token files.
- Change internal references to the chromatic and semantic namespaces.
- Scan all authored consumers and replace private-layer references with public
  tokens before enabling `STY015`.

### 5. Isolate integrations

- Move Tailwind aliases and the theme-aware dark variant to
  `x-integrations/tailwind/tailwind.css`.
- Move the shadcn bridge and registry variants to their purpose-named files.
- Move the CLI target to `x-integrations/shadcn/generated.css` and update
  `components.json`.
- Replace the bridge's direct hue references with public semantic tokens.
- Prove the generated quarantine is unreachable.

### 6. Replace the public door and documents

- Rewrite `styles/app.css` with the explicit stage manifest and final universal
  rules.
- Update the root layout import and comments in `app.html`.
- Move `mandate.md` to `docs/design-preferences.md`.
- Move or condense token-specific documents into the stage that owns them.
- Relocate broader interaction/accessibility theory without making styles its
  accidental owner.
- Remove the old `src/lib/style/` and `docs/style/` trees only after searches
  show no remaining imports or links.

### 7. Enable generation and enforcement

- Add and test both generators against the translated production contract.
- Add `lint:styles` to package scripts.
- Run script tests, style lint, typecheck, unit tests, and build.
- Enable style lint in the aggregate lint command.

## Translation map

| Current | Target |
| --- | --- |
| `src/lib/style/themes/celestial.css` | `styles/chromatic-themes/celestial/celestial.css` |
| `src/lib/style/themes/cyberpunk.css` | `styles/chromatic-themes/cyberpunk/cyberpunk.css` |
| `system/color/slots.css` | `styles/chromatic-themes/slots.css` |
| `system/color/sets/*.css` | `styles/semantic-sets/*.css` |
| `system/color/roles.css` and `utilities.css` | `styles/tokens/color.css` |
| Other `system/*.css` token files | same-name files under `styles/tokens/` |
| Tailwind custom variants in `app.css` | `styles/x-integrations/tailwind/tailwind.css` |
| `shadcn-bridge.css` | `styles/x-integrations/shadcn/bridge.css` |
| Registry state variants in `app.css` | `styles/x-integrations/shadcn/variants.css` |
| `vendor-generated.css` | `styles/x-integrations/shadcn/generated.css` |
| `docs/style/mandate.md` | `docs/design-preferences.md` |
| Remaining token-specific `docs/style/**` | corresponding stage documents |

## Acceptance criteria

The translation is complete when:

- the directory listing reads in process order without a guide;
- `app.css` shows every executed stage and no hidden CSS barrel exists;
- only the root layout imports the style door;
- every theme and integration owns a documented directory;
- semantic sets and token domains remain flat and complete;
- no authored consumer references a private stage namespace;
- literal colors exist only in theme implementations;
- every theme-by-set combination resolves the full public token API;
- default, alternate, and dark-theme registrations agree;
- shadcn generated CSS remains unreachable;
- `src/lib/style/` and `docs/style/` no longer exist;
- generator tests, linter fixtures, style contract tests, typecheck, tests, and
  production build all pass;
- the rendered design has not changed except where a separately reviewed token
  correction is explicitly recorded.
