export type InsertDialogType =
  | { type: "link" }
  | { type: "imageUrl" }
  | { type: "note"; existing?: string }
  | { type: "chart"; defaultRange: string }
  | { type: "sparkline"; defaultRange: string }
  | { type: "pivot"; defaultRange: string }
  | { type: "dateReminder" }
  | null;
