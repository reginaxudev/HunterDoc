import type { IWorkbookData } from "@univerjs/core";

export type HistoryChangeType = "edit" | "title" | "restore";

export interface DocumentRevisionRecord {
  id: string;
  documentId: string;
  title: string;
  changeType: HistoryChangeType;
  changeSummary: string;
  changeCount: number;
  userId: string;
  userName: string;
  createdAt: string;
}

function isSheetWorkbook(content: Record<string, unknown>): content is {
  workbook?: IWorkbookData;
  version?: number;
} {
  return !!content.workbook && typeof content.workbook === "object";
}

function countSheetCellChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
): number {
  const prevWb = isSheetWorkbook(prev) ? prev.workbook : null;
  const nextWb = isSheetWorkbook(next) ? next.workbook : null;
  if (!prevWb || !nextWb) return 1;

  let changes = 0;
  const prevCells = new Map<string, string>();
  const nextCells = new Map<string, string>();

  for (const sheetId of prevWb.sheetOrder ?? []) {
    const sheet = prevWb.sheets?.[sheetId];
    if (!sheet?.cellData) continue;
    for (const [rk, row] of Object.entries(sheet.cellData)) {
      for (const [ck, cell] of Object.entries(row ?? {})) {
        const v = (cell as { v?: unknown })?.v;
        if (v != null && v !== "") {
          prevCells.set(`${sheetId}:${rk}:${ck}`, String(v));
        }
      }
    }
  }

  for (const sheetId of nextWb.sheetOrder ?? []) {
    const sheet = nextWb.sheets?.[sheetId];
    if (!sheet?.cellData) continue;
    for (const [rk, row] of Object.entries(sheet.cellData)) {
      for (const [ck, cell] of Object.entries(row ?? {})) {
        const v = (cell as { v?: unknown })?.v;
        const key = `${sheetId}:${rk}:${ck}`;
        const nextVal = v != null && v !== "" ? String(v) : "";
        const prevVal = prevCells.get(key) ?? "";
        if (nextVal !== prevVal) changes++;
        nextCells.set(key, nextVal);
      }
    }
  }

  for (const [key, prevVal] of prevCells) {
    if (!nextCells.has(key) && prevVal) changes++;
  }

  return Math.max(changes, 1);
}

function countJsonChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
): number {
  if (JSON.stringify(prev) === JSON.stringify(next)) return 0;
  return 1;
}

export function buildRevisionMeta(
  prevContent: Record<string, unknown> | null,
  nextContent: Record<string, unknown>,
  prevTitle: string,
  nextTitle: string,
  changeType: HistoryChangeType = "edit"
): { changeSummary: string; changeCount: number; changeType: HistoryChangeType } {
  if (changeType === "restore") {
    return { changeSummary: "恢复到历史版本", changeCount: 1, changeType: "restore" };
  }

  const titleChanged = prevTitle !== nextTitle;
  if (titleChanged && (!prevContent || JSON.stringify(prevContent) === JSON.stringify(nextContent))) {
    return { changeSummary: "编辑了标题", changeCount: 1, changeType: "title" };
  }

  const changeCount = prevContent
    ? isSheetWorkbook(nextContent)
      ? countSheetCellChanges(prevContent, nextContent)
      : countJsonChanges(prevContent, nextContent)
    : 1;

  if (changeCount === 0 && titleChanged) {
    return { changeSummary: "编辑了标题", changeCount: 1, changeType: "title" };
  }

  if (changeCount === 0) {
    return { changeSummary: "编辑了文档", changeCount: 1, changeType: "edit" };
  }

  if (titleChanged) {
    return {
      changeSummary: `编辑了标题和文档，共 ${changeCount} 处修改`,
      changeCount,
      changeType: "edit",
    };
  }

  return {
    changeSummary: changeCount > 1 ? `共 ${changeCount} 处修改` : "编辑了文档",
    changeCount,
    changeType: "edit",
  };
}

export function formatHistoryDateKey(iso: string): string {
  const d = new Date(iso);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month.toString().padStart(2, "0")}月${day.toString().padStart(2, "0")}日（${weekdays[d.getDay()]}）`;
}

export function formatHistoryTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
