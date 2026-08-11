import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import type { Editor, Range } from "@tiptap/core";
import SlashCommandList, {
  type SlashCommandListRef,
} from "@/components/SlashCommandList";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (opts: { editor: Editor; range: Range }) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: "标题 1",
    description: "大标题",
    icon: "H1",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "标题 2",
    description: "中标题",
    icon: "H2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "标题 3",
    description: "小标题",
    icon: "H3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "无序列表",
    description: "项目符号列表",
    icon: "•",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "有序列表",
    description: "编号列表",
    icon: "1.",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "待办事项",
    description: "任务清单",
    icon: "☑",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "引用",
    description: "引用块",
    icon: "❝",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "分割线",
    description: "水平分隔线",
    icon: "—",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "表格",
    description: "插入 3×3 表格",
    icon: "⊞",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
    {
      title: "提及成员",
      description: "输入 @ 提及团队成员",
      icon: "@",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent("@").run();
      },
    },
    {
      title: "提及文档",
      description: "输入 @ 链接到其他文档",
      icon: "📄",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent("@").run();
      },
    },
    {
      title: "插入日期",
      description: "输入 @ 插入今天/明天等",
      icon: "📅",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent("@").run();
      },
    },
];

function filterCommands(query: string): SlashCommandItem[] {
  const q = query.toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
  );
}

function positionPopup(element: HTMLElement | undefined, rect: DOMRect | null) {
  if (!element || !rect) return;
  element.style.position = "fixed";
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.bottom + 4}px`;
  element.style.zIndex = "50";
  document.body.appendChild(element);
}

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props }) => {
          (props as SlashCommandItem).command({ editor, range });
        },
        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  items: props.items,
                  command: (item: SlashCommandItem) => props.command(item),
                },
                editor: props.editor,
              });
              if (props.clientRect) {
                positionPopup(component.element as HTMLElement, props.clientRect());
              }
            },
            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              component?.updateProps({
                items: props.items,
                command: (item: SlashCommandItem) => props.command(item),
              });
              if (props.clientRect) {
                positionPopup(
                  component?.element as HTMLElement,
                  props.clientRect()
                );
              }
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                component?.destroy();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
