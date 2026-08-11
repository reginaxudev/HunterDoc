import type { ICellData, IWorkbookData } from "@univerjs/core";
import {
  compactSheetPayloadForSave,
  isUniverSheetData,
  normalizeCellForSave,
  type SheetContent,
  type UniverSheetData,
} from "@/lib/sheet-univer";
import type { StoredMention } from "@/lib/content-mentions";
import type { SaveDocumentPayload } from "@/lib/save-payload-client";

/** 单次 PATCH 允许的 patch 体积上限（gzip 前） */
export const SHEET_PATCH_CHUNK_MAX_BYTES = 1_200_000;

/** 超过此大小的整表保存禁止走全量，必须增量 patch */
const FULL_SHEET_SAVE_MAX_BYTES = 800_000;

export interface SheetCellPatch {
  kind: "sheet-cell-patch";
  version: 1;
  mentions?: StoredMention[];
  cells: Array<{
    sheetId: string;
    r: number;
    c: number;
    /** null = 清除该单元格 */
    cell: ICellData | null;
  }>;
}

export function isSheetCellPatch(value: unknown): value is SheetCellPatch {
  return (
    !!value &&
    typeof value === "object" &&
    (value as SheetCellPatch).kind === "sheet-cell-patch"
  );
}

function cellKey(sheetId: string, r: number, c: number) {
  return `${sheetId}:${r}:${c}`;
}

function collectCells(workbook: IWorkbookData): Map<string, ICellData> {
  const map = new Map<string, ICellData>();
  for (const sheetId of workbook.sheetOrder ?? []) {
    const sheet = workbook.sheets?.[sheetId];
    if (!sheet?.cellData) continue;
    for (const [rk, row] of Object.entries(sheet.cellData)) {
      const r = Number(rk);
      for (const [ck, cell] of Object.entries(row ?? {})) {
        const c = Number(ck);
        const normalized = normalizeCellForSave(cell as ICellData);
        if (normalized) map.set(cellKey(sheetId, r, c), normalized);
      }
    }
  }
  return map;
}

function cellEquals(a: ICellData | undefined, b: ICellData | undefined): boolean {
  return (
    JSON.stringify(normalizeCellForSave(a ?? null)) ===
    JSON.stringify(normalizeCellForSave(b ?? null))
  );
}

export function chunkSheetCellPatch(patch: SheetCellPatch): SheetCellPatch[] {
  if (patch.cells.length === 0) return [patch];

  const chunks: SheetCellPatch[] = [];
  let currentCells: SheetCellPatch["cells"] = [];
  let currentBytes = 0;
  const base = { kind: "sheet-cell-patch" as const, version: 1 as const };

  for (const cell of patch.cells) {
    const cellBytes = new TextEncoder().encode(JSON.stringify(cell)).length;
    if (
      currentCells.length > 0 &&
      currentBytes + cellBytes > SHEET_PATCH_CHUNK_MAX_BYTES
    ) {
      chunks.push({ ...base, cells: currentCells });
      currentCells = [];
      currentBytes = 0;
    }
    currentCells.push(cell);
    currentBytes += cellBytes;
  }

  if (currentCells.length > 0) {
    chunks.push({ ...base, cells: currentCells });
  }

  if (patch.mentions?.length && chunks.length > 0) {
    chunks[chunks.length - 1] = {
      ...chunks[chunks.length - 1],
      mentions: patch.mentions,
    };
  }

  return chunks.length > 0 ? chunks : [patch];
}

function patchPayloadsFromChunks(
  patch: SheetCellPatch,
  options: { title: string; skipRevision?: boolean }
): SaveDocumentPayload[] {
  const chunks = chunkSheetCellPatch(patch);
  if (chunks.length === 1) {
    return [
      {
        title: options.title,
        skipRevision: options.skipRevision,
        sheetPatch: chunks[0],
      },
    ];
  }

  return chunks.map((chunk, index) => ({
    title: index === 0 ? options.title : undefined,
    skipRevision: index < chunks.length - 1 ? true : options.skipRevision,
    sheetPatch: chunk,
  }));
}

