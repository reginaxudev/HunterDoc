"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Loader2 } from "lucide-react";
import {
  DEFAULT_DOCUMENT_PERMISSION_SETTINGS,
  PERMISSION_LEVEL_LABELS,
  type DocumentPermissionSettings,
  type PermissionLevel,
} from "@/lib/document-permissions";

interface DocumentPermissionSettingsPanelProps {
  documentId: string;
}

const LEVEL_OPTIONS: PermissionLevel[] = ["manage", "edit", "comment", "read"];

function LevelSelect({
  value,
  onChange,
  disabled,
}: {
  value: PermissionLevel;
  onChange: (v: PermissionLevel) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PermissionLevel)}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
    >
      {LEVEL_OPTIONS.map((level) => (
        <option key={level} value={level}>
          {PERMISSION_LEVEL_LABELS[level]}
        </option>
      ))}
    </select>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg py-1.5 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function DocumentPermissionSettingsPanel({
  documentId,
}: DocumentPermissionSettingsPanelProps) {
  const [settings, setSettings] = useState<DocumentPermissionSettings>(
    DEFAULT_DOCUMENT_PERMISSION_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/${documentId}/permissions`);
        if (res.ok) {
          setSettings(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [documentId]);

  const persist = useCallback(
    async (next: DocumentPermissionSettings) => {
      setSettings(next);
      setSaving(true);
      setSavedHint(false);
      try {
        const res = await fetch(`/api/documents/${documentId}/permissions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (res.ok) {
          setSettings(await res.json());
          setSavedHint(true);
          setTimeout(() => setSavedHint(false), 2000);
        }
      } finally {
        setSaving(false);
      }
    },
    [documentId]
  );

  const patch = (partial: Partial<DocumentPermissionSettings>) => {
    void persist({ ...settings, ...partial });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载权限设置...
      </div>
    );
  }

  return (
    <div className="max-h-[min(70vh,560px)] overflow-y-auto px-6 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-800">权限设置</span>
          <span title="控制分享链接与协作者的访问能力">
            <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
          </span>
        </div>
        {(saving || savedHint) && (
          <span className="text-xs text-gray-400">
            {saving ? "保存中..." : "已保存"}
          </span>
        )}
      </div>

      <section className="mb-5">
        <h3 className="mb-2 text-xs font-semibold text-gray-500">对外分享</h3>
        <div className="space-y-1">
          <CheckboxRow
            checked={settings.allowExternalShare}
            onChange={(v) => patch({ allowExternalShare: v })}
            label="允许内容被分享到组织外"
          />
          <CheckboxRow
            checked={settings.externalShareManageOnly}
            onChange={(v) => patch({ externalShareManageOnly: v })}
            label="仅「可管理权限」可以将内容分享到组织外"
            disabled={!settings.allowExternalShare}
          />
          <CheckboxRow
            checked={settings.enableEncryptedLink}
            onChange={(v) => patch({ enableEncryptedLink: v })}
            label="启用加密链接（更长 token，提高安全性）"
            disabled={!settings.allowExternalShare}
          />
        </div>
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-xs font-semibold text-gray-500">
          谁可以查看、添加、移除协作者
        </h3>
        <LevelSelect
          value={settings.collaboratorManageLevel}
          onChange={(v) => patch({ collaboratorManageLevel: v })}
        />
        <div className="mt-2">
          <CheckboxRow
            checked={settings.collaboratorManageOrgOnly}
            onChange={(v) => patch({ collaboratorManageOrgOnly: v })}
            label="仅组织内的用户可以查看、添加、移除协作者"
          />
        </div>
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-xs font-semibold text-gray-500">谁可以复制内容</h3>
        <LevelSelect
          value={settings.copyLevel}
          onChange={(v) => patch({ copyLevel: v })}
        />
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-xs font-semibold text-gray-500">
          谁可以创建副本、打印和下载
        </h3>
        <LevelSelect
          value={settings.duplicatePrintDownloadLevel}
          onChange={(v) => patch({ duplicatePrintDownloadLevel: v })}
        />
      </section>

      <section className="mb-4">
        <h3 className="mb-2 text-xs font-semibold text-gray-500">谁可以评论</h3>
        <LevelSelect
          value={settings.commentLevel}
          onChange={(v) => patch({ commentLevel: v })}
        />
      </section>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center justify-center gap-1 border-t border-gray-100 pt-3 text-xs text-gray-500 hover:text-gray-700"
      >
        更多高级设置
        {showAdvanced ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {showAdvanced && (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-3 text-xs leading-relaxed text-gray-500">
          <p className="mb-1 font-medium text-gray-600">权限等级说明</p>
          <p>可管理 &gt; 可编辑 &gt; 可评论 &gt; 可阅读。分享链接的「只读 / 可编辑」会映射为可阅读 / 可编辑等级；管理员在组织内默认为可管理。</p>
          <p className="mt-2">关闭「对外分享」后，已有分享链接将无法访问。启用「加密链接」后，新生成的链接将使用更长的加密 token。</p>
        </div>
      )}
    </div>
  );
}
