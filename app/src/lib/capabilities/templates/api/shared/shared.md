# Shared Templates Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-template.ts`](require-template.ts) | that a template id names one this project may *see* — its own, or one belonging to no project |
| [`require-own-template.ts`](require-own-template.ts) | that a template id names one this project may *change* |

## Two procedures, because visibility and editability are different questions

Here they come apart. A global template is readable from every project and
writable from none of them, so `instantiate` admits one and `revise` and
`remove` do not. Collapsing them into one procedure with a flag would put the
decision at each call site, which is where it gets forgotten.

`requireOwnTemplate` is built on `requireTemplate` rather than beside it, so the
"not found" rule is stated once and the editability rule adds to it.

## Not found, never forbidden — except for a global

A template in another project answers exactly as one that never existed, because
telling them apart confirms it exists to someone with no right to know that.

A global is refused as **not editable**, and that is not an exception to the
disclosure rule. It is in the list the caller just read, so "no such template"
would deny something they can already see and withhold the one thing they need
told: copy it, then edit the copy. There is no sharing mechanism between the two,
which is what keeps "who can edit this" answerable from the template alone.

Both return the stored row, which is deliberate: their callers are inside this
capability and want the fields they are about to patch, copy, or log.
