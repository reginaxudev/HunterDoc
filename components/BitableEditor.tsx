"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Table2,
  Columns3,
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import type { BitableData, BitableField, BitableFieldType } from "@/lib/content-types";
import { generateId } from "@/lib/content-types";
import MentionInput from "@/components/MentionInput";
import type { MentionItem } from "@/lib/mentions";
import {
  applyFiltersAndSort,
  exportRecordsToCsv,
  getSelectColor,
  type BitableFilter,
  type BitableViewState,
} from "@/lib/bitable-utils";

interface BitableEditorProps {
  data: BitableData;
  onChange: (data: BitableData) => void;
  editable?: boolean;
  documentId?: string;
  onMention?: (item: MentionItem, context: string) => void;
}

const FIELD_TYPE_LABELS: Record<BitableFieldType, string> = {
  text: "文本",
  number: "数字",
  select: "单选",
  date: "日期",
  checkbox: "复选框",
};

export default function BitableEditor({
  data,
  onChange,
  editable = true,
  documentId,
  onMention,
}: BitableEditorProps) {
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<BitableFieldType>("text");
  const [showFilters, setShowFilters] = useState(false);
  const [dragRecordId, setDragRecordId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<{ fieldId: string; value: string } | null>(null);

  const viewState: BitableViewState = useMemo(() => {
    const base = data.viewState ?? { filters: [], search: "" };
    if (!quickFilter) return base;
    return {
      ...base,
      filters: [
        ...base.filters.filter((f) => f.fieldId !== quickFilter.fieldId),
        { fieldId: quickFilter.fieldId, operator: "equals" as const, value: quickFilter.value },
      ],
    };
  }, [data.viewState, quickFilter]);

  const setViewState = (patch: Partial<BitableViewState>) => {
    onChange({
      ...data,
      viewState: { ...viewState, ...patch },
    });
  };

  const filteredRecords = useMemo(
    () => applyFiltersAndSort(data.records, data.fields, viewState),
    [data.records, data.fields, viewState]
  );

  const updateRecord = (
    recordId: string,
    fieldId: string,
    value: string | number | boolean
  ) => {
    onChange({
      ...data,
      records: data.records.map((r) =>
        r.id === recordId
          ? { ...r, cells: { ...r.cells, [fieldId]: value } }
          : r
      ),
    });
  };

  const addRecord = () => {
    const cells: Record<string, string | number | boolean> = {};
    data.fields.forEach((f) => {
      cells[f.id] = f.type === "checkbox" ? false : f.type === "number" ? 0 : "";
    });
    onChange({
      ...data,
      records: [...data.records, { id: generateId("r"), cells }],
    });
  };

  const deleteRecord = (id: string) => {
    onChange({
      ...data,
      records: data.records.filter((r) => r.id !== id),
    });
  };

  const addField = () => {
    if (!newFieldName.trim()) return;
    const field: BitableField = {
      id: generateId("f"),
      name: newFieldName.trim(),
      type: newFieldType,
      ...(newFieldType === "select" && {
        options: ["选项1", "选项2", "选项3"],
      }),
    };
    onChange({ ...data, fields: [...data.fields, field] });
    setNewFieldName("");
    setShowAddField(false);
  };

  const deleteField = (fieldId: string) => {
    if (data.fields.length <= 1) return;
    onChange({
      ...data,
      fields: data.fields.filter((f) => f.id !== fieldId),
      records: data.records.map((r) => {
        const cells = { ...r.cells };
        delete cells[fieldId];
        return { ...r, cells };
      }),
    });
  };

  const toggleSort = (fieldId: string) => {
    if (viewState.sortField !== fieldId) {
      setViewState({ sortField: fieldId, sortDirection: "asc" });
    } else if (viewState.sortDirection === "asc") {
      setViewState({ sortDirection: "desc" });
    } else {
      setViewState({ sortField: undefined, sortDirection: null });
    }
  };

  const addFilter = () => {
    const field = data.fields[0];
    if (!field) return;
    const newFilter: BitableFilter = {
      fieldId: field.id,
      operator: field.type === "checkbox" ? "checked" : "contains",
      value: "",
    };
    setViewState({ filters: [...viewState.filters, newFilter] });
    setShowFilters(true);
  };

  const updateFilter = (index: number, patch: Partial<BitableFilter>) => {
    const filters = viewState.filters.map((f, i) =>
      i === index ? { ...f, ...patch } : f
    );
    setViewState({ filters });
  };

  const removeFilter = (index: number) => {
    setViewState({ filters: viewState.filters.filter((_, i) => i !== index) });
  };

  const handleExport = () => {
    const csv = exportRecordsToCsv(filteredRecords, data.fields);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedRecord = data.records.find((r) => r.id === selectedRecordId) ?? null;

  const selectFields = data.fields.filter((f) => f.type === "select");

  const kanbanField = data.fields.find((f) => f.id === data.kanbanField) ??
    data.fields.find((f) => f.type === "select");

  const renderCell = (record: BitableData["records"][0], field: BitableField, readOnly = false) => {
    const value = record.cells[field.id];
    const disabled = !editable || readOnly;

    if (disabled) {
      if (field.type === "select" && value) {
        return (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getSelectColor(String(value))}`}>
            {String(value)}
          </span>
        );
      }
      if (field.type === "checkbox") {
        return <span>{value ? "✓" : ""}</span>;
      }
      return <span className="text-sm">{String(value ?? "")}</span>;
    }

    switch (field.type) {
      case "checkbox":
        return (
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => updateRecord(record.id, field.id, e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
        );
      case "select":
        return (
          <select
            value={String(value ?? "")}
            onChange={(e) => updateRecord(record.id, field.id, e.target.value)}
            className="w-full rounded border-0 bg-transparent py-1 text-sm outline-none focus:bg-blue-50"
          >
            <option value="">-</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "number":
        return (
          <input
            type="number"
            value={Number(value ?? 0)}
            onChange={(e) => updateRecord(record.id, field.id, Number(e.target.value))}
            className="w-full bg-transparent py-1 text-sm outline-none focus:bg-blue-50"
          />
        );
      case "date":
        return (
          <input
            type="date"
            value={String(value ?? "")}
            onChange={(e) => updateRecord(record.id, field.id, e.target.value)}
            className="w-full bg-transparent py-1 text-sm outline-none focus:bg-blue-50"
          />
        );
      default:
        return (
          <MentionInput
            type="text"
            value={String(value ?? "")}
            onChange={(next) => updateRecord(record.id, field.id, next)}
            documentId={documentId}
            onMention={(item) =>
              onMention?.(item, `record:${record.id}/field:${field.id}`)
            }
            className="w-full bg-transparent py-1 text-sm outline-none focus:bg-blue-50"
          />
        );
    }
  };

  const SortIcon = ({ fieldId }: { fieldId: string }) => {
    if (viewState.sortField !== fieldId) {
      return <ArrowUpDown className="h-3 w-3 text-gray-300" />;
    }
    return viewState.sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-blue-500" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-500" />
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* View switcher + actions */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ ...data, view: "table" })}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              data.view === "table" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Table2 className="h-3.5 w-3.5" /> 表格视图
          </button>
          <button
            onClick={() =>
              onChange({ ...data, view: "kanban", kanbanField: kanbanField?.id })
            }
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              data.view === "kanban" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" /> 看板视图
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={viewState.search}
              onChange={(e) => setViewState({ search: e.target.value })}
              placeholder="搜索记录..."
              className="rounded-md border border-gray-200 py-1.5 pl-7 pr-3 text-xs outline-none focus:border-blue-400"
            />
          </div>
          <button
            onClick={() => {
              if (viewState.filters.length === 0) addFilter();
              setShowFilters(!showFilters);
            }}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs ${
              viewState.filters.length > 0
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            筛选
            {viewState.filters.length > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                {viewState.filters.length}
              </span>
            )}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" /> 导出
          </button>
          {editable && (
            <>
              <button
                onClick={() => setShowAddField(!showAddField)}
                className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" /> 添加字段
              </button>
              <button
                onClick={addRecord}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> 添加记录
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-1 text-xs text-gray-500">
        共 {data.records.length} 条记录
        {filteredRecords.length !== data.records.length && (
          <span> · 筛选后 {filteredRecords.length} 条</span>
        )}
      </div>

      {/* Quick filter chips */}
      {selectFields.length > 0 && data.view === "table" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2">
          <span className="text-xs text-gray-400">快捷筛选:</span>
          <button
            onClick={() => setQuickFilter(null)}
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              !quickFilter ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            全部
          </button>
          {selectFields.flatMap((field) =>
            (field.options ?? []).map((opt) => (
              <button
                key={`${field.id}-${opt}`}
                onClick={() =>
                  setQuickFilter(
                    quickFilter?.fieldId === field.id && quickFilter.value === opt
                      ? null
                      : { fieldId: field.id, value: opt }
                  )
                }
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  quickFilter?.fieldId === field.id && quickFilter.value === opt
                    ? getSelectColor(opt)
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {field.name}: {opt}
              </button>
            ))
          )}
        </div>
      )}

      {/* Filters panel */}
      {showFilters && (
        <div className="space-y-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
          {viewState.filters.map((filter, i) => {
            const field = data.fields.find((f) => f.id === filter.fieldId);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={filter.fieldId}
                  onChange={(e) => updateFilter(i, { fieldId: e.target.value })}
                  className="rounded border border-gray-200 px-2 py-1 text-xs"
                >
                  {data.fields.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <select
                  value={filter.operator}
                  onChange={(e) =>
                    updateFilter(i, { operator: e.target.value as BitableFilter["operator"] })
                  }
                  className="rounded border border-gray-200 px-2 py-1 text-xs"
                >
                  <option value="contains">包含</option>
                  <option value="equals">等于</option>
                  <option value="gt">大于</option>
                  <option value="lt">小于</option>
                  <option value="checked">已勾选</option>
                  <option value="unchecked">未勾选</option>
                </select>
                {!["checked", "unchecked"].includes(filter.operator) && (
                  <input
                    value={filter.value}
                    onChange={(e) => updateFilter(i, { value: e.target.value })}
                    placeholder="筛选值"
                    className="rounded border border-gray-200 px-2 py-1 text-xs"
                  />
                )}
                <button onClick={() => removeFilter(i)} className="text-gray-400 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button onClick={addFilter} className="text-xs text-blue-600 hover:underline">
            + 添加筛选条件
          </button>
        </div>
      )}

      {/* Add field form */}
      {showAddField && editable && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
          <input
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="字段名称"
            className="rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as BitableFieldType)}
            className="rounded border border-gray-200 px-2 py-1 text-sm outline-none"
          >
            {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button onClick={addField} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">
            确认
          </button>
        </div>
      )}

      {/* Table view */}
      {data.view === "table" && (
        <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="w-10 border-b border-gray-200 px-2 py-2 text-xs text-gray-400">#</th>
                {data.fields.map((field) => (
                  <th
                    key={field.id}
                    className="min-w-[140px] border-b border-r border-gray-200 px-3 py-2 text-left"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() => toggleSort(field.id)}
                        className="flex items-center gap-1 text-left hover:text-blue-600"
                      >
                        <div>
                          <div className="text-xs font-semibold text-gray-700">{field.name}</div>
                          <div className="text-xs text-gray-400">{FIELD_TYPE_LABELS[field.type]}</div>
                        </div>
                        <SortIcon fieldId={field.id} />
                      </button>
                      {editable && data.fields.length > 1 && (
                        <button onClick={() => deleteField(field.id)} className="text-gray-300 hover:text-red-400">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {editable && <th className="w-10 border-b border-gray-200" />}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, idx) => (
                <tr
                  key={record.id}
                  onClick={() => setSelectedRecordId(record.id)}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    selectedRecordId === record.id ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="border-b border-gray-100 px-2 py-1 text-center text-xs text-gray-400">
                    {idx + 1}
                  </td>
                  {data.fields.map((field) => (
                    <td key={field.id} className="border-b border-r border-gray-100 px-3 py-1">
                      {renderCell(record, field)}
                    </td>
                  ))}
                  {editable && (
                    <td className="border-b border-gray-100 px-2 py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRecord(record.id);
                        }}
                        className="text-gray-300 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              {data.records.length === 0 ? "暂无记录，点击「添加记录」开始" : "没有匹配的记录"}
            </div>
          )}
        </div>

        {selectedRecord && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">记录详情</h3>
              <button
                onClick={() => setSelectedRecordId(null)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {data.fields.map((field) => (
              <div key={field.id} className="mb-3">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {field.name}
                </label>
                <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
                  {renderCell(selectedRecord, field)}
                </div>
              </div>
            ))}
            {editable && (
              <button
                onClick={() => {
                  deleteRecord(selectedRecord.id);
                  setSelectedRecordId(null);
                }}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-red-200 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> 删除记录
              </button>
            )}
          </aside>
        )}
        </div>
      )}

      {/* Kanban view with drag-and-drop */}
      {data.view === "kanban" && kanbanField && (
        <div className="flex flex-1 gap-4 overflow-auto p-4">
          {(kanbanField.options ?? ["未分类"]).map((col) => {
            const colRecords = filteredRecords.filter(
              (r) =>
                String(r.cells[kanbanField.id] ?? "") === col ||
                (!r.cells[kanbanField.id] && col === "未分类")
            );
            return (
              <div
                key={col}
                className="flex w-72 shrink-0 flex-col rounded-xl bg-gray-50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragRecordId && editable) {
                    updateRecord(dragRecordId, kanbanField.id, col === "未分类" ? "" : col);
                    setDragRecordId(null);
                  }
                }}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getSelectColor(col)}`}>
                    {col}
                  </span>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                    {colRecords.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {colRecords.map((record) => (
                    <div
                      key={record.id}
                      draggable={editable}
                      onDragStart={() => setDragRecordId(record.id)}
                      onDragEnd={() => setDragRecordId(null)}
                      className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow ${
                        dragRecordId === record.id ? "opacity-50" : "hover:shadow-md"
                      } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      {data.fields
                        .filter((f) => f.id !== kanbanField.id)
                        .slice(0, 4)
                        .map((field) => (
                          <div key={field.id} className="mb-1.5 last:mb-0">
                            <div className="text-xs text-gray-400">{field.name}</div>
                            <div className="text-sm text-gray-800">
                              {field.type === "select" ? (
                                renderCell(record, field, true)
                              ) : field.type === "checkbox" ? (
                                record.cells[field.id] ? "✓" : "-"
                              ) : (
                                String(record.cells[field.id] ?? "-")
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
