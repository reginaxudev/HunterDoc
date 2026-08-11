/** Feishu-style color palette — base hues + shade rows */

export type ColorPickerMode = "text" | "fill";

/** 10 base hues matching Feishu palette */
export const BASE_HUES = [
  "#ffffff",
  "#4a86e8",
  "#00bcd4",
  "#34a853",
  "#8bc34a",
  "#ffeb3b",
  "#ff9800",
  "#ea4335",
  "#e91e63",
  "#9c27b0",
];

const SHADE_STOPS = [0.92, 0.78, 0.58, 0.38, 0.18];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex: string, target: { r: number; g: number; b: number }, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (hex.toLowerCase() === "#ffffff") {
    // White column: grayscale shades
    const g = Math.round(255 * (1 - amount * 0.85));
    return rgbToHex(g, g, g);
  }
  return rgbToHex(
    rgb.r + (target.r - rgb.r) * amount,
    rgb.g + (target.g - rgb.g) * amount,
    rgb.b + (target.b - rgb.b) * amount
  );
}

/** 6 rows × 10 cols palette grid */
export function buildPaletteGrid(mode: ColorPickerMode): string[][] {
  const rows: string[][] = [];

  // Row 0: base colors (fill mode first cell = no-fill white)
  const baseRow = BASE_HUES.map((c, i) => {
    if (mode === "text" && i === 0) return "#000000";
    return c;
  });
  rows.push(baseRow);

  // Rows 1-5: lighter → darker shades
  for (const stop of SHADE_STOPS) {
    rows.push(
      BASE_HUES.map((c, i) => {
        if (i === 0) {
          if (mode === "fill") return mix("#ffffff", { r: 200, g: 200, b: 200 }, stop);
          return mix("#000000", { r: 255, g: 255, b: 255 }, stop);
        }
        return mix(c, { r: 0, g: 0, b: 0 }, stop);
      })
    );
  }

  return rows;
}

const RECENT_KEY_TEXT = "sheet-recent-text-colors";
const RECENT_KEY_FILL = "sheet-recent-fill-colors";
const MAX_RECENT = 10;

export function loadRecentColors(mode: ColorPickerMode): string[] {
  if (typeof window === "undefined") return [];
  try {
    const key = mode === "text" ? RECENT_KEY_TEXT : RECENT_KEY_FILL;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentColor(mode: ColorPickerMode, color: string): string[] {
  const prev = loadRecentColors(mode).filter((c) => c.toLowerCase() !== color.toLowerCase());
  const next = [color, ...prev].slice(0, MAX_RECENT);
  if (typeof window !== "undefined") {
    const key = mode === "text" ? RECENT_KEY_TEXT : RECENT_KEY_FILL;
    localStorage.setItem(key, JSON.stringify(next));
  }
  return next;
}

export function normalizeHex(color: string): string {
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  }
  return c;
}

export function colorsMatch(a?: string, b?: string): boolean {
  if (!a && !b) return true;
  if (!a || !b) {
    if (!a && b && normalizeHex(b) === "#000000") return true;
    if (!b && a && normalizeHex(a) === "#000000") return true;
    return false;
  }
  return normalizeHex(a) === normalizeHex(b);
}

export const DEFAULT_TEXT_COLOR = "#000000";
export const DEFAULT_FILL_COLOR = "#ffffff";

export function displayBarColor(mode: ColorPickerMode, value?: string): string {
  if (mode === "text") return value ?? DEFAULT_TEXT_COLOR;
  return value ?? DEFAULT_FILL_COLOR;
}

export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 160;
}
