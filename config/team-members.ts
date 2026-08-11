/**
 * 团队成员种子配置 — 修改姓名/用户名后运行 npm run db:seed 同步到数据库
 *
 * 默认密码：环境变量 DEFAULT_PASSWORD，未设置时为 Lt@202607
 * 管理员密码：环境变量 ADMIN_PASSWORD，未设置时为与 DEFAULT_PASSWORD 相同
 */
export const DEFAULT_MEMBER_PASSWORD = process.env.DEFAULT_PASSWORD ?? "Lt@202607";

/** gray 账号专用密码（与其他成员默认密码区分） */
export const GRAY_DEFAULT_PASSWORD = process.env.GRAY_PASSWORD ?? "Gr@y202608";

export interface TeamMemberSeed {
  username: string;
  name: string;
  role: "ADMIN" | "MEMBER";
  /** 职位，仅用于日志展示 */
  title?: string;
  /** 单独指定密码，不填则用团队默认密码 */
  password?: string;
}

export const TEAM_MEMBERS_SEED: TeamMemberSeed[] = [
  { username: "yu", name: "彧", role: "ADMIN", title: "管理员" },
  { username: "zhangming", name: "张明", role: "MEMBER", title: "Team Leader" },
  { username: "chenyue", name: "陈悦", role: "MEMBER", title: "Research" },
  { username: "liuyang", name: "刘洋", role: "MEMBER", title: "高级顾问" },
  { username: "wangjing", name: "王静", role: "MEMBER", title: "客户专员" },
  { username: "zhaolei", name: "赵磊", role: "MEMBER", title: "高级顾问" },
  { username: "sunting", name: "孙婷", role: "MEMBER", title: "项目助理" },
  { username: "zhoufeng", name: "周峰", role: "MEMBER", title: "业务总监" },
  { username: "wulin", name: "吴琳", role: "MEMBER", title: "Research" },
  { username: "zhenghao", name: "郑浩", role: "MEMBER", title: "高级顾问" },
  { username: "gray", name: "su", role: "MEMBER", title: "顾问", password: GRAY_DEFAULT_PASSWORD },
];

export const MEMBER_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#4f46e5",
  "#c026d3",
  "#0d9488",
  "#ca8a04",
];
