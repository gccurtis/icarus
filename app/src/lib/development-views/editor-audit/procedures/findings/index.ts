import { ACROSS_FINDINGS } from "$development-views/editor-audit/procedures/findings/across";
import { CREATION_FINDINGS } from "$development-views/editor-audit/procedures/findings/creation";
import { PRESENTATION_FINDINGS } from "$development-views/editor-audit/procedures/findings/presentation";
import { DOCUMENT_FINDINGS } from "$development-views/editor-audit/procedures/findings/document";
import { QUALITY_FINDINGS } from "$development-views/editor-audit/procedures/findings/quality";

export const FINDINGS = [
  ...CREATION_FINDINGS,
  ...DOCUMENT_FINDINGS,
  ...PRESENTATION_FINDINGS,
  ...ACROSS_FINDINGS,
  ...QUALITY_FINDINGS
] as const;
