# Taurus Alpha reference corpus

> Status: non-authoritative reference. Current implementation, explicit product decisions, and accepted Taurus Omega contracts take precedence.

This directory assembles earlier Taurus frontend thinking so it remains easy to consult while Taurus Alpha is built incrementally.

Taurus Alpha owns presentation and interaction. Taurus Omega owns canonical resources, durable behavior, validation, authorization, and backend truth. These documents describe what the frontend should make possible and how it should feel; they do not freeze component boundaries, application state libraries, API shapes, or editor implementation details.

## Contents

- [Application shell](application-shell.md) describes the stable spatial and interaction model around every resource.
- [Document editor](document-editor.md) describes the intended authoring experience and the frontend/backend boundary.
- [Style baseline](style/README.md) preserves the historical design baseline (non-authoritative). The **authoritative** implemented style spec lives in [`docs/style/`](../../style/README.md).
- [Notion reference index](notion-reference-index.md) links the historical Taurus frontend corpus and explains how to interpret it.

## How to use this material

These documents describe prior intent, useful mental models, and likely product behavior. They do not create requirements merely by existing. When sources conflict, prefer:

1. the latest explicit product decision;
2. accepted Taurus Omega product and service contracts;
3. behavior already proven in the current Alpha and Omega implementations;
4. the authoritative style spec in `docs/style/` (matches `src/app.css`);
5. this reference corpus — including the design baseline in `docs/reference/style/` — for rationale and possibilities.

Historical implementation architecture is evidence, never a binding requirement. The implementation should remain free to evolve as Omega exposes real product contracts and as incremental prototypes reveal what works.
