  PHASE 0 — ISOLATE

  Create a worktree and work in it. Main has uncommitted work
  (docs/artifacts/slide-deck-editor-buildout/*,
  docs/document-editor-handoff.md)
  that must not be disturbed. Run no git command beyond creating the
  worktree.

  PHASE 1 — ARCHIVE AND DELETE

  Baseline: `nix develop ./infra/devshell --command pnpm --dir app lint`
  currently
  reports 63 checks · 63 clean · 0 findings. It must still report that when
  done.

  DELETE:  reference/     the frozen pre-rebuild tree. Deliberate, not
  archived.

  MOVE to docs/archive/, preserving structure:
    docs/**        except docs/artifacts/ and docs/archive/ itself
    docs/tables/   the schema contract; superseded by the wiki
    app/docs/**    as docs/archive/app-docs/

  LEAVE:  every .md under app/src/lib/**  ·  docs/artifacts/  ·  root
  README.md

  MANDATORY GUARD. Two checks read colocated markdown and require every
  path it
  names to resolve — surfaces/documented-paths-resolve and
  model/method-tree-paths-resolve. Some of those documents name paths
  outside
  app/src/lib; at least one does
  (app/src/lib/development-views/vocabulary/vocabulary.md names
  docs/screen-panel-views/README.md, which this archive would move).

  Before moving anything: enumerate every path named by every linted
  document using
  the repo's own resolver (app/scripts/lint/shared/docs.mjs), and list
  those
  pointing outside app/src/lib. For each, either keep the target where it
  is or
  update the naming document — one targeted edit per file. Report the list.
  Re-run
  lint and confirm 63 clean before Phase 2.

  Plain `mv`. Do not rewrite archived file contents; their internal links
  may go
  stale. Read the docs before archiving — they are the design record and
  the best
  account of intent. Mine them, then verify against code. Where a doc and
  the code
  disagree the code wins, and the wiki says what the code does. An archived
  doc is
  never a citation for current behaviour.

  PHASE 2 — THE WIKI

  The central tool for education and review of this codebase: architecture,
  design,
  algorithms, data model, invariants, test coverage. Someone who has never
  opened
  the repo should be able to learn it here; someone who knows it should be
  able to
  review a design decision here. Completeness and correctness are what
  matter.

  Served app at wiki/ — own package.json, own Vite config, React.
  Independent of
  app/: add no dependencies to app/, change nothing under app/src/. Runs
  with
    nix develop ./infra/devshell --command pnpm --dir wiki dev

  ARCHITECTURE — extract, then explain.

    wiki/extract/ walks the real tree and emits JSON: every file under
  app/src with
    its tree, kind and imports; every lint check with its `says` line
  verbatim;
    every model object, capability, component, vocabulary, surface, view,
  domain
    and table; every test file and what it exercises; every generator
  command; the
    whole token system. Complete by construction, derived from the
  filesystem,
    never hand-listed — the repo's own principle is that the filesystem is
  the
    registry and a list beside it becomes a second, disagreeing answer.

    wiki/src/ renders that JSON in React, plus authored prose for what
  extraction
    cannot know: why a tree exists, what an algorithm does, what a decision
  cost,
    where the seams are.

  COVERAGE — the entire codebase, explained and correct.

    All nine trees under app/src/lib. For each: what it is, what it owns,
  what it
    may and may not import, its shape on disk, its invariants, what to open
  first.
    Read each tree's own .md — they state their contracts.

    Every one of the ~870 files under app/src reachable. Depth is graded,
  coverage
    is not: architecture-bearing files get real explanation, leaf and
  generated
    files get an indexed entry naming their role. No file simply absent.

    The 63 lint checks as documented law, grouped by tree, each `says`
  quoted
    exactly, each with what breaks when it fails.

    The generator system (scripts/generation/, the pnpm new-* commands) and
  how
    "adding a check is adding a file" shapes the architecture.

    The design system as a layered contract, its own major section, read
  from
    app/src/lib/styles/ — the chromatic themes, slots.css,
  semantic-tokens/, and
    x-integrations/. Their .md files state the layering and the rules;
  document
    what they say, and show a reader how a colour gets from a palette entry
  to a
    component.

    The data model — entities, relations, and the tables the code actually
  builds,
    from representation/ and model/, not from the archived docs/tables.

    Algorithms explained, not named: the document-first editor (runtime
  live body
    is truth, ProseMirror a projection and input device, structural
  addresses,
    ops-first with typing the exception), the semantic overlay, konva
  canvas work,
    layerchart. Show mechanism.

    Test coverage first-class: every test file mapped to what it covers,
  per tree,
    gaps named honestly. `pnpm test` and `pnpm test:scripts` are separate
  suites —
    say which covers what. Never imply coverage that does not exist.

    A change traced end to end through real files, twice: once through a
    capability, once through a view.

  NAVIGATION
    Left sidepanel with collapsible concept groups, state preserved across
    navigation. Client-side search over the extracted index — paths,
  symbols, check
    names, invariant text, token names, headings — instant and
  keyboard-reachable.
    Deep-linkable routes for every section and file entry. A per-tree
  browser that
    reaches every file.

  AESTHETIC
    The wiki wears the product's own design system. Read
  app/src/lib/styles/ and
    its contract documents, import the real stylesheets — the Celestial
  chromatic
    theme, slots.css, and all of semantic-tokens/ — and style the wiki
  using only
    --token-* values. Copy no hex values. Define no parallel palette.
  Reference no
    --palette-* directly: that is a defect here for the same reason it is
  one in
    the app. Change nothing in styles/ — no ramp, no step, no token.

    The wiki should be a working demonstration of the system it documents.

    Layout is full width and structural: wide tables, wide diagrams, prose
  measure
    ~70ch, left-aligned, never a centred editorial column. Diagrams as
  inline SVG
    showing real mechanism — no diagram library.

  PHASE 3 — VERIFY

  wiki/extract/check.mjs, written in the spirit of the repo's own linters:
  fails if
  the wiki names a path, symbol, token, or check that does not exist in
  app/, and
  fails if any file under app/src is unreachable from the wiki. Run it. Fix
  it.

  Correctness is not a final pass. Every path, symbol, count, token and
  invariant
  must be read from the code before you write it. Do not infer an API from
  a name.
  Do not carry a number forward from an archived doc. If you cannot verify
  something, say so in the wiki rather than asserting it.

  CONSTRAINTS
    Modify nothing under app/src/ except a linked path Phase 1 requires.
    Write no comments, anywhere.
    No sed, no perl, no bulk rewrite commands. One targeted edit per file.
    No git commands beyond creating the worktree.

  DONE MEANS
    pnpm --dir app lint    63 checks · 63 clean · 0 findings
    pnpm --dir app test    passes
    wiki/extract/check.mjs passes, every app/src file reachable
    the wiki serves; search, sidepanel and every route work
    you report: files archived, reference/ deleted, linked paths
  reconciled, files
    covered per tree, checks documented, tests mapped, and every gap left
