import type { Editor } from "@tiptap/react";

export function scrollToMentionInEditor(editor: Editor, label: string) {
  const dom = editor.view.dom;
  const badges = dom.querySelectorAll(".mention-badge, .mention, [data-type='mention']");
  for (const el of badges) {
    if (el.textContent?.includes(label)) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("mention-flash");
      setTimeout(() => el.classList.remove("mention-flash"), 2500);
      return true;
    }
  }
  return false;
}
