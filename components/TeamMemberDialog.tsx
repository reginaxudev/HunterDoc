"use client";

import { useRouter } from "next/navigation";
import { X, UserPlus, ExternalLink } from "lucide-react";
import { getTeamMembers } from "@/lib/team-members";
import { useAuth } from "@/components/AuthProvider";

interface TeamMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function TeamMemberDialog({
  open,
  onClose,
}: TeamMemberDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const members = getTeamMembers().filter((m) => m.id !== "@all");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-96 rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <UserPlus className="h-4 w-4 text-blue-600" />
            团队成员
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto p-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: m.color }}
              >
                {m.name.slice(0, 1)}
              </span>
              <span className="font-medium text-gray-700">{m.name}</span>
              <span className="text-xs text-gray-400">{m.role}</span>
            </div>
          ))}
          {members.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">暂无团队成员</p>
          )}
        </div>

        {user?.role === "ADMIN" && (
          <div className="border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/admin/users");
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              管理团队账号
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
