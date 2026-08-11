import { DEFAULT_MEMBER_PASSWORD, TEAM_MEMBERS_SEED } from "@/config/team-members";

/** Shown on login page — same value as seed default password. */
export const LOGIN_PASSWORD = DEFAULT_MEMBER_PASSWORD;

export const LOGIN_ACCOUNTS = TEAM_MEMBERS_SEED.map((member) => ({
  username: member.username,
  name: member.name,
  role: member.role,
  title: member.title,
}));
