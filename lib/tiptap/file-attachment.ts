import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import FileAttachmentView from "@/components/FileAttachmentView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFileAttachment: (attrs: {
        url: string;
        fileName: string;
        fileType: string;
        fileSize: number;
      }) => ReturnType;
    };
  }
}

export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: null },
      fileName: { default: null },
      fileType: { default: null },
      fileSize: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-file-attachment]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-file-attachment": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },

  addCommands() {
    return {
      insertFileAttachment:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
