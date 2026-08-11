"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
