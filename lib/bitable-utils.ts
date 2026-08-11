import type { BitableField, BitableRecord } from "@/lib/content-types";

export type SortDirection = "asc" | "desc" | null;

export interface BitableFilter {
  fieldId: string;
  operator: "contains" | "equals" | "gt" | "lt" | "checked" | "unchecked";
  value: string;
}

export interface BitableViewState {
  sortField?: string;
  sortDirection?: SortDirection;
  filters: BitableFilter[];
  search: string;
}

export const SELECT_COLORS: Record<string, string> = {
  进行中: "bg-blue-100 text-blue-700",
  已完成: "bg-emerald-100 text-emerald-700",
  待定: "bg-gray-100 text-gray-600",
  高: "bg-red-100 text-red-700",
  中: "bg-amber-100 text-amber-700",
  低: "bg-green-100 text-green-700",
  选项1: "bg-violet-100 text-violet-700",
  选项2: "bg-cyan-100 text-cyan-700",
  选项3: "bg-pink-100 text-pink-700",
};

export function getSelectColor(value: string): string {
  return SELECT_COLORS[value] ?? "bg-gray-100 text-gray-700";
}

function compareValues(
  a: string | number | boolean | undefined,
  b: string | number | boolean | undefined,
  fieldType: string
): number {
  if (a === b) return 0;
  if (a === undefined || a === "") return 1;
  if (b === undefined || b === "") return -1;

  if (fieldType === "number") {
    return Number(a) - Number(b);
  }
  if (fieldType === "date") {
    return String(a).localeCompare(String(b));
  }
  if (fieldType === "checkbox") {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }
  return String(a).localeCompare(String(b), "zh-CN");
}

export function applyFiltersAndSort(
  records: BitableRecord[],
  fields: BitableField[],
  viewState: BitableViewState
): BitableRecord[] {
  let result = [...records];

  if (viewState.search.trim()) {
    const q = viewState.search.trim().toLowerCase();
    result = result.filter((r) =>
      fields.some((f) =>
        String(r.cells[f.id] ?? "").toLowerCase().includes(q)
      )
    );
  }

  for (const filter of viewState.filters) {
    const field = fields.find((f) => f.id === filter.fieldId);
    if (!field) continue;

    result = result.filter((r) => {
      const val = r.cells[field.id];
      switch (filter.operator) {
        case "contains":
          return String(val ?? "").toLowerCase().includes(filter.value.toLowerCase());
        case "equals":
          return String(val ?? "") === filter.value;
        case "gt":
          return Number(val) > Number(filter.value);
        case "lt":
          return Number(val) < Number(filter.value);
        case "checked":
          return Boolean(val);
        case "unchecked":
          return !Boolean(val);
        default:
          return true;
      }
    });
  }

  if (viewState.sortField && viewState.sortDirection) {
    const field = fields.find((f) => f.id === viewState.sortField);
    if (field) {
      const dir = viewState.sortDirection === "asc" ? 1 : -1;
      result.sort(
        (a, b) =>
          dir * compareValues(a.cells[field.id], b.cells[field.id], field.type)
      );
    }
  }

  return result;
}

export function exportRecordsToCsv(
  records: BitableRecord[],
  fields: BitableField[]
): string {
  const header = fields.map((f) => f.name).join(",");
  const rows = records.map((r) =>
    fields
      .map((f) => {
        const v = r.cells[f.id];
        const s = String(v ?? "");
        return s.includes(",") ? `"${s}"` : s;
      })
      .join(",")
  );
  return [header, ...rows].join("\n");
}
