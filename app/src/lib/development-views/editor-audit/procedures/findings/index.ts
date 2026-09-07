import { ACROSS_FINDINGS } from "$development-views/editor-audit/procedures/findings/across";
import { CREATION_FINDINGS } from "$development-views/editor-audit/procedures/findings/creation";
import { DECK_FINDINGS } from "$development-views/editor-audit/procedures/findings/deck";
import { DOCUMENT_FINDINGS } from "$development-views/editor-audit/procedures/findings/document";
import { QUALITY_FINDINGS } from "$development-views/editor-audit/procedures/findings/quality";

export const FINDINGS = [
  ...CREATION_FINDINGS,
  ...DOCUMENT_FINDINGS,
  ...DECK_FINDINGS,
  ...ACROSS_FINDINGS,
  ...QUALITY_FINDINGS
] as const;
