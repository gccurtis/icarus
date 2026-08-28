import { command, query } from "$app/server";

import { create as createRow } from "$capabilities/store/api/create/create";
import { read as readAt } from "$capabilities/store/api/read/read";
import { remove as removeAt } from "$capabilities/store/api/remove/remove";
import { update as updateAt } from "$capabilities/store/api/update/update";

export const read = query("unchecked", readAt);
export const create = command("unchecked", createRow);
export const update = command("unchecked", updateAt);
export const remove = command("unchecked", removeAt);

export type { CreateInput, CreateResult } from "$capabilities/store/types/create";
export type { ReadInput, ReadResult } from "$capabilities/store/types/read";
export type { RemoveInput, RemoveResult } from "$capabilities/store/types/remove";
export type { UpdateInput, UpdateResult } from "$capabilities/store/types/update";
