/**
 * Render-boundary validation for document values that reach the DOM.
 *
 * Findings from the 2026-07-27 security pass (catalog **S4**) — verified against
 * `../taurus-omega`, not assumed:
 *
 * - **Link hrefs are NOT scheme-checked server-side.** Omega's
 *   `validateMarkPayload` requires only a non-empty string
 *   (`changeset_validate.go`), so `javascript:…` is accepted, stored, and served
 *   back. Alpha rendered it verbatim. That is a live stored-XSS path, not a
 *   defense-in-depth gap.
 * - **`fg`/`bg` colours ARE validated** by Omega's `validCSSColor`
 *   (`style.go`) — rgb/rgba/hsl/hsla with a strict charset, `#hex` of 3/4/6/8
 *   digits, or an alphabetic named colour. The checks here mirror those rules so
 *   the two agree, as a second line rather than the only one.
 * - **Font family/size are only LENGTH-bounded** server-side (128 / 32 chars,
 *   `style.go`) with no charset check, and Alpha string-concatenates them into a
 *   `style` attribute. `Arial;background:url(//evil)` fits well inside 128 chars.
 *
 * So the comment in `bridge.ts` that Omega "sanitizes marks" is only true of
 * mark *ranges* (`sanitizeBlockMarks` prunes invalid ranges, not payloads).
 * Everything below assumes the client is the last line of defence, because for
 * hrefs and font names it currently is.
 */

/** Schemes a document link may use. Everything else is dropped. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/** A base only used to resolve relative hrefs; never navigated to. */
const RESOLUTION_BASE = 'https://taurus.invalid/';

/**
 * The href to render, or `null` when it must be dropped.
 *
 * Relative, root-relative, in-document and query-only links are kept as-is —
 * they carry no scheme to abuse. Everything else must parse to an allowlisted
 * scheme. Control characters are rejected outright: browsers strip them while
 * resolving, so `java&#9;script:alert(1)` would otherwise slip through as
 * `javascript:`.
 */
export function safeHref(raw: string | null | undefined): string | null {
  const href = (raw ?? '').trim();
  if (!href) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(href)) return null;
  if (href.startsWith('#') || href.startsWith('?')) return href;
  try {
    const url = new URL(href, RESOLUTION_BASE);
    return SAFE_SCHEMES.includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

/**
 * A CSS colour safe to interpolate, or `null`. Mirrors Omega's `validCSSColor`:
 * a functional notation with a digits/letters/`.,%()` charset, a 3/4/6/8-digit
 * hex, or a purely alphabetic named colour.
 */
export function safeCssColor(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.length > 64) return null;
  const lower = value.toLowerCase();
  for (const fn of ['rgb(', 'rgba(', 'hsl(', 'hsla(']) {
    if (lower.startsWith(fn) && value.endsWith(')')) {
      return /^[0-9a-zA-Z.,%\s()]+$/.test(value) ? value : null;
    }
  }
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    return [3, 4, 6, 8].includes(hex.length) && /^[0-9a-fA-F]+$/.test(hex) ? value : null;
  }
  return /^[a-zA-Z]+$/.test(value) ? value : null;
}

/**
 * A CSS length safe to interpolate (`16px`, `1.5em`, `120%`), or `null`.
 * Deliberately a small unit set — document typography needs no more, and a
 * narrow pattern is what keeps `calc(` and friends out.
 */
export function safeCssLength(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.length > 32) return null;
  return /^\d+(\.\d+)?(px|pt|em|rem|%)$/.test(value) ? value : null;
}

/**
 * A font-family list safe to interpolate, or `null`. Allows the characters a
 * real family list needs — letters, digits, spaces, quotes, commas, hyphens,
 * periods — and nothing that could close the declaration or open a function:
 * no `;`, `{`, `}`, `(`, `)`, `:`, `\`, `<`, `>`.
 */
export function safeFontFamily(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.length > 128) return null;
  return /^[a-zA-Z0-9 '",._-]+$/.test(value) ? value : null;
}

/** Build a `key: value` CSS declaration only when the value validates. */
export function cssDeclaration(
  property: string,
  value: string | null | undefined,
  validate: (raw: string | null | undefined) => string | null
): string | null {
  const safe = validate(value);
  return safe ? `${property}: ${safe}` : null;
}
