import type { SurfaceSelection } from "$authored-components/sheet-surface";
import type { SheetHeld } from "$app-views/categories/spreadsheet-editor/content/sheet.state.svelte";
import type { Grid } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import type { PickingChannel } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
import type { SheetFacts } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import type { VariableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type {
  SpreadsheetRuntime,
  WorkspaceStateModel
} from "$model/client/workspace-state";

export type SheetActionContext = {
  readonly view: WorkspaceStateModel;
  readonly channel: PickingChannel;
  readonly register: VariableRegister;
  readonly held: SheetHeld;
  readonly sheetId: string | undefined;
  readonly runtime: SpreadsheetRuntime | undefined;
  readonly sheet: LiveSheet | undefined;
  readonly grid: Grid;
  readonly facts: SheetFacts;
  readonly selection: SurfaceSelection | undefined;
  readonly zoom: number;
};
