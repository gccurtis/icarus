import { readTemplateStageIndex } from "$capabilities/templates/index.remote";

/** Start the tab bar's one component-owned template-stage identity query. */
export const tabTemplateStageNames = () => readTemplateStageIndex();
