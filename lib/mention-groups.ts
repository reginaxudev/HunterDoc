/** @群组 — 批量通知多个成员 */
import { getTeamMembers } from "@/lib/team-members";

export interface MentionGroup {
  id: string;
  name: string;
  color: string;
  role: string;
  icon: string;
}

export const MENTION_GROUPS: MentionGroup[] = [
  {
    id: "grp_all",
    name: "全员",
    color: "#4f46e5",
    role: "通知所有团队成员",
    icon: "👥",
  },
  {
    id: "grp_leaders",
    name: "管理层",
    color: "#7c3aed",
    role: "管理员",
    icon: "⭐",
  },
];

function allMemberIds(): string[] {
  return getTeamMembers()
    .filter((m) => m.id !== "@all")
    .map((m) => m.id);
}

export function getGroupMemberIds(groupId: string): string[] {
  if (groupId === "grp_all") return allMemberIds();
  if (groupId === "grp_leaders") {
    return getTeamMembers()
      .filter((m) => m.role === "管理员")
      .map((m) => m.id);
  }
  return [];
}

export function isUserInGroup(
  groupId: string,
  userId: string,
  _userName: string,
  _memberNameLookup: (id: string) => string | undefined
): boolean {
  return getGroupMemberIds(groupId).includes(userId);
}
