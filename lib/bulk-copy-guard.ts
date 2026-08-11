/** 成员批量复制阈值：超过此数量仅管理员可操作 */
export const BULK_COPY_THRESHOLD = 5;

/** Univer 表格复制/剪切命令 */
export const SHEET_CLIPBOARD_COMMAND_IDS = new Set([
  "sheet.command.copy",
  "sheet.command.cut",
  "univer.command.copy",
  "univer.command.cut",
]);

export function isSheetClipboardCommand(commandId: string): boolean {
  return SHEET_CLIPBOARD_COMMAND_IDS.has(commandId);
}

export function shouldBlockBulkCopy(
  isAdmin: boolean,
  itemCount: number
): boolean {
  if (isAdmin) return false;
  return itemCount > BULK_COPY_THRESHOLD;
}

/** 统计文本复制条目数（按非空行计，文档用） */
export function countTextCopyItems(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return Math.max(lines.length, 1);
}

/** 统计表格型剪贴板内容（TSV：按行×列计单元格） */
export function countTabularCopyItems(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  let total = 0;
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.trim()) continue;
    total += line.split("\t").length;
  }
  return Math.max(total, 1);
}

/** 根据来源选择计数方式 */
export function countClipboardItems(
  text: string,
  source: "sheet" | "doc" | "other"
): number {
  if (!text.trim()) return 0;
  if (source === "sheet") return countTabularCopyItems(text);
  return countTextCopyItems(text);
}

/** 表格选区单元格数量 */
export function countSheetSelectionCells(
  width: number,
  height: number
): number {
  return Math.max(width, 1) * Math.max(height, 1);
}

/** 统计当前表格选区内的单元格总数（含多选区） */
export function countActiveSheetCells(workbook: {
  getActiveSheet: () => {
    getSelection: () => {
      getActiveRangeList: () => Array<{ getWidth: () => number; getHeight: () => number }>;
      getActiveRange: () => { getWidth: () => number; getHeight: () => number } | null;
    } | null;
  } | null;
  getActiveRange: () => { getWidth: () => number; getHeight: () => number } | null;
} | null): number {
  if (!workbook) return 0;

  const sheet = workbook.getActiveSheet();
  const selection = sheet?.getSelection();
  const ranges = selection?.getActiveRangeList() ?? [];
  if (ranges.length > 0) {
    return ranges.reduce(
      (sum, range) =>
        sum + countSheetSelectionCells(range.getWidth(), range.getHeight()),
      0
    );
  }

  const activeRange = selection?.getActiveRange() ?? workbook.getActiveRange();
  if (!activeRange) return 0;
  return countSheetSelectionCells(activeRange.getWidth(), activeRange.getHeight());
}

export interface BulkCopyAlertPayload {
  documentId: string;
  documentTitle: string;
  documentHref: string;
  itemCount: number;
  source: "sheet" | "doc" | "other";
}

export interface BulkCopyGuardMeta {
  documentId: string;
  documentTitle: string;
  documentHref: string;
  source: "sheet" | "doc" | "other";
}

export function blockBulkCopyInteraction(
  isAdmin: boolean,
  itemCount: number,
  meta: BulkCopyGuardMeta
): boolean {
  if (!shouldBlockBulkCopy(isAdmin, itemCount)) return false;

  void notifyBulkCopyBlocked({
    documentId: meta.documentId,
    documentTitle: meta.documentTitle,
    documentHref: meta.documentHref,
    itemCount,
    source: meta.source,
  });
  showBulkCopyBlockedToast(itemCount);
  return true;
}

export function clearClipboardEvent(e: ClipboardEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  try {
    e.clipboardData?.clearData();
    e.clipboardData?.setData("text/plain", "");
  } catch {
    // ignore
  }
}

export async function notifyBulkCopyBlocked(
  payload: BulkCopyAlertPayload
): Promise<{ loginLocked?: boolean; lockoutMinutes?: number }> {
  try {
    const res = await fetch("/api/security/bulk-copy-violation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    window.dispatchEvent(new CustomEvent("admin-alert-update"));

    if (!res.ok) return {};

    const data = (await res.json()) as {
      loginLocked?: boolean;
      lockoutMinutes?: number;
    };

    if (data.loginLocked) {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      const minutes = data.lockoutMinutes ?? 30;
      window.dispatchEvent(
        new CustomEvent("bulk-copy-login-locked", {
          detail: { lockoutMinutes: minutes },
        })
      );
      window.location.href = `/login?error=${encodeURIComponent(
        `批量复制违规已达上限，账号已锁定 ${minutes} 分钟`
      )}`;
    }

    return data;
  } catch {
    return {};
  }
}

export function showBulkCopyBlockedToast(itemCount: number, violationHint?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("bulk-copy-blocked", {
      detail: { itemCount, violationHint },
    })
  );
}

/** 当前活跃文档/表格的复制守卫上下文（由编辑器挂载时设置） */
export interface BulkCopyGuardRuntime {
  source: "sheet" | "doc";
  isAdmin: boolean;
  documentId: string;
  documentTitle: string;
  documentHref: string;
  /** 优先用选区实时计数（表格尤其重要） */
  getLiveItemCount?: () => number;
}

let activeRuntime: BulkCopyGuardRuntime | null = null;
let clipboardGuardInstalled = false;

export function setBulkCopyGuardRuntime(runtime: BulkCopyGuardRuntime | null) {
  activeRuntime = runtime;
}

export function getBulkCopyGuardRuntime(): BulkCopyGuardRuntime | null {
  return activeRuntime;
}

function resolveItemCount(text: string): number {
  const ctx = activeRuntime;
  if (!ctx) return 0;

  const live = ctx.getLiveItemCount?.() ?? 0;
  if (live > 0) return live;

  return countClipboardItems(text, ctx.source);
}

function tryBlockClipboardWrite(text: string): boolean {
  const ctx = activeRuntime;
  if (!ctx || ctx.isAdmin || !ctx.documentId) return false;

  const itemCount = resolveItemCount(text);
  if (itemCount <= 0) return false;

  return blockBulkCopyInteraction(ctx.isAdmin, itemCount, {
    documentId: ctx.documentId,
    documentTitle: ctx.documentTitle,
    documentHref: ctx.documentHref,
    source: ctx.source,
  });
}

/** 全局拦截 navigator.clipboard.write/writeText（Univer 走此路径，不触发 copy 事件） */
export function ensureClipboardWriteGuard() {
  if (typeof window === "undefined" || clipboardGuardInstalled) return;
  if (!navigator.clipboard?.write || !navigator.clipboard?.writeText) return;

  clipboardGuardInstalled = true;
  const originalWrite = navigator.clipboard.write.bind(navigator.clipboard);
  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);

  navigator.clipboard.write = async (items: ClipboardItems) => {
    for (const item of items) {
      if (!item.types.includes("text/plain")) continue;
      const blob = await item.getType("text/plain");
      const text = await blob.text();
      if (tryBlockClipboardWrite(text)) {
        return;
      }
    }
    return originalWrite(items);
  };

  navigator.clipboard.writeText = async (text: string) => {
    if (tryBlockClipboardWrite(text)) return;
    return originalWriteText(text);
  };
}
