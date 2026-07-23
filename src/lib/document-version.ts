export type VersionBump = "minor" | "major";

function parseVersion(version: string): number[] | null {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return parts.length > 0 && parts.every((part) => Number.isInteger(part) && part >= 0) ? parts : null;
}

export function bumpDocumentVersion(current: string, mode: VersionBump): string {
  const parts = parseVersion(current);
  if (!parts) return mode === "major" ? "2.0" : "1.1";
  if (mode === "major") return `${(parts[0] ?? 1) + 1}.0`;
  if (parts.length === 1) return `${parts[0]}.1`;
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
  return parts.join(".");
}

/**
 * Uses the greatest version already stored, not only Document.currentVersion.
 * This prevents two uploads made while a document is still in draft from
 * receiving the same version number.
 */
export function nextDocumentVersion(
  currentVersion: string,
  versions: readonly { version: string }[],
  mode: VersionBump,
): string {
  if (versions.length === 0) return currentVersion;

  const candidates = [currentVersion, ...versions.map((version) => version.version)]
    .map((version) => ({ version, parts: parseVersion(version) }))
    .filter((candidate): candidate is { version: string; parts: number[] } => candidate.parts !== null);

  if (candidates.length === 0) return bumpDocumentVersion(currentVersion, mode);

  const latest = candidates.reduce((winner, candidate) => {
    const length = Math.max(winner.parts.length, candidate.parts.length);
    for (let index = 0; index < length; index += 1) {
      const winnerPart = winner.parts[index] ?? 0;
      const candidatePart = candidate.parts[index] ?? 0;
      if (candidatePart !== winnerPart) return candidatePart > winnerPart ? candidate : winner;
    }
    return candidate;
  });

  return bumpDocumentVersion(latest.version, mode);
}
