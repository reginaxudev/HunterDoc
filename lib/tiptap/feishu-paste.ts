import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import {
  extractFeishuFromClipboard,
  isFeishuContent,
  convertFeishuHtml,
} from "@/lib/feishu-import";

export const FeishuPaste = Extension.create({
  name: "feishuPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const html = clipboardData.getData("text/html");
            const flydoc =
              clipboardData.getData("application/x-flydoc") ||
              clipboardData.getData("application/x-lark-doc");

            const isFeishu =
              flydoc ||
              (html && isFeishuContent(html));

            if (!isFeishu) return false;

            event.preventDefault();

            const converted = extractFeishuFromClipboard(clipboardData);
            if (converted) {
              editor.commands.insertContent(converted);
              return true;
            }

            if (html) {
              editor.commands.insertContent(convertFeishuHtml(html));
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
