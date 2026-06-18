export type DocumentSortKey =
  | "activity_desc"
  | "activity_asc"
  | "code_asc"
  | "code_desc"
  | "title_asc"
  | "title_desc";

export const DOCUMENT_SORT_OPTIONS: { value: DocumentSortKey; label: string }[] = [
  { value: "activity_desc", label: "Más reciente" },
  { value: "activity_asc", label: "Más antiguo" },
  { value: "code_asc", label: "Código A–Z" },
  { value: "code_desc", label: "Código Z–A" },
  { value: "title_asc", label: "Título A–Z" },
  { value: "title_desc", label: "Título Z–A" },
];

export function sortDocuments<T extends { code: string; title: string }>(
  rows: T[],
  sort: DocumentSortKey,
  getActivityAt: (row: T) => number,
): T[] {
  const out = [...rows];
  out.sort((a, b) => {
    switch (sort) {
      case "activity_desc":
        return getActivityAt(b) - getActivityAt(a);
      case "activity_asc":
        return getActivityAt(a) - getActivityAt(b);
      case "code_asc":
        return a.code.localeCompare(b.code, "es", { sensitivity: "base" });
      case "code_desc":
        return b.code.localeCompare(a.code, "es", { sensitivity: "base" });
      case "title_asc":
        return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
      case "title_desc":
        return b.title.localeCompare(a.title, "es", { sensitivity: "base" });
      default:
        return 0;
    }
  });
  return out;
}
