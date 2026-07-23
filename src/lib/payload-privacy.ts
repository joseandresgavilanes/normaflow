/** Enforces least-privilege payloads for member identity/role data. */
export function memberPayload<T>(canReadMembers: boolean, members: T[]): T[] {
  return canReadMembers ? members : [];
}
