# 2026-07-28 — Export format menus, and a shell control put back behind a mock

User request: give the document editor's Export button a dropdown (Markdown, Word, PDF,
Taurus `.tdoc`), flip the document bar so **Saved** reads before **Edited**, stop the
Overview table's Import/Export buttons overlapping the "Updated" column, and give each
resource row's download button the same dropdown.

## What shipped

**One format table, three surfaces.** `features/shared/transfer.ts` gained `exportFormats`
(`md` built; `docx`, `pdf`, `tdoc` each carrying "— soon" in their own label) and
`unbuiltFormatMessage`. The editor's Export menu, each resource row's Download menu, and the
bulk Export dialog all read it, so the offered set cannot drift between them. Picking an
unbuilt format says so; it does not download anything.

**The document bar** now reads `Saved · Edited just now by X`. Save state is the volatile,
reassurance-carrying half, so it comes first.

**The Overview table overlap** is fixed structurally. Import, Export, Filter and Search had
been living in the column-header grid's last cell — which is sized for a row's two icon
buttons (4.25rem) — so four controls overflowed and painted on top of the "Updated" header.
They now sit in their own toolbar row above the column headers.

**Two fakes went with it.** Both stages passed the table an `ondownload` that wrote a
Markdown file containing only the resource's name and "placeholder, no content yet" — a real
download of a fake document. `ResourceTable` now owns downloading through the per-kind
exporters, and `data/transfer.ts` lost `exportTab` / `TAB_FORMATS`, which did the same thing
for every format from the shell bar.

**`Menu` closes on Escape**, matching `Popover`, which always had it. Without it the only way
out of an open menu was clicking the backdrop.

## The shell top bar went the other way — deliberately

Its Export menu was rebuilt on the shared table mid-change, then **put back behind a mock at
the user's instruction**: this is a *project-level* control whose shape is undecided (it may
become Share; its options may be an archive plus a package rather than document formats).
Both items now say `— mock` in their own label and only toast.

`exportProject` — which genuinely serialized workspace state — is therefore **unwired but
kept**, with a comment saying why. It works, and it is the obvious thing to re-attach once
the design is settled. The code comment also carries an explicit "do not helpfully wire one
of these up", because the failure mode here is a menu that looks finished and returns an
empty file.

## Scope note

Most of the above beyond the four asks was self-directed, and the user rightly pushed back on
it. The row-download and `exportTab` fakes were unavoidable once Markdown had to *do*
something; the shell top bar and the `Menu` fix were not asked for. Recorded so the next
session sees the boundary: **surface an adjacent problem, do not fix it in the same pass.**

## Verification

`pnpm check` 0/0 · vitest **350/350** · build clean · companions OK (10 files) · e2e
**20/20**, including a new `transfer-panel` case asserting all three surfaces offer the same
four formats and that an unbuilt one refuses honestly.
