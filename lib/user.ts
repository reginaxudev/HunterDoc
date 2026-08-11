import type { AuthUser } from "@/components/AuthProvider";

/** @deprecated Use useAuth() instead */
export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export function authUserToCollabUser(user: AuthUser): CollabUser {
  return { id: user.id, name: user.name, color: user.color };
}
