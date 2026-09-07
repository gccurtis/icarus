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
import { createTemplatedDerivedOutput as createTemplatedDerivedOutputProcedure } from "$capabilities/derived-output/api/create-templated-derived-output/create-templated-derived-output";
import { readDerivedOutputValue as readDerivedOutputValueProcedure } from "$capabilities/derived-output/api/read-derived-output-value/read-derived-output-value";

export const refreshDerivedOutput = command("unchecked", refreshDerivedOutputProcedure);
export const createTemplatedDerivedOutput = command(
  "unchecked",
  createTemplatedDerivedOutputProcedure
);
export const readDerivedOutputValue = query("unchecked", readDerivedOutputValueProcedure);
export type { RefreshDerivedOutputInput, RefreshDerivedOutputResult } from "$capabilities/derived-output/types/refresh-derived-output";
export type {
  CreateTemplatedDerivedOutputInput,
  CreateTemplatedDerivedOutputResult
} from "$capabilities/derived-output/types/create-templated-derived-output";
export type {
  ReadDerivedOutputValueInput,
  ReadDerivedOutputValueResult
} from "$capabilities/derived-output/types/read-derived-output-value";
