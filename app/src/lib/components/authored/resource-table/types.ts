/** Display metadata only; resource identity and commands stay with the caller. */
export type ResourceTableRow = {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly updated: string;
  readonly updatedAt: number;
  readonly updatedBy: string;
};
