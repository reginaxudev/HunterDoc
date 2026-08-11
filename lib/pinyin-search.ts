/** 简化的中文拼音首字母映射（用于 @ 搜索） */
const PINYIN_INITIALS: Record<string, string> = {
  张: "z", 李: "l", 王: "w", 陈: "c", 刘: "l", 赵: "z",
  顾: "g", 问: "w", 经: "j", 理: "l", 总: "z", 监: "j",
  助: "z", 研: "y", 客: "k", 户: "h", 专: "z", 员: "y",
  所: "s", 有: "y", 人: "r", 组: "z", 管: "g", 层: "c",
  今: "j", 天: "t", 明: "m", 后: "h", 下: "x", 周: "z",
  一: "y", 二: "e", 三: "s", 四: "s", 五: "w",
  文: "w", 档: "d", 表: "b", 格: "g", 图: "t",
};

export function getPinyinInitials(text: string): string {
  return text
    .split("")
    .map((ch) => PINYIN_INITIALS[ch] ?? ch.toLowerCase())
    .join("");
}

export function matchPinyinQuery(text: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const lower = text.toLowerCase();
  if (lower.includes(q)) return true;
  const initials = getPinyinInitials(text);
  if (initials.includes(q)) return true;
  // 首字母逐字匹配：zg -> 张顾
  let qi = 0;
  for (const ch of text) {
    const ini = PINYIN_INITIALS[ch];
    if (ini && ini === q[qi]) {
      qi++;
      if (qi >= q.length) return true;
    }
  }
  return false;
}
