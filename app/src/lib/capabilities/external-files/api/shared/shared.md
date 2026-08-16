# Shared External Files Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-file.ts`](require-file.ts) | that a file id names a file in the caller's project, and that a caller learns nothing from the answer when it does not |

## `requireFile`

`recordExtraction` and `remove` start with it, and `ingest` reaches it through
`previousVersion` when an uploader names the file it is replacing. It is promoted
rather than copied because it holds an invariant spanning them: the gate proves
the caller holds *a* project, and this is the only thing that proves the row is
in it.

**It throws "not found", never "forbidden".** A file in another project answers
exactly as one that never existed — distinguishing them would confirm the file
exists to someone with no right to know that.

Its return type is the stored row, which is deliberate: its callers are inside
this capability and want the fields they are about to patch, log, or delete, and
the conversion to `ExternalFile` belongs at the public boundary in `list`.
