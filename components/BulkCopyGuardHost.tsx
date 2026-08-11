"use client";

import { useEffect } from "react";
import { ensureClipboardWriteGuard } from "@/lib/bulk-copy-guard";

/** 安装全局剪贴板写入拦截（仅需挂载一次） */
export default function BulkCopyGuardHost() {
  useEffect(() => {
    ensureClipboardWriteGuard();
  }, []);
  return null;
}
