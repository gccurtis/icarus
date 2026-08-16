# API: `subjects`

What one finding or hypothesis speaks to.

Registered as `api.capabilities.researchLinks.subjects`, built from
`projectQuery`.

## Procedure Tree

```text
subjects(ctx, scope, bearer)
├── ctx.db.query("researchLinks").withIndex("by_bearer")  subjects.ts
└── asLink(row)                                           ../shared/as-link.ts
```

## The other direction of the same edges

This is what a foreign key on the narrower object could not do. One piece of
evidence routinely answers more than one thing being asked, and a `questionId` on
the finding would force somebody to pick the one it "really" belongs to and lose
the rest — so the answer here mixes hypotheses and questions, and that mixture is
the point.

## No kind filter

Unlike [`bearers`](../bearers/bearers.md), what a bearer speaks to is one list
read whole. A filter would exist for symmetry rather than for a reading anybody
asked for.
