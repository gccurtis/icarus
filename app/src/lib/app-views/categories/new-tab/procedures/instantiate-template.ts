import {
  instantiateTemplate as instantiateTemplateRemote,
  readTemplateLibrary
} from "$capabilities/templates/index.remote";
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type { LibraryTemplate } from "$app-views/categories/templates/procedures/library-types";

/** Materialize one context-panel template without sharing a result across New Tabs. */
export const instantiateLauncherTemplate = (row: LibraryTemplate) =>
  instantiateTemplateRemote({ templateId: row.id }).updates(
    readTemplateLibrary,
    readProjectResourceIndex
  );
