"use client";

import { useEffect, type ReactNode } from "react";
import type { ShareCapabilities } from "@/lib/document-permissions";

interface ShareAccessGuardProps {
  capabilities: ShareCapabilities;
  children: ReactNode;
}

/** 在分享页根据权限限制复制、打印等行为 */
export default function ShareAccessGuard({
  capabilities,
  children,
}: ShareAccessGuardProps) {
  useEffect(() => {
    const root = document.documentElement;

    if (!capabilities.canCopy) {
      root.style.userSelect = "none";
      root.style.webkitUserSelect = "none";
    } else {
      root.style.userSelect = "";
      root.style.webkitUserSelect = "";
    }

    const blockCopy = (e: ClipboardEvent) => {
      if (!capabilities.canCopy) e.preventDefault();
    };

    const blockPrint = (e: Event) => {
      if (!capabilities.canDuplicatePrintDownload) e.preventDefault();
    };

    const blockContextMenu = (e: MouseEvent) => {
      if (!capabilities.canCopy) e.preventDefault();
    };

    document.addEventListener("copy", blockCopy);
    document.addEventListener("cut", blockCopy);
    window.addEventListener("beforeprint", blockPrint);
    document.addEventListener("contextmenu", blockContextMenu);

    return () => {
      root.style.userSelect = "";
      root.style.webkitUserSelect = "";
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("cut", blockCopy);
      window.removeEventListener("beforeprint", blockPrint);
      document.removeEventListener("contextmenu", blockContextMenu);
    };
  }, [capabilities.canCopy, capabilities.canDuplicatePrintDownload]);

  return <>{children}</>;
}
