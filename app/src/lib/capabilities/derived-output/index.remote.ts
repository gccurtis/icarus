import { command, query } from "$app/server";

import { createDerivedOutput as createDerivedOutputProcedure } from "$capabilities/derived-output/api/create-derived-output/create-derived-output";

export const createDerivedOutput = command("unchecked", createDerivedOutputProcedure);
export type { CreateDerivedOutputInput, CreateDerivedOutputResult } from "$capabilities/derived-output/types/create-derived-output";

import { readDerivedOutput as readDerivedOutputProcedure } from "$capabilities/derived-output/api/read-derived-output/read-derived-output";

export const readDerivedOutput = query("unchecked", readDerivedOutputProcedure);
export type { ReadDerivedOutputInput, ReadDerivedOutputResult } from "$capabilities/derived-output/types/read-derived-output";

import { updateDerivedOutput as updateDerivedOutputProcedure } from "$capabilities/derived-output/api/update-derived-output/update-derived-output";

export const updateDerivedOutput = command("unchecked", updateDerivedOutputProcedure);
export type { UpdateDerivedOutputInput, UpdateDerivedOutputResult } from "$capabilities/derived-output/types/update-derived-output";

import { refreshDerivedOutput as refreshDerivedOutputProcedure } from "$capabilities/derived-output/api/refresh-derived-output/refresh-derived-output";

export const refreshDerivedOutput = command("unchecked", refreshDerivedOutputProcedure);
export type { RefreshDerivedOutputInput, RefreshDerivedOutputResult } from "$capabilities/derived-output/types/refresh-derived-output";
