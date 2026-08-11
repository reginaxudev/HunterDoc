"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  ChevronRight,
  StickyNote,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import type { MindmapData, MindmapNode } from "@/lib/content-types";
import { generateId } from "@/lib/content-types";
import MentionInput from "@/components/MentionInput";
import type { MentionItem } from "@/lib/mentions";

interface MindmapEditorProps {
  data: MindmapData;
  onChange: (data: MindmapData) => void;
  editable?: boolean;
  documentId?: string;
  onMention?: (item: MentionItem, context: string) => void;
}

interface LayoutNode {
  id: string;
  text: string;
  note?: string;
  hasChildren: boolean;
  collapsed: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
}

const NODE_H = 40;
const NODE_MIN_W = 100;
const H_GAP = 80;
const V_GAP = 12;
const ROOT_COLOR = "bg-blue-600 text-white border-blue-700";
const BRANCH_COLORS = [
  "bg-blue-50 text-blue-800 border-blue-300",
  "bg-emerald-50 text-emerald-800 border-emerald-300",
  "bg-violet-50 text-violet-800 border-violet-300",
  "bg-orange-50 text-orange-800 border-orange-300",
  "bg-pink-50 text-pink-800 border-pink-300",
  "bg-cyan-50 text-cyan-800 border-cyan-300",
];

function updateNode(
  root: MindmapNode,
  nodeId: string,
  updater: (node: MindmapNode) => MindmapNode
): MindmapNode {
  if (root.id === nodeId) return updater(root);
  return {
    ...root,
    children: root.children.map((child) => updateNode(child, nodeId, updater)),
  };
}

function deleteNode(root: MindmapNode, nodeId: string): MindmapNode {
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== nodeId)
      .map((c) => deleteNode(c, nodeId)),
  };
}

function findNode(root: MindmapNode, id: string): MindmapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function findParent(
  root: MindmapNode,
  id: string
): { parent: MindmapNode; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === id) return { parent: root, index: i };
    const found = findParent(root.children[i], id);
    if (found) return found;
  }
  return null;
}

function estimateWidth(text: string, isRoot: boolean): number {
  const charW = isRoot ? 16 : 14;
  return Math.max(NODE_MIN_W, text.length * charW + 32);
}

function layoutTree(
  node: MindmapNode,
  depth: number,
  yStart: number,
  isRoot: boolean
): { layout: LayoutNode; nextY: number } {
  const width = estimateWidth(node.text, isRoot);
  const x = depth * (NODE_MIN_W + H_GAP);

  if (node.children.length === 0 || node.collapsed) {
    const layout: LayoutNode = {
      id: node.id,
      text: node.text,
      note: node.note,
      hasChildren: node.children.length > 0,
      collapsed: Boolean(node.collapsed),
      x,
      y: yStart,
      width,
      height: isRoot ? 48 : NODE_H,
      children: [],
    };
    return { layout, nextY: yStart + layout.height + V_GAP };
  }

  let currentY = yStart;
  const childLayouts: LayoutNode[] = [];

  for (const child of node.children) {
    const { layout, nextY } = layoutTree(child, depth + 1, currentY, false);
    childLayouts.push(layout);
    currentY = nextY;
  }

  const firstChild = childLayouts[0];
  const lastChild = childLayouts[childLayouts.length - 1];
  const centerY =
    (firstChild.y + firstChild.height / 2 + lastChild.y + lastChild.height / 2) / 2;

  const layout: LayoutNode = {
    id: node.id,
    text: node.text,
    note: node.note,
    hasChildren: true,
    collapsed: false,
    x,
    y: centerY - (isRoot ? 24 : NODE_H / 2),
    width,
    height: isRoot ? 48 : NODE_H,
    children: childLayouts,
  };

  return { layout, nextY: currentY };
}

function flattenLayout(node: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [node];
  for (const child of node.children as LayoutNode[]) {
    result.push(...flattenLayout(child));
  }
  return result;
}

function Connector({
  from,
  to,
}: {
  from: LayoutNode;
  to: LayoutNode;
}) {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const cx = (x1 + x2) / 2;

  return (
    <path
      d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
      fill="none"
      stroke="#cbd5e1"
      strokeWidth={2}
    />
  );
}

