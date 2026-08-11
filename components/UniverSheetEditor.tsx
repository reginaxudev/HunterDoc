"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreZhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import UniverPresetSheetsFilterZhCN from "@univerjs/preset-sheets-filter/locales/zh-CN";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import UniverPresetSheetsFindReplaceZhCN from "@univerjs/preset-sheets-find-replace/locales/zh-CN";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import type { FUniver } from "@univerjs/core/lib/facade";
import type { IWorkbookData } from "@univerjs/core";
import {
  normalizeToWorkbook,
  wrapWorkbook,
  isSameWorkbook,
  isUniverSheetData,
  type UniverSheetData,
  type SheetContent,
} from "@/lib/sheet-univer";
import { formatMentionToken, type StoredMention } from "@/lib/content-mentions";
import type { MentionItem } from "@/lib/mentions";
import {
  blockBulkCopyInteraction,
  clearClipboardEvent,
  countActiveSheetCells,
  isSheetClipboardCommand,
  setBulkCopyGuardRuntime,
} from "@/lib/bulk-copy-guard";
import { CanceledError } from "@univerjs/core";

import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";

interface UniverSheetEditorProps {
  initialData: SheetContent;
  mentions?: StoredMention[];
  onChange: (data: UniverSheetData) => void;
  editable?: boolean;
  title?: string;
  documentId?: string;
  documentTitle?: string;
  documentHref?: string;
  isAdmin?: boolean;
  /** Offset from viewport top (header + toolbars). Default 88px. */
  viewportTopOffset?: number;
  /** Workbook 已挂载，可读取与 Univer 一致的 snapshot 基准 */
  onReady?: () => void;
}

export interface UniverSheetEditorRef {
  insertMentionAtActiveCell: (item: MentionItem) => string | null;
  /** Push latest workbook snapshot to parent onChange; returns snapshot if changed */
  flushSave: () => UniverSheetData | null;
  /** Always read current workbook (for API persistence) */
  getSnapshot: () => UniverSheetData | null;
}

const SAVE_DEBOUNCE_MS = 600;

function getStoredMentions(data: SheetContent): UniverSheetData["mentions"] {
  if (isUniverSheetData(data)) return data.mentions ?? [];
  return [];
}

