import { updateProjectResourceSummary } from "$capabilities/project/index.remote";

/** Own the complete save lifecycle for the editable resource summary. */
export const resourceSummaryCommand = () => {
  let saving = $state(false);
  let error = $state<string | undefined>(undefined);

  const save = async (resourceId: string | undefined, summary: string): Promise<void> => {
    if (resourceId === undefined) return;
    saving = true;
    error = undefined;
    try {
      await updateProjectResourceSummary({ resourceId, summary });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "The summary did not save.";
    } finally {
      saving = false;
    }
  };

  return {
    get saving(): boolean {
      return saving;
    },
    get error(): string | undefined {
      return error;
    },
    save
  };
};
