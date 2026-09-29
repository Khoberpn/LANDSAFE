export function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

export function parseBoundedLimit(value: unknown, fallback: number, maximum: number): number | null {
  if (value === undefined) return fallback;
  const result = parsePositiveInt(value);
  return result !== null && result <= maximum ? result : null;
}

export function parseIsoTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp : null;
}

export function parseMeasurementQuery(query: Record<string, unknown>): {
  sensorId?: number; locationId?: number; from?: Date; to?: Date; limit: number;
} | null {
  const sensorId = query.sensorId === undefined ? undefined : parsePositiveInt(query.sensorId);
  const locationId = query.locationId === undefined ? undefined : parsePositiveInt(query.locationId);
  const from = query.from === undefined ? undefined : parseIsoTimestamp(query.from);
  const to = query.to === undefined ? undefined : parseIsoTimestamp(query.to);
  const limit = parseBoundedLimit(query.limit, 100, 1000);
  if (sensorId === null || locationId === null || from === null || to === null || limit === null ||
      (from && to && from > to)) return null;
  return { sensorId, locationId, from, to, limit };
}