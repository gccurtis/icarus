# Support material

Background worth consulting, none of it authoritative. When anything here conflicts with
the code, [`../architecture/`](../architecture/README.md), [`../style/`](../style/README.md),
or an accepted Omega contract, **those win** — nothing in this directory creates a
requirement merely by existing.

## Contents

- [`omega-deck-contract.md`](omega-deck-contract.md) — the backend data-model contract for
  an Omega **Deck** resource: the `Deck → Slide → VisualObject → RichContent → TextBlock
  → TextRun → TextAtom` hierarchy, layout templates, styling inheritance, mutators,
  concurrency, and acceptance proof.

  **Read it as a target, not a description.** None of it is implemented on either side:
  Alpha's slides stage runs on a flat local mock (`systems/slides/types.ts`,
  `createMockDeck`) and `systems/resources/api.ts` injects `slides` as an available kind
  and creates it without calling Omega. Reconciling this contract with that mock is part
  of fixing the slide editor — see [`../roadmap/`](../roadmap/README.md) §3.

- [`reference/`](reference/README.md) — the historical Taurus front-end corpus: the
  application-shell and document-editor intent documents, the original design baseline
  (`reference/style/`), and the Notion index. Useful for mental models and prior intent;
  explicitly superseded on any point where the shipped implementation differs. The
  authoritative style spec is [`../style/`](../style/README.md).
