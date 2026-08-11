"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import MentionList from "@/components/MentionList";
import {
  getMentionCandidates,
  setDocumentsGetter,
  type MentionItem,
  type MentionTab,
} from "@/lib/mentions";
import {
  findMentionLabelsInText,
  resolveMentionByLabel,
} from "@/lib/parse-text-mentions";
import { useWorkspaceOptional } from "@/components/WorkspaceProvider";

type BaseProps = {
  value: string;
  onChange: (value: string) => void;
  onMention?: (item: MentionItem) => void;
  documentId?: string;
  multiline?: boolean;
  className?: string;
};

type MentionInputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className"> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className">;

export default function MentionInput({
  value,
  onChange,
  onMention,
  documentId,
  multiline = false,
  className = "",
  ...rest
}: MentionInputProps) {
  const workspace = useWorkspaceOptional();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MentionTab>("all");
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const atStartRef = useRef(-1);
  const notifiedLabelsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setDocumentsGetter(() => workspace?.documents ?? [], documentId);
  }, [workspace?.documents, documentId]);

  const items = getMentionCandidates(query, tab);

  const updatePicker = useCallback((text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const match = before.match(/@([\w\u4e00-\u9fff]*)$/);
    if (!match) {
      setOpen(false);
      return;
    }
    atStartRef.current = cursor - match[0].length;
    setQuery(match[1] ?? "");
    setOpen(true);

    const el = inputRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const next = e.target.value;
    const cursor = e.target.selectionStart ?? next.length;
    onChange(next);
    updatePicker(next, cursor);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (open && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") setOpen(false);
    rest.onKeyDown?.(e as never);
  };

  const insertMention = (item: MentionItem) => {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const start = atStartRef.current >= 0 ? atStartRef.current : cursor;
    const token = `@${item.label}`;
    const next = `${value.slice(0, start)}${token} ${value.slice(cursor)}`;
    onChange(next);
    notifiedLabelsRef.current.add(item.label);
    onMention?.(item);
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + token.length + 1;
      el?.setSelectionRange(pos, pos);
    });
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (onMention) {
      for (const label of findMentionLabelsInText(value)) {
        if (notifiedLabelsRef.current.has(label)) continue;
        const item = resolveMentionByLabel(label);
        if (item) {
          notifiedLabelsRef.current.add(label);
          onMention(item);
        }
      }
    }
    rest.onBlur?.(e as never);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        inputRef.current?.contains(t) ||
        panelRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const panel =
    open && items.length >= 0 ? (
      <div
        ref={panelRef}
        style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 10000 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MentionList
          items={items}
          query={query}
          activeTab={tab}
          onTabChange={setTab}
          command={insertMention}
        />
      </div>
    ) : null;

  const shared = {
    ref: inputRef as never,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      updatePicker(el.value, el.selectionStart ?? el.value.length);
      rest.onClick?.(e as never);
    },
    className,
  };

  return (
    <>
      {multiline ? (
        <textarea {...rest} {...shared} />
      ) : (
        <input {...rest} {...shared} type={rest.type ?? "text"} />
      )}
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}
