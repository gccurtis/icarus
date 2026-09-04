export type Read<T> = {
  readonly current: T;
  readonly error: undefined;
  readonly loading: false;
  refresh: () => Promise<void>;
};

export const read = <T>(current: T, id?: string): Read<T> => {
  void id;
  return { current, error: undefined, loading: false, refresh: async () => {} };
};
