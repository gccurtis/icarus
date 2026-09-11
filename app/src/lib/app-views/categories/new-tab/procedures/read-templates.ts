import { templateLibrary, templatesIn } from "$app-views/categories/templates/procedures/library-read.svelte";

/** Read the visible, current template library for this project's launcher. */
export const launcherTemplates = () => templateLibrary();
export const availableTemplates = templatesIn;
