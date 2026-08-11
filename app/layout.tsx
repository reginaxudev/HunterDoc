import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "猎头云文档",
  description: "专为猎头团队设计的协作文档平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="h-full overflow-hidden bg-white antialiased">
        <AuthProvider>
          <WorkspaceProvider>
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
