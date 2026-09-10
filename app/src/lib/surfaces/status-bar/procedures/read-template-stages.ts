import { readTemplateStageIndex } from "$capabilities/templates/index.remote";

/** Start the status bar's one component-owned template-stage identity query. */
export const statusTemplateStageNames = () => readTemplateStageIndex();
