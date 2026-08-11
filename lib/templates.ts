import type { DocumentTemplate } from "@/types/document";

export const TEMPLATE_CATEGORIES = {
  candidate: { label: "候选人", color: "bg-blue-50 text-blue-700" },
  client: { label: "客户", color: "bg-emerald-50 text-emerald-700" },
  interview: { label: "面试", color: "bg-amber-50 text-amber-700" },
  internal: { label: "内部", color: "bg-violet-50 text-violet-700" },
} as const;

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "candidate-profile",
    name: "候选人评估报告",
    description: "结构化记录候选人背景、能力评估与推荐意见",
    category: "candidate",
    icon: "👤",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "候选人评估报告" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "候选人：" },
            { type: "text", text: " " },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "目标职位：" },
            { type: "text", text: " " },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "顾问：" },
            { type: "text", text: " " },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "基本信息" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "bold" }], text: "姓名：" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "bold" }], text: "年龄：" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      marks: [{ type: "bold" }],
                      text: "当前公司/职位：",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      marks: [{ type: "bold" }],
                      text: "期望薪资：",
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      marks: [{ type: "bold" }],
                      text: "可到岗时间：",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "核心能力评估" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "请从专业技能、管理经验、行业认知、文化匹配等维度进行评估...",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "优势与风险" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "核心优势：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "潜在风险：" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "推荐意见" }],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "强烈推荐" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "推荐" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "待定" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "不推荐" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "job-brief",
    name: "职位需求分析",
    description: "梳理客户 JD、核心要求与搜索策略",
    category: "client",
    icon: "💼",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "职位需求分析" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "客户公司：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "职位名称：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "HC 数量：" },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "职位核心要求" }],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Must Have：" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Nice to Have：" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "薪酬范围" }],
        },
        { type: "paragraph" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "搜索策略" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "目标公司清单" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "关键词与渠道" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "排除条件" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "项目时间线" }],
        },
        { type: "paragraph" },
      ],
    },
  },
  {
    id: "client-meeting",
    name: "客户拜访纪要",
    description: "记录客户需求沟通、关键决策与后续行动",
    category: "client",
    icon: "🤝",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "客户拜访纪要" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "日期：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "客户：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "参会人员：" },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "沟通要点" }],
        },
        { type: "paragraph" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "客户反馈" }],
        },
        { type: "paragraph" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "后续行动项" }],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "行动项 1 — 负责人：" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "行动项 2 — 负责人：" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "interview-feedback",
    name: "面试反馈表",
    description: "记录各轮面试评价与录用建议",
    category: "interview",
    icon: "📝",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "面试反馈表" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "候选人：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "面试轮次：" },
            { type: "text", text: "（HR / 业务 / 高管）" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "面试官：" },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "评分维度（1-5 分）" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "专业能力：☐1 ☐2 ☐3 ☐4 ☐5" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "沟通表达：☐1 ☐2 ☐3 ☐4 ☐5" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "文化匹配：☐1 ☐2 ☐3 ☐4 ☐5" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "稳定性/动机：☐1 ☐2 ☐3 ☐4 ☐5" },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "详细评价" }],
        },
        { type: "paragraph" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "录用建议" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "☐ 进入下一轮  ☐ 录用  ☐ 待定  ☐ 淘汰",
            },
          ],
        },
      ],
    },
  },
  {
    id: "team-weekly",
    name: "团队周会纪要",
    description: "追踪团队 KPI、Pipeline 与本周重点",
    category: "internal",
    icon: "📊",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "团队周会纪要" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "日期：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "参会人：" },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "本周 KPI 回顾" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "新增候选人：" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "推荐报告数：" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "面试安排数：" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Offer / 入职：" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Pipeline 更新" }],
        },
        { type: "paragraph" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "问题与讨论" }],
        },
        { type: "paragraph" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "下周重点" }],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "重点 1" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "重点 2" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "offer-tracker",
    name: "Offer 跟进表",
    description: "跟踪 Offer 发放、谈判与入职状态",
    category: "internal",
    icon: "🎯",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Offer 跟进表" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "候选人：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "客户公司：" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "职位：" },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Offer 详情" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "bold" }], text: "Offer 日期：" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "bold" }], text: "薪酬包：" },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", marks: [{ type: "bold" }], text: "预计入职：" },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "状态追踪" }],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Offer 已发放" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "候选人已接受" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "背调完成" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "已入职" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "备注" }],
        },
        { type: "paragraph" },
      ],
    },
  },
];

export function getTemplateFolderId(category: string): string | null {
  switch (category) {
    case "candidate":
      return "folder-candidates";
    case "client":
      return "folder-clients";
    case "internal":
    case "interview":
      return "folder-internal";
    default:
      return null;
  }
}
