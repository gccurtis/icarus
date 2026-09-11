export const confirmPromptScope = async ({
  close,
  confirm,
  refresh,
  value
}: {
  close: () => void;
  confirm: (value: unknown) => void | Promise<void>;
  refresh?: () => Promise<unknown>;
  value: unknown;
}): Promise<void> => {
  close();
  await confirm(value);
  await refresh?.();
};
