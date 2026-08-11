export interface MentionUser {
  id: string;
  name: string;
  username?: string;
  color: string;
  role?: string;
  online?: boolean;
  custom?: boolean;
}

const ALL_MEMBERS: MentionUser = {
  id: "@all",
  name: "所有人",
  color: "#4f46e5",
  role: "通知全员",
};

let cachedMembers: MentionUser[] = [];
let cacheLoaded = false;

export async function refreshTeamMembersCache(): Promise<MentionUser[]> {
  try {
    const res = await fetch("/api/users");
    if (!res.ok) return cachedMembers;
    const users = (await res.json()) as Array<{
      id: string;
      username: string;
      name: string;
      color: string;
      role: string;
    }>;
    cachedMembers = users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      color: u.color,
      role: u.role === "ADMIN" ? "管理员" : "团队成员",
    }));
    cacheLoaded = true;
  } catch {
    // keep previous cache
  }
  return getTeamMembers();
}

export function getTeamMembers(): MentionUser[] {
  const members = cacheLoaded ? cachedMembers : [];
  return [...members, ALL_MEMBERS];
}

export function isTeamMembersLoaded(): boolean {
  return cacheLoaded;
}

/** @deprecated local custom members replaced by admin user management */
export function getCustomMembers(): MentionUser[] {
  return [];
}

export function saveCustomMembers(_members: MentionUser[]) {}

export function addCustomMember(_name: string, _role?: string): MentionUser {
  throw new Error("请通过「团队管理」添加成员");
}

export function removeCustomMember(_id: string) {}