const UniverSheetEditor = forwardRef<UniverSheetEditorRef, UniverSheetEditorProps>(
  function UniverSheetEditor(
    {
      initialData,
      mentions,
      onChange,
      editable = true,
      title,
      documentId,
      documentTitle,
      documentHref,
      isAdmin = false,
      viewportTopOffset = 88,
      onReady,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const univerAPIRef = useRef<FUniver | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<IWorkbookData | null>(null);
    const onChangeRef = useRef(onChange);
    const mentionsRef = useRef(getStoredMentions(initialData));
    const editableRef = useRef(editable);
    const isAdminRef = useRef(isAdmin);
    const copyMetaRef = useRef({ documentId, documentTitle, documentHref });
    const onReadyRef = useRef(onReady);

    onChangeRef.current = onChange;
    editableRef.current = editable;
    isAdminRef.current = isAdmin;
    copyMetaRef.current = { documentId, documentTitle, documentHref };
    onReadyRef.current = onReady;

    const readSnapshot = useCallback((): UniverSheetData | null => {
      const api = univerAPIRef.current;
      if (!api || !editableRef.current) return null;
      const wb = api.getActiveWorkbook();
      if (!wb) return null;
      const snapshot = wb.save();
      return wrapWorkbook(snapshot, mentionsRef.current);
    }, []);

    const flushSave = useCallback((): UniverSheetData | null => {
      const wrapped = readSnapshot();
      if (!wrapped) return null;
      const snapshot = wrapped.workbook;
      if (lastSavedRef.current && isSameWorkbook(lastSavedRef.current, snapshot)) {
        return null;
      }
      lastSavedRef.current = snapshot;
      onChangeRef.current(wrapped);
      return wrapped;
    }, [readSnapshot]);

    const getSnapshot = useCallback((): UniverSheetData | null => readSnapshot(), [readSnapshot]);

    const scheduleSave = useCallback(() => {
      if (!editableRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    }, [flushSave]);

    const insertMentionAtActiveCell = useCallback((item: MentionItem): string | null => {
      const api = univerAPIRef.current;
      if (!api) return null;
      const wb = api.getActiveWorkbook();
      if (!wb) return null;
      const range = wb.getActiveRange();
      if (!range) return null;

      const token = formatMentionToken(item);
      const current = range.getValue();
      const base = current != null && current !== "" ? `${String(current)} ` : "";
      range.setValue(`${base}${token}`);
      scheduleSave();
      return range.getA1Notation(true);
    }, [scheduleSave]);

    useImperativeHandle(ref, () => ({ insertMentionAtActiveCell, flushSave, getSnapshot }), [
      insertMentionAtActiveCell,
      flushSave,
      getSnapshot,
    ]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let cancelled = false;

      const workbookData = normalizeToWorkbook(initialData);
      if (title && !workbookData.name) {
        workbookData.name = title;
      }
      lastSavedRef.current = workbookData;
      mentionsRef.current = getStoredMentions(initialData);

      const { univerAPI } = createUniver({
        locale: LocaleType.ZH_CN,
        locales: {
          [LocaleType.ZH_CN]: mergeLocales(
            UniverPresetSheetsCoreZhCN,
            UniverPresetSheetsFilterZhCN,
            UniverPresetSheetsFindReplaceZhCN
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container,
            header: true,
            toolbar: true,
            ribbonType: "classic",
            formulaBar: true,
            footer: {},
          }),
          UniverSheetsFilterPreset(),
          UniverSheetsFindReplacePreset(),
        ],
      });

      if (cancelled) {
        univerAPI.dispose();
        return;
      }

      univerAPIRef.current = univerAPI;
      univerAPI.createWorkbook(workbookData);

      const wb = univerAPI.getActiveWorkbook();
      if (wb) {
        wb.setEditable(editableRef.current);
      }

      requestAnimationFrame(() => {
        if (!cancelled) onReadyRef.current?.();
      });

      const scheduleFromSheet = () => scheduleSave();

      const commandDisposable = univerAPI.addEvent(
        univerAPI.Event.CommandExecuted,
        scheduleFromSheet
      );

      const sheetChangedEvent = (
        univerAPI.Event as unknown as { SheetValueChanged?: string }
      ).SheetValueChanged;
      const valueDisposable = sheetChangedEvent
        ? (
            univerAPI.addEvent as (
              event: string,
              handler: () => void
            ) => { dispose: () => void }
          )(sheetChangedEvent, scheduleFromSheet)
        : { dispose: () => {} };

      const editEndedEvent = (
        univerAPI.Event as unknown as { SheetEditEnded?: string }
      ).SheetEditEnded;
      const editEndedDisposable = editEndedEvent
        ? (
            univerAPI.addEvent as (
              event: string,
              handler: (params: { isConfirm?: boolean }) => void
            ) => { dispose: () => void }
          )(editEndedEvent, (params) => {
            if (params.isConfirm !== false) flushSave();
          })
        : { dispose: () => {} };

      const getSheetCopyCount = (): number => {
        const wb = univerAPI.getActiveWorkbook();
        return countActiveSheetCells(wb);
      };

      const syncGuardRuntime = () => {
        const meta = copyMetaRef.current;
        if (!meta.documentId) return;
        setBulkCopyGuardRuntime({
          source: "sheet",
          isAdmin: isAdminRef.current,
          documentId: meta.documentId,
          documentTitle: meta.documentTitle ?? "未命名表格",
          documentHref: meta.documentHref ?? `/sheet/${meta.documentId}`,
          getLiveItemCount: getSheetCopyCount,
        });
      };

      syncGuardRuntime();

      const tryBlockSheetClipboard = (): boolean => {
        if (isAdminRef.current) return false;
        const meta = copyMetaRef.current;
        if (!meta.documentId) return false;

        const itemCount = getSheetCopyCount();
        if (itemCount <= 0) return false;

        return blockBulkCopyInteraction(isAdminRef.current, itemCount, {
          documentId: meta.documentId,
          documentTitle: meta.documentTitle ?? "未命名表格",
          documentHref: meta.documentHref ?? `/sheet/${meta.documentId}`,
          source: "sheet",
        });
      };

      const beforeCommandDisposable = univerAPI.addEvent(
        univerAPI.Event.BeforeCommandExecute,
        (event: { id: string; cancel?: boolean }) => {
          if (!isSheetClipboardCommand(event.id)) return;
          if (tryBlockSheetClipboard()) {
            event.cancel = true;
          }
        }
      );

      const commandService = (
        univerAPI as unknown as {
          _commandService: {
            beforeCommandExecuted: (
              listener: (command: { id: string }) => void
            ) => { dispose: () => void };
          };
        }
      )._commandService;
      const commandGuardDisposable = commandService.beforeCommandExecuted(
        (command) => {
          if (!isSheetClipboardCommand(command.id)) return;
          if (tryBlockSheetClipboard()) {
            throw new CanceledError();
          }
        }
      );

      const handleClipboard = (e: ClipboardEvent) => {
        if (tryBlockSheetClipboard()) {
          clearClipboardEvent(e);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (isAdminRef.current) return;
        if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
        const key = e.key.toLowerCase();
        if (key !== "c" && key !== "x") return;
        if (tryBlockSheetClipboard()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      };

      document.addEventListener("copy", handleClipboard, true);
      document.addEventListener("cut", handleClipboard, true);
      document.addEventListener("keydown", handleKeyDown, true);

      return () => {
        cancelled = true;
        setBulkCopyGuardRuntime(null);
        document.removeEventListener("copy", handleClipboard, true);
        document.removeEventListener("cut", handleClipboard, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        beforeCommandDisposable.dispose();
        commandGuardDisposable.dispose();
        commandDisposable.dispose();
        valueDisposable.dispose();
        editEndedDisposable.dispose();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        flushSave();
        univerAPI.dispose();
        univerAPIRef.current = null;
        container.replaceChildren();
      };
      // Mount once per document — parent should set key={documentId}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const meta = copyMetaRef.current;
      if (!meta.documentId || !univerAPIRef.current) return;
      setBulkCopyGuardRuntime({
        source: "sheet",
        isAdmin,
        documentId: meta.documentId,
        documentTitle: meta.documentTitle ?? "未命名表格",
        documentHref: meta.documentHref ?? `/sheet/${meta.documentId}`,
        getLiveItemCount: () => {
          const wb = univerAPIRef.current?.getActiveWorkbook();
          return countActiveSheetCells(wb ?? null);
        },
      });
    }, [isAdmin, documentId, documentTitle, documentHref]);

    useEffect(() => {
      if (mentions) mentionsRef.current = mentions;
    }, [mentions]);

    useEffect(() => {
      const wb = univerAPIRef.current?.getActiveWorkbook();
      if (wb) wb.setEditable(editable);
    }, [editable]);

    return (
      <div
        ref={containerRef}
        className="w-full bg-[#f5f6f7]"
        style={{
          height: `calc(100dvh - ${viewportTopOffset}px)`,
          minHeight: 360,
        }}
      />
    );
  }
);

export default UniverSheetEditor;
