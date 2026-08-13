import {
  InMemoryDataManager,
  type DataManager
} from "#data-manager/runtime-objects/manager/definition.js";

export const createDataManager = (): DataManager => new InMemoryDataManager();
