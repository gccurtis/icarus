# Backend request — validate document mark payloads (link schemes, font names)

**Priority:** **High (security)** · **Status:** Open · **Filed:** 2026-07-27

> **Standalone.** Everything needed to build this is in this document: what we found in
> Omega's own source, why the client fix is not enough, the proposed rules, and how to
> verify. No Alpha document needs to be read.

**One-line summary:** `POST /documents/:id/changes` accepts link marks with *any* scheme
(including `javascript:`) and font names with *any* characters, then stores them and serves
them to every client. Colours are correctly validated already.

## What we found

Alpha's client-side rendering assumed Omega sanitized inline mark payloads. Reading
`../taurus-omega` rather than assuming, that holds for colours but **not** for the two values
that reach the DOM most dangerously.

| Mark attr | Current rule (`core/capability/document/`) | Gap |
|---|---|---|
| `link.href` | `validateMarkPayload` → `if m.Attrs["href"] == ""` reject | **No scheme check.** `javascript:…`, `data:text/html,…`, `vbscript:…` are all accepted, stored, and served to every client. |
| `font.family` | `len(...) > maxCustomFontFamily` (128) | **No charset check.** `Arial;background:url(//evil.example)` is 36 chars and passes. |
| `font.size` | `len(...) > maxCustomFontSize` (32) | Same — no format check. |
| `fg` / `bg` | `validCSSColor` | ✅ Genuinely validated; no change requested. |

`sanitizeBlockMarks` (`clone.go`) prunes marks with invalid **ranges**, not payloads — worth
noting because the name reads like payload sanitization.

**Re-verified 2026-07-28** against current Omega: every row above still holds — a search for
`javascript`, `url.Parse`, or any scheme check across `core/capability/document/` returns only
test fixtures.

**One more gap found in that re-audit, outside the mark path.** `CustomTypography` (the
block-level and document-default typography set by `set_block_custom_typography` /
`set_default_typography`) is validated by `validateCustomTypography` in `style.go`, which bounds
**length only** — including its `Foreground` and `Background`, which do **not** go through
`validCSSColor`. So the colour safety above is true for *marks* and false for custom typography:
the same `red;}html{display:none` payload rejected on a `fg` mark is accepted as a block's
custom foreground. The file's own comment concedes the design ("the backend stores verbatim,
only length-bounded"). Please apply `validCSSColor` there too — it is the same validator, one
call site away, and it closes the identical hole by the identical means.

Omega already has the shape of the fix: `core/capability/access/access.go` validates profile
image URLs strictly (https only, rejecting `javascript:`/`data:`/protocol-relative). Link marks
just never got the same treatment.

## Why the client fix is not sufficient

Alpha now validates at both its render and write boundaries, so this cockpit is safe. But:

1. **Any other client** — a future mobile app, an integration, a script using the API — gets the
   raw value and would have to re-implement the same allowlist.
2. **Documents already stored** may contain unsafe hrefs; Alpha renders them inert, but they are
   still in the data.
3. The API accepts a payload it will never render safely, which is a validation gap regardless of
   who is reading.

Defence at the boundary that persists the data is the durable place for this.

## Proposed

In `validateMarkPayload`:

- **`MarkKindLink`** — parse `href` and accept only `http`, `https`, `mailto`, plus
  relative/in-document references (`/…`, `#…`, `?…`). Reject anything containing control
  characters before parsing (browsers strip them, so `java\tscript:` resolves to `javascript:`).
  Reject rather than silently rewrite, so the client can report it.
- **`MarkKindFont`** — keep the length bounds and add a charset check: `family` to letters,
  digits, spaces, quotes, commas, hyphens, periods (no `;{}()<>:\`); `size` to a
  `number + unit` form (`px|pt|em|rem|%`).

Same treatment for the equivalent fields on `CustomTypography` (`set_block_custom_typography`,
`set_default_typography`), which travel the same path into a `style` attribute.

**Omega owns the final contract** — if the rules differ from Alpha's, tell us and we will mirror
yours, as `safeCssColor` already mirrors `validCSSColor`.

## How to verify

Each is a `POST /documents/:documentID/changes` carrying one `set_mark`-style op:

1. `link.href = "javascript:alert(1)"` → **`400`**, and the document is unchanged.
2. `link.href = "java\tscript:alert(1)"` (a literal tab) → **`400`**. This is the classic
   bypass: browsers strip control characters while resolving, so it becomes `javascript:`.
3. `link.href = "https://example.com/x?y=1#z"` → **`201`**. Ordinary links must keep working.
4. `link.href = "/docs/page"`, `"#anchor"`, `"mailto:a@b.c"` → **`201`** (relative,
   in-document, and mail references are all legitimate).
5. `font.family = "Arial;background:url(//evil.example)"` → **`400`** (36 chars, so the
   existing length bound does not catch it).
6. `font.family = "IBM Plex Sans, Helvetica, 'Segoe UI', sans-serif"` → **`201`**.
7. `font.size = "16px"` / `"1.5rem"` → **`201`**; `font.size = "calc(100vw)"` → **`400`**.
8. `fg`/`bg` behaviour is unchanged — a regression check, not a new rule.

## When this ships

Alpha keeps its client-side validation (defence in depth is the right end state — it just should
not be the *only* defence). We will update the note in
`src/lib/systems/documents/sanitize.ts`, which currently records that the client is the last line.

**Tell us if your rules differ from the ones proposed above** and we will mirror yours exactly,
the way `safeCssColor` already mirrors Omega's `validCSSColor` — two subtly different definitions
of "valid" would be worse than either one alone.
