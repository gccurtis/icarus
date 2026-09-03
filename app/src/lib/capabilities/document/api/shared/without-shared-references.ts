export const withoutSharedReferences = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