export default function MindmapEditor({
  data,
  onChange,
  editable = true,
  documentId,
  onMention,
}: MindmapEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { layout } = useMemo(
    () => layoutTree(data.root, 0, 0, true),
    [data.root]
  );

  const flatNodes = useMemo(() => flattenLayout(layout), [layout]);

  const connectors = useMemo(() => {
    const lines: { from: LayoutNode; to: LayoutNode }[] = [];
    function walk(node: LayoutNode) {
      for (const child of node.children as LayoutNode[]) {
        lines.push({ from: node, to: child });
        walk(child);
      }
    }
    walk(layout);
    return lines;
  }, [layout]);

  const updateText = (id: string, text: string) => {
    onChange({
      ...data,
      root: updateNode(data.root, id, (n) => ({ ...n, text })),
    });
  };

  const addChild = useCallback(
    (parentId: string) => {
      const newNode: MindmapNode = {
        id: generateId("n"),
        text: "新节点",
        children: [],
      };
      onChange({
        ...data,
        root: updateNode(data.root, parentId, (n) => ({
          ...n,
          children: [...n.children, newNode],
        })),
      });
      setSelectedId(newNode.id);
      setEditingId(newNode.id);
      setEditText("新节点");
    },
    [data, onChange]
  );

  const addSibling = useCallback(() => {
    if (!selectedId || selectedId === "root") return;
    const parentInfo = findParent(data.root, selectedId);
    if (!parentInfo) return;

    const newNode: MindmapNode = {
      id: generateId("n"),
      text: "新节点",
      children: [],
    };

    onChange({
      ...data,
      root: updateNode(data.root, parentInfo.parent.id, (n) => {
        const children = [...n.children];
        children.splice(parentInfo.index + 1, 0, newNode);
        return { ...n, children };
      }),
    });
    setSelectedId(newNode.id);
    setEditingId(newNode.id);
    setEditText("新节点");
  }, [selectedId, data, onChange]);

  const deleteNodeById = (id: string) => {
    if (id === "root") return;
    onChange({ ...data, root: deleteNode(data.root, id) });
    setSelectedId(null);
    setEditingId(null);
  };

  const toggleCollapse = (id: string) => {
    onChange({
      ...data,
      root: updateNode(data.root, id, (n) => ({
        ...n,
        collapsed: !n.collapsed,
      })),
    });
  };

  const setAllCollapsed = (collapsed: boolean) => {
    const walk = (node: MindmapNode): MindmapNode => ({
      ...node,
      collapsed: node.id === "root" ? false : collapsed,
      children: node.children.map(walk),
    });
    onChange({ ...data, root: walk(data.root) });
  };

  const updateNote = (id: string, note: string) => {
    onChange({
      ...data,
      root: updateNode(data.root, id, (n) => ({ ...n, note: note || undefined })),
    });
  };

  const selectedNode = selectedId ? findNode(data.root, selectedId) : null;

  const startEdit = (node: LayoutNode) => {
    if (!editable) return;
    setEditingId(node.id);
    setEditText(node.text);
    setSelectedId(node.id);
  };

  const commitEdit = () => {
    if (editingId) {
      updateText(editingId, editText.trim() || "未命名");
    }
    setEditingId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setScale((s) => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  };

  const handleMouseUp = () => {
    setPanning(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingId) return;
      if (!editable) return;

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          if (selectedId) addChild(selectedId);
          break;
        case "Enter":
          e.preventDefault();
          addSibling();
          break;
        case "Delete":
        case "Backspace":
          if (selectedId) deleteNodeById(selectedId);
          break;
        case "F2":
          if (selectedId) {
            const node = findNode(data.root, selectedId);
            if (node) {
              setEditingId(selectedId);
              setEditText(node.text);
            }
          }
          break;
        case "Escape":
          setSelectedId(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, editingId, editable, data.root, addChild, addSibling]);

  function getColorClass(node: LayoutNode): string {
    if (node.id === "root") return ROOT_COLOR;
    const depth = Math.floor(node.x / (NODE_MIN_W + H_GAP));
    return BRANCH_COLORS[depth % BRANCH_COLORS.length];
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f0f2f5]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Tab 子节点</span>
          <span>Enter 同级</span>
          <span>F2 编辑</span>
          <span>Delete 删除</span>
          <span>Alt+拖拽 平移</span>
          <span>Ctrl+滚轮 缩放</span>
        </div>
        <div className="flex items-center gap-1">
          {editable && (
            <>
              <button
                onClick={() => setAllCollapsed(false)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                title="展开全部"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setAllCollapsed(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                title="折叠全部"
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {editable && selectedId && (
            <>
              <button
                onClick={() => addChild(selectedId)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                <Plus className="h-3.5 w-3.5" /> 子节点
              </button>
              {selectedId !== "root" && (
                <button
                  onClick={() => deleteNodeById(selectedId)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setScale((s) => Math.min(2, s + 0.1))}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setScale(1);
              setPan({ x: 60, y: 40 });
            }}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <span className="ml-1 text-xs text-gray-400">{Math.round(scale * 100)}%</span>
        </div>
      </div>

      {/* Canvas + Note panel */}
      <div className="flex flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
          className="absolute"
        >
          <svg
            width={flatNodes.length * 300}
            height={flatNodes.length * 100}
            className="absolute left-0 top-0 overflow-visible"
            style={{ pointerEvents: "none" }}
          >
            {connectors.map(({ from, to }) => (
              <Connector key={`${from.id}-${to.id}`} from={from} to={to} />
            ))}
          </svg>

          {flatNodes.map((node) => {
            const isSelected = selectedId === node.id;
            const isEditing = editingId === node.id;
            const isRoot = node.id === "root";

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  minHeight: node.height,
                }}
                className={`group flex items-center justify-center rounded-xl border-2 px-4 shadow-sm transition-shadow ${getColorClass(node)} ${
                  isSelected ? "ring-2 ring-blue-400 ring-offset-2 shadow-md" : ""
                } ${isRoot ? "text-base font-bold" : "text-sm font-medium"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(node.id);
                }}
                onDoubleClick={() => startEdit(node)}
              >
                {isEditing ? (
                  <MentionInput
                    autoFocus
                    value={editText}
                    onChange={setEditText}
                    documentId={documentId}
                    onMention={(item) => onMention?.(item, `node:${node.id}`)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className={`w-full bg-transparent text-center outline-none ${
                      isRoot ? "text-white placeholder-blue-200" : ""
                    }`}
                  />
                ) : (
                  <span className="flex items-center gap-1 truncate">
                    {node.text}
                    {node.note && (
                      <StickyNote className="h-3 w-3 shrink-0 opacity-60" />
                    )}
                  </span>
                )}

                {node.hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(node.id);
                    }}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 rounded-full bg-white p-0.5 text-gray-400 shadow hover:text-gray-600"
                  >
                    {node.collapsed ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}

                {editable && !isRoot && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNodeById(node.id);
                    }}
                    className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 text-gray-400 opacity-0 shadow hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {editable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addChild(node.id);
                    }}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 rounded-full bg-blue-600 p-0.5 text-white opacity-0 shadow hover:bg-blue-700 group-hover:opacity-100"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Node detail panel */}
      {selectedNode && editable && (
        <aside className="w-64 shrink-0 border-l border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-800">{selectedNode.text}</h3>
          <p className="mb-3 text-xs text-gray-400">节点详情</p>
          <label className="mb-1 block text-xs font-medium text-gray-500">备注</label>
          <MentionInput
            multiline
            value={selectedNode.note ?? ""}
            onChange={(value) => updateNote(selectedNode.id, value)}
            documentId={documentId}
            onMention={(item) => onMention?.(item, `node:${selectedNode.id}/note`)}
            placeholder="添加节点备注..."
            rows={5}
            className="w-full resize-none rounded-md border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400"
          />
          <div className="mt-3 text-xs text-gray-400">
            {selectedNode.children.length} 个子节点
            {selectedNode.collapsed && " · 已折叠"}
          </div>
        </aside>
      )}
      </div>
    </div>
  );
}
