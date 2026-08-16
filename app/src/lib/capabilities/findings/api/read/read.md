# API: `read`

One finding, whole.

Registered as `api.capabilities.findings.read`, built from `projectQuery`.

## Procedure Tree

```text
read(ctx, scope, id)
└── requireFinding(ctx, scope, id)   ../shared/require-finding.ts
```

## Why findings have a `read` and documents do not

A [document's](../../../documents/overview.md) body lives in `revisions`, so its
row holds nothing a list has not already given you. A finding's body is on its
own row and *is* the finding — the claim, the evidence, the caveat — so there has
to be something that returns it.

It answers "not found" for a finding in another project, exactly as for one that
never existed.
