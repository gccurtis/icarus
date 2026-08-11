# Reference

This tree is **reference material** for the Taurus Omega build. It describes the
product we are working toward and the prior evidence that grounds it. It is not
the authority for what currently exists in this repository, and it may read as
more settled than the code is. Treat it as a detailed reference to consult while
building incrementally — not a spec that must be implemented as written.

## Product intent

- [Product](product/README.md) — who Taurus is for and what the product must do.
- [Architecture](architecture/README.md) — runtime, authority, persistence, and
  dependency shape.
- [Capabilities](capabilities/README.md) — behavior contracts for product
  capabilities.
- [Flows](flows/README.md) — end-to-end sequences crossing architectural layers.
- [Implementation](implementation/README.md) — the earlier greenfield
  construction plan and proof boundaries.
- [Decisions](decisions/README.md) — consequential choices and revisit triggers.
- [Questions](questions/README.md) — unresolved decisions that can change
  behavior.

## Grounding

- [Source register](source-register.md) — the sources these documents draw on.
- [Nova evidence](nova-evidence.md) — behavior demonstrated by Nova versus
  target-only gaps.
- [Glossary](glossary.md) — canonical Omega vocabulary.

When a reference document conflicts with a current decision or with the code we
have actually built, the current decision and the code win.