export function computeSheetCellPatch(
  previous: UniverSheetData | SheetContent,
  next: UniverSheetData | SheetContent
): SheetCellPatch | null {
  const prevCompact = compactSheetPayloadForSave(previous);
  const nextCompact = compactSheetPayloadForSave(next);
  if (!isUniverSheetData(prevCompact) || !isUniverSheetData(nextCompact)) {
    return null;
  }

  const prevCells = collectCells(prevCompact.workbook);
  const nextCells = collectCells(nextCompact.workbook);
  const keys = new Set([...prevCells.keys(), ...nextCells.keys()]);
  const cells: SheetCellPatch["cells"] = [];

  for (const key of keys) {
    const [sheetId, rs, cs] = key.split(":");
    const r = Number(rs);
    const c = Number(cs);
    const prevCell = prevCells.get(key);
    const nextCell = nextCells.get(key);
    if (cellEquals(prevCell, nextCell)) continue;
    cells.push({
      sheetId: sheetId!,
      r,
      c,
      cell: nextCell ?? null,
    });
  }

  const patch: SheetCellPatch = {
    kind: "sheet-cell-patch",
    version: 1,
    cells,
  };

  const prevMentions = isUniverSheetData(prevCompact) ? prevCompact.mentions ?? [] : [];
  const nextMentions = isUniverSheetData(nextCompact) ? nextCompact.mentions ?? [] : [];
  if (JSON.stringify(prevMentions) !== JSON.stringify(nextMentions)) {
    patch.mentions = nextMentions;
  }

  return patch;
}

export function applySheetCellPatch(
  existing: Record<string, unknown>,
  patch: SheetCellPatch
): UniverSheetData {
  const base = compactSheetPayloadForSave(existing as SheetContent);
  if (!isUniverSheetData(base)) {
    throw new Error("Cannot apply sheet patch to non-sheet content");
  }

  const workbook = structuredClone(base.workbook);
  for (const entry of patch.cells) {
    const sheet = workbook.sheets?.[entry.sheetId];
    if (!sheet) continue;
    if (!sheet.cellData) sheet.cellData = {};

    if (!entry.cell) {
      const row = sheet.cellData[entry.r];
      if (row) {
        delete row[entry.c];
        if (Object.keys(row).length === 0) delete sheet.cellData[entry.r];
      }
      continue;
    }

    const normalized = normalizeCellForSave(entry.cell);
    if (!normalized) {
      const row = sheet.cellData[entry.r];
      if (row) {
        delete row[entry.c];
        if (Object.keys(row).length === 0) delete sheet.cellData[entry.r];
      }
      continue;
    }

    if (!sheet.cellData[entry.r]) sheet.cellData[entry.r] = {};
    sheet.cellData[entry.r]![entry.c] = normalized;
  }

  const merged: UniverSheetData = {
    version: base.version,
    workbook,
  };
  if (patch.mentions) merged.mentions = patch.mentions;
  else if (base.mentions?.length) merged.mentions = base.mentions;
  return merged;
}

export type SheetSaveBuildResult = SaveDocumentPayload | SaveDocumentPayload[] | null;

/** 构建保存体：优先增量 patch（可分块）；无变更返回 null */
export function buildSheetSavePayload(
  previous: UniverSheetData | SheetContent | null,
  next: UniverSheetData | SheetContent,
  options: { title: string; skipRevision?: boolean }
): SheetSaveBuildResult {
  const compactNext = compactSheetPayloadForSave(next) as UniverSheetData;
  const fullBytes = new TextEncoder().encode(
    JSON.stringify({ content: compactNext })
  ).length;

  if (previous) {
    const patch = computeSheetCellPatch(previous, next);
    if (patch) {
      if (patch.cells.length === 0 && !patch.mentions) {
        return null;
      }
      return patchPayloadsFromChunks(patch, options);
    }
  }

  if (fullBytes > FULL_SHEET_SAVE_MAX_BYTES) {
    throw new Error(
      "SHEET_TOO_LARGE_FOR_FULL_SAVE: 表格过大，请刷新页面后重试；若仍失败请联系管理员。"
    );
  }

  return {
    title: options.title,
    skipRevision: options.skipRevision,
    content: compactNext as unknown as Record<string, unknown>,
  };
}
