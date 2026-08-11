import type { IntelligenceCastRouteConfig, IntelligenceTier } from "./types.js";
import { INTELLIGENCE_TIERS } from "./types.js";

/** Generic value coercion shared by every section. */
export const parseNumber = (value: unknown, fallback: number, fieldName: string): number => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

export const parseString = (value: unknown, fallback: string, fieldName: string): string => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

export const parseBoolean = (
  value: unknown,
  fallback: boolean,
  fieldName: string
): boolean => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

export const parseTier = (
  value: unknown,
  fallback: IntelligenceTier,
  fieldName: string
): IntelligenceTier => {
  if (value === undefined) {
    return fallback;
  }

  if (value !== "low" && value !== "medium" && value !== "high") {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

export const parseOptionalTier = (
  value: unknown,
  fallback: IntelligenceTier | undefined,
  fieldName: string
): IntelligenceTier | undefined => {
  if (value === undefined) {
    return fallback;
  }

  if (value !== "low" && value !== "medium" && value !== "high") {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

export const parseCastRoutes = (
  value: unknown,
  fallback: IntelligenceCastRouteConfig[],
  fieldName: string
): IntelligenceCastRouteConfig[] => {
  if (value === undefined) {
    return fallback.map((route) => ({ ...route }));
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value.map((rawRoute, index) => {
    if (!rawRoute || typeof rawRoute !== "object" || Array.isArray(rawRoute)) {
      throw new Error(
        `Invalid '${fieldName}[${index}]' value in backend configuration`
      );
    }

    const route = rawRoute as Record<string, unknown>;
    const fallbackRoute = fallback[index] ?? fallback[0];

    if (!fallbackRoute) {
      throw new Error(`Invalid '${fieldName}' value in backend configuration`);
    }

    return {
      purpose: parseString(route.purpose, fallbackRoute.purpose, `${fieldName}[${index}].purpose`),
      strength: parseTier(
        route.strength,
        fallbackRoute.strength,
        `${fieldName}[${index}].strength`
      ),
      speed: parseTier(route.speed, fallbackRoute.speed, `${fieldName}[${index}].speed`),
      provider: parseString(
        route.provider,
        fallbackRoute.provider,
        `${fieldName}[${index}].provider`
      ),
      model: parseString(route.model, fallbackRoute.model, `${fieldName}[${index}].model`),
      effort: parseOptionalTier(
        route.effort,
        fallbackRoute.effort,
        `${fieldName}[${index}].effort`
      )
    };
  });
};
