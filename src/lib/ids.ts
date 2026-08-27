const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true when a route parameter can be safely compared to a UUID column. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
