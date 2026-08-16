# Shared Spreadsheet Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-spreadsheet.ts`](require-spreadsheet.ts) | that a workbook id names a workbook in the caller's project, and that a caller learns nothing from the answer when it does not |

## `requireSpreadsheet`

`rename` and `remove` both start with it, and it is promoted rather than copied
because it holds an invariant spanning them: the gate proves the caller holds *a*
project, and this is the only thing that proves the row is in it.

**It throws "not found", never "forbidden".** A workbook in another project
answers exactly as one that never existed.

Its return type is the stored row: its callers are inside this capability and
want the fields they are about to patch or log, and the conversion to
`Spreadsheet` belongs at the public boundary in `list`.
