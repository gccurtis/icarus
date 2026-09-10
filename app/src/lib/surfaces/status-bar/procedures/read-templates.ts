import { readTemplateLibrary } from "$capabilities/templates/index.remote";

/** Start the scoped template-library query whose snapshot names a template tab. */
export const statusTemplateNames = () => readTemplateLibrary();
