# Change record — 2026-07-20 — Sign-in wired to Taurus Omega

The sign-in screen is now backed by the real Omega auth API (verified end to end),
with client-side validation feedback, a dev proxy, a one-command run script, and
the first front-end↔back-end discrepancy docs.

## Login validation feedback

```svelte
// required + email format + required password, cleared on input; a form-level
// Alert carries the backend 401.
emailError = !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address.' : '';
```

**Why:** typing a malformed email gave no feedback. **Purpose:** immediate,
accessible error messages. **Why this way:** field-level errors validate before the
request; the form-level `Alert` slot is where the backend's auth failure lands.

## Real auth via a proxied API client

```ts
// src/lib/data/api.ts — fetch('/api'+path, {credentials:'include'}), throws ApiError
// src/lib/data/session.ts — signIn/signOut/hydrateSession over /auth/*
```

**Why:** the mock session had to become real. **Purpose:** `signIn` →
`POST /auth/login`, hydrate via `GET /auth/me`, `signOut` → `POST /auth/logout`; the
cookie is the session and the store caches the user. **Why this way:** a `ready`
flag gates redirects until hydration resolves; a `401` surfaces as "Invalid email or
password." Verified: register → login → `Set-Cookie` through the proxy → `/auth/me`
→ `200`, and a persisted user survives a backend restart.

## Dev transport: Vite HTTPS + /api proxy

```ts
// vite.config.ts — basicSsl() + proxy '/api' -> https://127.0.0.1:8443 (secure:false)
```

**Why:** the session cookie is `Secure` + `SameSite=Lax` over HTTPS self-signed.
**Purpose:** the browser sees one HTTPS origin so the cookie is stored and sent.
**Why this way:** a same-origin proxy avoids CORS and satisfies `Secure`; the
backend runs on `:8443` (a local, gitignored override in Omega, since `:8080` is
occupied on this machine).

## One-command run script

```bash
pnpm dev:all   # scripts/dev.sh — Omega (:8443, its own nix devShell) + Vite, Ctrl-C stops both
```

**Why:** running two repos by hand is tedious. **Purpose:** launch and cleanly tear
down the whole stack together. **Why this way:** a `kill 0` trap + `wait -n` stop
both if either exits; output is color-prefixed `[omega]`/`[alpha]`. Verified both
start and shut down with no orphans.

## Front-end-first + discrepancy docs

```text
docs/discrepancies/{README, authentication, roles}.md  +  AGENTS.md section
```

**Why:** the UX model and the backend model differ. **Purpose:** record the
convention (design front-end first, back it with Omega, translate at the data
boundary) and the specific mismatches. **Why this way:** keeps the UX shape while
making every translation intentional; `authentication.md` covers the session/name/
transport differences, `roles.md` the `owner/editor/viewer` ↔ `owner/edit/read` map.
