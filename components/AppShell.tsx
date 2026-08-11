"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TemplatePicker from "@/components/TemplatePicker";
import BulkCopyToast from "@/components/BulkCopyToast";
import BulkCopyGuardHost from "@/components/BulkCopyGuardHost";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useAuth } from "@/components/AuthProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isSharePage = pathname.startsWith("/share/");
  const isLoginPage = pathname.startsWith("/login");

  const {
    folders,
    documents,
    searchQuery,
    setSearchQuery,
    createByType,
    createFromTemplate,
    deleteDoc,
    createNewFolder,
    showTemplatePicker,
    setShowTemplatePicker,
  } = useWorkspace();

  if (isSharePage || isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        folders={folders}
        documents={documents}
        onCreate={createByType}
        onNewFromTemplate={() => setShowTemplatePicker(true)}
        onNewFolder={createNewFolder}
        onDeleteDoc={deleteDoc}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={createFromTemplate}
      />
      <BulkCopyToast />
      <BulkCopyGuardHost />
    </div>
  );
}
