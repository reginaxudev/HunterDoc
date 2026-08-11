"use client";

import type { InsertDialogType } from "@/lib/sheet-insert-types";

interface SheetInsertDialogProps {
  dialog: InsertDialogType;
  selectionRange: string;
  onClose: () => void;
  onConfirm: (data: Record<string, string>) => void;
}

const fieldClass =
  "w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-300";

const TITLES: Record<string, string> = {
  link: "插入链接",
  imageUrl: "插入图片链接",
  note: "单元格备注",
  chart: "插入图表",
  sparkline: "插入迷你图",
  pivot: "数据透视表",
  dateReminder: "日期提醒",
};

export default function SheetInsertDialog({
  dialog,
  selectionRange,
  onClose,
  onConfirm,
}: SheetInsertDialogProps) {
  if (!dialog) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => {
      data[k] = String(v);
    });
    onConfirm(data);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold text-gray-800">
          {TITLES[dialog.type] ?? "插入"}
        </h3>
        <p className="mb-4 text-xs text-gray-400">选区: {selectionRange}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {dialog.type === "link" && (
            <>
              <input name="url" required placeholder="https://..." className={fieldClass} />
              <input name="label" placeholder="显示文字（可选）" className={fieldClass} />
            </>
          )}
          {dialog.type === "imageUrl" && (
            <input name="url" required placeholder="图片 URL" className={fieldClass} />
          )}
          {dialog.type === "note" && (
            <textarea
              name="note"
              defaultValue={dialog.existing ?? ""}
              rows={4}
              placeholder="输入备注内容..."
              className={`${fieldClass} resize-none`}
            />
          )}
          {dialog.type === "chart" && (
            <>
              <input name="sourceRange" defaultValue={dialog.defaultRange} placeholder="数据范围 A1:A5" className={fieldClass} />
              <input name="title" placeholder="图表标题（可选）" className={fieldClass} />
              <select name="chartType" defaultValue="bar" className={fieldClass}>
                <option value="bar">柱状图</option>
                <option value="line">折线图</option>
                <option value="pie">饼图</option>
              </select>
            </>
          )}
          {dialog.type === "sparkline" && (
            <input name="sourceRange" defaultValue={dialog.defaultRange} placeholder="数据源范围" className={fieldClass} />
          )}
          {dialog.type === "pivot" && (
            <>
              <input name="sourceRange" defaultValue={dialog.defaultRange} placeholder="源数据范围 A1:D20" className={fieldClass} />
              <input name="rowFieldCol" type="number" min={0} defaultValue={0} placeholder="分组列索引 (0=A)" className={fieldClass} />
              <input name="valueFieldCol" type="number" min={0} defaultValue={1} placeholder="值列索引" className={fieldClass} />
              <select name="agg" defaultValue="sum" className={fieldClass}>
                <option value="sum">求和</option>
                <option value="count">计数</option>
                <option value="avg">平均</option>
              </select>
            </>
          )}
          {dialog.type === "dateReminder" && (
            <>
              <input name="date" type="date" required className={fieldClass} />
              <input name="message" placeholder="提醒内容（可选）" className={fieldClass} />
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
              取消
            </button>
            <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
