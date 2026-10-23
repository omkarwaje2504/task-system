// Per-person look & feel (Settings → Appearance). Shared by the server (to
// validate what's saved), the settings page and the pre-paint script.

export type Appearance = {
  /** Accent colour, #rrggbb. Empty = the theme's iOS blue. */
  accent?: string;
  /** Primary buttons: solid white/black, or the accent colour. */
  buttons?: "white" | "accent";
  /** Tab icons: outline that fills when selected, always outline, or always filled. */
  iconStyle?: "auto" | "outline" | "filled";
  iconWeight?: "thin" | "regular" | "bold";
  /** Text size multiplier (1 = default). */
  textScale?: number;
  /** Glass surfaces: 0 = solid, 100 = clearest. */
  transparency?: number;
  /** Glass blur in px. */
  blur?: number;
  /** Background image URL. */
  wallpaper?: string;
  /** How much the background image is darkened (dark) / washed out (light), 0–80. */
  wallpaperDim?: number;
};

export const DEFAULT_APPEARANCE = {
  accent: "",
  buttons: "white",
  iconStyle: "auto",
  iconWeight: "regular",
  textScale: 1,
  transparency: 50,
  blur: 16,
  wallpaper: "",
  wallpaperDim: 35,
} satisfies Required<Appearance>;

export const ACCENTS = [
  { name: "Blue", value: "#0a84ff" },
  { name: "Indigo", value: "#5e5ce6" },
  { name: "Purple", value: "#bf5af2" },
  { name: "Pink", value: "#ff375f" },
  { name: "Red", value: "#ff453a" },
  { name: "Orange", value: "#ff9f0a" },
  { name: "Yellow", value: "#ffd60a" },
  { name: "Green", value: "#30d158" },
  { name: "Mint", value: "#63e6e2" },
  { name: "Teal", value: "#40c8e0" },
  { name: "Graphite", value: "#8e8e93" },
];

export const TEXT_SIZES = [
  { label: "Small", value: 0.9 },
  { label: "Default", value: 1 },
  { label: "Large", value: 1.1 },
  { label: "Extra large", value: 1.2 },
];

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

/** Keeps only known, in-range values. Anything else falls back to the default. */
export function cleanAppearance(input: unknown): Appearance {
  const a = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Appearance = {
    accent: typeof a.accent === "string" && /^#[0-9a-f]{6}$/i.test(a.accent) ? a.accent.toLowerCase() : undefined,
    buttons: pick(a.buttons, ["white", "accent"] as const),
    iconStyle: pick(a.iconStyle, ["auto", "outline", "filled"] as const),
    iconWeight: pick(a.iconWeight, ["thin", "regular", "bold"] as const),
    textScale: num(a.textScale, 0.8, 1.3),
    transparency: num(a.transparency, 0, 100),
    blur: num(a.blur, 0, 40),
    wallpaper: typeof a.wallpaper === "string" && /^https:\/\/[^\s"'()<>]{1,600}$/.test(a.wallpaper) ? a.wallpaper : undefined,
    wallpaperDim: num(a.wallpaperDim, 0, 80),
  };
  for (const k of Object.keys(out) as (keyof Appearance)[]) if (out[k] === undefined) delete out[k];
  return out;
}

export const APPEARANCE_KEY = "appearance";

/**
 * Applies settings to <html> as data attributes + CSS variables; globals.css
 * does the rest. Must stay self-contained: its source is also inlined into
 * the pre-paint <script> in app/layout.tsx.
 */
export function applyAppearance(a: Appearance | null) {
  const d = document.documentElement;
  const st = d.style;
  const set = (k: string, v: string | false | undefined) => (v ? st.setProperty(k, v) : st.removeProperty(k));
  const attr = (k: string, v: string | false | undefined) => (v ? d.setAttribute(k, v) : d.removeAttribute(k));
  a = a || {};
  const c = a.accent;
  set("--accent", c);
  set("--accent-hover", c && `color-mix(in srgb, ${c} 82%, white)`);
  set("--accent-soft", c && `color-mix(in srgb, ${c} 20%, transparent)`);
  set("--text-scale", typeof a.textScale === "number" && a.textScale !== 1 && String(a.textScale));
  set("--glass-a", typeof a.transparency === "number" && a.transparency !== 50 && String(Math.max(0.06, 1 - a.transparency / 100)));
  set("--glass-blur", typeof a.blur === "number" && a.blur !== 16 && `${a.blur}px`);
  set("--wallpaper-url", a.wallpaper && `url("${a.wallpaper}")`);
  set("--wallpaper-dim", a.wallpaper && typeof a.wallpaperDim === "number" && String(a.wallpaperDim / 100));
  attr("data-wallpaper", a.wallpaper && "on");
  attr("data-buttons", a.buttons === "accent" && "accent");
  attr("data-icon-style", a.iconStyle && a.iconStyle !== "auto" && a.iconStyle);
  attr("data-icon-weight", a.iconWeight && a.iconWeight !== "regular" && a.iconWeight);
}
