"use client";

import { X } from "lucide-react";
import {
  DOCUMENT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplateFolderId,
} from "@/lib/templates";
import type { DocumentTemplate } from "@/types/document";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: DocumentTemplate) => void;
}

export default function TemplatePicker({
  open,
  onClose,
  onSelect,
}: TemplatePickerProps) {
  if (!open) return null;

  const categories = Object.entries(TEMPLATE_CATEGORIES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              选择模板
            </h2>
            <p className="text-sm text-gray-500">
              专为猎头场景设计的文档模板
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {categories.map(([key, { label, color }]) => {
            const templates = DOCUMENT_TEMPLATES.filter(
              (t) => t.category === key
            );
            if (templates.length === 0) return null;

            return (
              <div key={key} className="mb-6 last:mb-0">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
                  >
                    {label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        onSelect(template);
                        onClose();
                      }}
                      className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
                    >
                      <span className="text-2xl">{template.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {template.name}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                          {template.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { getTemplateFolderId };
