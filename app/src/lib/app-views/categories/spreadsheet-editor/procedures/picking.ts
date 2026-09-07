export type Picker = { readonly insert: (address: string, anchor: string) => void };

let held: Picker | undefined;

export const arm = (picker: Picker): void => {
  held = picker;
};

export const disarm = (picker: Picker): void => {
  if (held === picker) held = undefined;
};

export const armed = (): boolean => held !== undefined;

export const pick = (address: string, anchor: string): boolean => {
  if (held === undefined) return false;
  held.insert(address, anchor);
  return true;
};
