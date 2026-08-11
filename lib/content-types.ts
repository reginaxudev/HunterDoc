export type ContentType = "doc" | "sheet" | "mindmap" | "bitable";

export const CONTENT_TYPE_META: Record<
  ContentType,
  { label: string; icon: string; description: string; color: string }
> = {
  doc: {
    label: "文档",
    icon: "📄",
    description: "富文本文档，支持协作编辑",
    color: "bg-blue-50 text-blue-700",
  },
  sheet: {
    label: "表格",
    icon: "📊",
    description: "电子表格，类似 Excel",
    color: "bg-emerald-50 text-emerald-700",
  },
  mindmap: {
    label: "思维导图",
    icon: "🧠",
    description: "脑图梳理思路与结构",
    color: "bg-violet-50 text-violet-700",
  },
  bitable: {
    label: "多维表格",
    icon: "🗃️",
    description: "数据库视图，管理结构化数据",
    color: "bg-orange-50 text-orange-700",
  },
};

export function getContentPath(id: string, contentType: ContentType): string {
  return `/${contentType}/${id}`;
}

export function getDefaultTitle(contentType: ContentType): string {
  const titles: Record<ContentType, string> = {
    doc: "无标题文档",
    sheet: "无标题表格",
    mindmap: "无标题思维导图",
    bitable: "无标题多维表格",
  };
  return titles[contentType];
}

export function getDefaultContent(contentType: ContentType): Record<string, unknown> {
  switch (contentType) {
    case "doc":
      return { type: "doc", content: [{ type: "paragraph" }] };
    case "sheet":
      return {
        version: 2,
        workbook: {
          id: `wb_${Date.now()}`,
          name: "工作簿",
          appVersion: "0.25.1",
          locale: "zhCN",
          styles: {},
          sheetOrder: ["sheet1"],
          sheets: {
            sheet1: {
              id: "sheet1",
              name: "Sheet1",
              tabColor: "",
              hidden: 0,
              freeze: { xSplit: 0, ySplit: 0, startRow: -1, startColumn: -1 },
              rowCount: 100,
              columnCount: 26,
              zoomRatio: 1,
              scrollTop: 0,
              scrollLeft: 0,
              defaultColumnWidth: 88,
              defaultRowHeight: 24,
              mergeData: [],
              cellData: {},
              rowData: {},
              columnData: {},
              showGridlines: 1,
              rowHeader: { width: 46, hidden: 0 },
              columnHeader: { height: 20, hidden: 0 },
              rightToLeft: 0,
            },
          },
        },
      };
    case "mindmap":
      return {
        version: 1,
        root: {
          id: "root",
          text: "中心主题",
          children: [
            { id: "n1", text: "分支 1", children: [] },
            { id: "n2", text: "分支 2", children: [] },
          ],
        },
      };
    case "bitable":
      return {
        version: 1,
        fields: [
          { id: "f1", name: "名称", type: "text" },
          { id: "f2", name: "状态", type: "select", options: ["进行中", "已完成", "待定"] },
          { id: "f3", name: "优先级", type: "select", options: ["高", "中", "低"] },
          { id: "f4", name: "备注", type: "text" },
        ],
        records: [
          { id: "r1", cells: { f1: "示例记录", f2: "进行中", f3: "高", f4: "" } },
        ],
        view: "table",
      };
  }
}

// --- Sheet types (legacy v1, kept for migration) ---
export interface SheetTab {
  id: string;
  name: string;
  rows: string[][];
  conditionalFormats?: import("@/lib/sheet-conditional-format").ConditionalFormatRule[];
  cellStyles?: Record<string, import("@/lib/sheet-cell-style").CellStyle>;
  mergedRegions?: import("@/lib/sheet-cell-style").MergedRegion[];
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  dropdowns?: Record<string, string[]>;
  cellMeta?: Record<string, import("@/lib/sheet-cell-meta").CellMeta>;
  viewState?: import("@/lib/sheet-cell-style").SheetViewState;
}

export interface SheetData {
  version: number;
  sheets: SheetTab[];
  activeSheet: string;
}

/** Univer-based sheet content (v2) — see lib/sheet-univer.ts */
export type { UniverSheetData } from "@/lib/sheet-univer";

// --- Mindmap types ---
export interface MindmapNode {
  id: string;
  text: string;
  note?: string;
  collapsed?: boolean;
  children: MindmapNode[];
}

export interface MindmapData {
  version: number;
  root: MindmapNode;
  mentions?: import("@/lib/content-mentions").StoredMention[];
}

// --- Bitable types ---
export type BitableFieldType = "text" | "number" | "select" | "date" | "checkbox";

export interface BitableField {
  id: string;
  name: string;
  type: BitableFieldType;
  options?: string[];
}

export interface BitableRecord {
  id: string;
  cells: Record<string, string | number | boolean>;
}

export interface BitableData {
  version: number;
  fields: BitableField[];
  records: BitableRecord[];
  view: "table" | "kanban";
  kanbanField?: string;
  mentions?: import("@/lib/content-mentions").StoredMention[];
  viewState?: {
    sortField?: string;
    sortDirection?: "asc" | "desc" | null;
    filters: {
      fieldId: string;
      operator: "contains" | "equals" | "gt" | "lt" | "checked" | "unchecked";
      value: string;
    }[];
    search: string;
  };
}

export function generateId(prefix = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
