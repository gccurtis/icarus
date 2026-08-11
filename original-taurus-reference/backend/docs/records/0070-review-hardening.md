# Review hardening: fixes from the document-editor backend review

An adversarial review of the document-editor backend work (records 0060–0069)
across three areas — the new capabilities, the document changes, and the
agent/access/transport changes — surfaced two high-severity correctness bugs in
the custom-typography feature and a set of security and robustness issues. All
are fixed here with regression tests.

## High-severity (custom typography, record 0069)

- **Style registry froze when a block had custom-only typography.** A
  custom-typography-only block carries a bare `BlockStyleRef` with an empty
  `StyleID`, but `validStoredStyleRef` required a resolvable `StyleID`, so
  `validStyleSystem` went false and every registry-editing op
  (`put_style_definition`, `set_style_default`, `replace_style`) failed with
  `ErrConflict` forever. Fixed: a style-less ref is valid when it carries only
  custom typography (`onlyCustomOverrides`). Regression:
  `TestCustomTypographyDoesNotFreezeStyleRegistry`.
- **Concurrent `set_block_style_overrides` silently clobbered a committed custom
  typography edit.** `set_block_style_overrides` replaces the whole `Overrides`
  (Custom included) but its rebase footprint didn't overlap
  `set_block_custom_typography`'s, so a stale edit was wrongly admitted. Fixed:
  both ops now write the same `block-style-overrides` footprint key. Regression:
  `TestCustomTypographyConcurrentStyleOverridesConflict`.

## Security

- **Stored XSS via file download.** `GET /files/:id` served the uploader's
  content type inline, so an uploaded `text/html` file executed in the app's
  origin. Fixed: downloads are always `Content-Disposition: attachment` (new
  `endpoint.Response.Filename`, sanitized against header injection).
- **Stored XSS / injection via `avatarUrl`.** The avatar URL was only
  length-bounded, so `javascript:`/`data:` values were stored and served to
  project peers. Fixed: `validAvatarURL` allows only a same-origin relative path
  or an `https://` URL. Test: `TestUpdateProfileAvatarURLScheme`.
- **Web-retrieval redirect SSRF.** The default HTTP client followed redirects to
  non-HTTPS/private targets, contradicting the package's HTTPS-only guarantee.
  Fixed: a `CheckRedirect` rejects non-HTTPS redirects and caps redirect depth.

## Robustness

- **Comments turned infra errors into wrong data.** `hydrate` swallowed a
  reply-store error into an empty thread and any anchor-read error into
  `anchorOrphaned=true`. Fixed with an `ErrAnchorNotFound` sentinel: a genuinely
  missing anchor still reads orphaned, but an infrastructure error now propagates
  (→ 500) from `List`/`Get`/`Patch`/`Create`. Regression:
  `TestHydratePropagatesStoreError`.
- **Markdown round-trip corrupted literal `*`/`_` and dropped escapes.** The
  inline parser greedily paired any two delimiters. Fixed: render backslash-
  escapes inline metacharacters (code spans excepted); parse honors backslash
  escapes, requires emphasis to flank non-space, and treats intra-word `_` as
  literal — so `5 * 3`, `snake_case`, and escaped delimiters round-trip.
  Regression: `TestMarkdownRoundTripPreservesLiteralSpecials`.
- **`POST /documents/import` was unbounded.** Capped at 2 MiB (→ 413).
- **`POST /resources/generate` could orphan an empty document.** An over-long
  prompt made the composed Action objective exceed the task-text cap after the
  resource was already created. Fixed: the prompt is length-bounded up front, and
  `deriveName` truncates on a rune boundary.

## Stale dev-tests fixed (pre-existing, unrelated to the feature work)

- `dev-test/documents/run.sh` expected hard delete; updated to the current
  soft-delete → trash → purge flow.
- `dev-test/changesets/run.sh` used the long-removed `set_row_height` op (gone
  since commit e16a3b6); swapped for the current `set_block_line_height`.

Build, vet, and the full unit + deterministic dev-test suites are green.
