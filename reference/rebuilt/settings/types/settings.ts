/**
 * A value a setting may hold: anything JSON can represent.
 *
 * Deliberately not `unknown`. The column is `jsonb`, so a value that cannot
 * survive a round trip through JSON cannot be stored, and saying so in the type
 * moves that failure from a runtime surprise to a compile error for every
 * server-side caller. A browser caller is not bound by the type and is checked
 * at admission instead.
 */
export type SettingValue =
  | string
  | number
  | boolean
  | null
  | readonly SettingValue[]
  | { readonly [field: string]: SettingValue };

/** One stored setting, as a consumer receives it. */
export interface Setting {
  readonly key: string;
  readonly value: SettingValue;
  /** The user who last wrote it. Taken from the scope, never from an input. */
  readonly updatedBy: string;
  readonly updatedAt: Date;
}

/**
 * What a caller supplies to write one.
 *
 * **No project, and no user.** Both come from the scope the procedure was called
 * with, which is why neither has a field here to be spoofed. See
 * [`requests.ts`](requests.ts) for the browser-facing shapes, which differ by
 * exactly one field.
 */
export interface SettingInput {
  readonly key: string;
  readonly value: SettingValue;
}
