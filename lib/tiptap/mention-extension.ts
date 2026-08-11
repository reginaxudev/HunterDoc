import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import MentionList, { type MentionListRef } from "@/components/MentionList";
import MentionBadgeView from "@/components/MentionBadgeView";
import { getMentionCandidates, mentionItemToAttrs, type MentionItem, type MentionTab } from "@/lib/mentions";
import { refreshTeamMembersCache } from "@/lib/team-members";
import { addRecentMention } from "@/lib/mention-recent";

export const ExtendedMention = Mention.extend({
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-label"),
        renderHTML: (attrs) => ({ "data-label": attrs.label }),
      },
      mentionType: {
        default: "person",
        parseHTML: (el) => el.getAttribute("data-mention-type") ?? "person",
        renderHTML: (attrs) => ({ "data-mention-type": attrs.mentionType }),
      },
      color: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-color"),
        renderHTML: (attrs) =>
          attrs.color ? { "data-color": attrs.color } : {},
      },
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-href"),
        renderHTML: (attrs) =>
          attrs.href ? { "data-href": attrs.href } : {},
      },
      dateValue: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-date"),
        renderHTML: (attrs) =>
          attrs.dateValue ? { "data-date": attrs.dateValue } : {},
      },
      icon: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-icon"),
        renderHTML: (attrs) =>
          attrs.icon ? { "data-icon": attrs.icon } : {},
      },
      memberIds: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-member-ids"),
        renderHTML: (attrs) =>
          attrs.memberIds ? { "data-member-ids": attrs.memberIds } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionBadgeView);
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.mentionType ?? "person";
    return [
      "span",
      {
        ...HTMLAttributes,
        class: `mention mention-${type}`,
        "data-type": "mention",
      },
      `@${node.attrs.label ?? node.attrs.id}`,
    ];
  },
});

export function createMentionExtension() {
  return ExtendedMention.configure({
    HTMLAttributes: {
      class: "mention",
    },
    renderLabel({ node }) {
      const type = node.attrs.mentionType;
      if (type === "date" && node.attrs.dateValue) {
        return node.attrs.label as string;
      }
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      char: "@",
      allowSpaces: false,
      items: ({ query }) => getMentionCandidates(query, "all"),
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let activeTab: MentionTab = "all";

        const renderCommand = (item: MentionItem) => {
          addRecentMention({
            id: item.id,
            label: item.label,
            type: item.type,
            color: item.color,
            icon: item.icon,
          });
          return mentionItemToAttrs(item);
        };

        return {
          onStart: (props: SuggestionProps<MentionItem>) => {
            component = new ReactRenderer(MentionList, {
              props: {
                items: props.items,
                query: props.query,
                command: (item: MentionItem) => {
                  props.command(renderCommand(item));
                },
                onTabChange: (tab: MentionTab) => {
                  activeTab = tab;
                  const items = getMentionCandidates(props.query, tab);
                  component?.updateProps({
                    items,
                    query: props.query,
                    activeTab: tab,
                    command: (item: MentionItem) => {
                      props.command(renderCommand(item));
                    },
                    onTabChange: (t: MentionTab) => {
                      activeTab = t;
                      component?.updateProps({
                        items: getMentionCandidates(props.query, t),
                        activeTab: t,
                      });
                    },
                  });
                },
              },
              editor: props.editor,
            });

            if (props.clientRect) {
              positionPopup(component.element as HTMLElement, props.clientRect());
            }

            void refreshTeamMembersCache().then(() => {
              const items = getMentionCandidates(props.query, activeTab);
              component?.updateProps({
                items,
                query: props.query,
                activeTab,
                command: (item: MentionItem) => {
                  props.command(renderCommand(item));
                },
              });
            });
          },

          onUpdate: (props: SuggestionProps<MentionItem>) => {
            const items = getMentionCandidates(props.query, activeTab);
            component?.updateProps({
              items,
              query: props.query,
              activeTab,
              command: (item: MentionItem) => {
                props.command(renderCommand(item));
              },
              onTabChange: (tab: MentionTab) => {
                activeTab = tab;
                component?.updateProps({
                  items: getMentionCandidates(props.query, tab),
                  activeTab: tab,
                });
              },
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
    },
  });
}

function positionPopup(
  element: HTMLElement | undefined,
  rect: DOMRect | null
) {
  if (!element || !rect) return;
  element.style.position = "fixed";
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.bottom + 4}px`;
  element.style.zIndex = "50";
  if (!element.parentElement) {
    document.body.appendChild(element);
  }
}
