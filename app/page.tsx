"use client";

import { Clock, FileText, LayoutTemplate, TrendingUp } from "lucide-react";
import { DocCard, EmptyState } from "@/components/Sidebar";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { DOCUMENT_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { CONTENT_TYPE_META } from "@/lib/content-types";
import type { ContentType } from "@/types/document";

export default function HomePage() {
  const {
    documents,
    loading,
    createByType,
    createFromTemplate,
    setShowTemplatePicker,
    deleteDoc,
  } = useWorkspace();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        onCreate={createByType}
        onNewFromTemplate={() => setShowTemplatePicker(true)}
      />
    );
  }

  const recentDocs = [...documents]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="mt-1 text-sm text-gray-500">
            文档 · 表格 · 思维导图 · 多维表格，一站式猎头协作
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(CONTENT_TYPE_META) as ContentType[]).map((type) => {
            const meta = CONTENT_TYPE_META[type];
            const count = documents.filter((d) => (d.contentType ?? "doc") === type).length;
            return (
              <button
                key={type}
                onClick={() => createByType(type)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <div className="text-lg font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-500">{meta.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4">
          <StatCard
            icon={<FileText className="h-5 w-5 text-blue-600" />}
            label="全部内容"
            value={documents.length}
            bg="bg-blue-50"
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-emerald-600" />}
            label="本周更新"
            value={documents.filter((d) => {
              const diff =
                Date.now() - new Date(d.updatedAt).getTime();
              return diff < 7 * 86400000;
            }).length}
            bg="bg-emerald-50"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-violet-600" />}
            label="可用模板"
            value={DOCUMENT_TEMPLATES.length}
            bg="bg-violet-50"
          />
        </div>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">最近内容</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {recentDocs.map((doc) => (
              <DocCard key={doc.id} doc={doc} onDelete={deleteDoc} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              快速创建
            </h2>
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <LayoutTemplate className="h-4 w-4" />
              查看全部模板
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DOCUMENT_TEMPLATES.slice(0, 4).map((template) => {
              const cat = TEMPLATE_CATEGORIES[template.category];
              return (
                <button
                  key={template.id}
                  onClick={() => createFromTemplate(template)}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-blue-200 hover:shadow-sm"
                >
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {template.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${cat.color}`}
                      >
                        {cat.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {template.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
