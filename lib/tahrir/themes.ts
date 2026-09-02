/**
 * مخصّص مظهر «تحرير العلم» — منقول من Shadcn UI Kit مع «هوية العلم» لوحةً افتراضية.
 * الاختيارات تُحفظ في كوكيز لكل مستخدم وتُقرأ على الخادم قبل الرسم الأول.
 */

export const TAHRIR_ROOT_ID = "tahrir-root";
export const THEME_COOKIE_PREFIX = "tahrir_theme_";

export const DEFAULT_THEME = {
  preset: "alelm",
  color: "default",
  radius: "default",
  scale: "none",
  contentLayout: "full",
  sidebarVariant: "inset",
  sidebarCollapsible: "icon",
} as const;

export type ThemeConfig = { -readonly [K in keyof typeof DEFAULT_THEME]: string };

export const THEME_PRESETS = [
  { value: "alelm", name: "هوية العلم", colors: ["#0b1a33", "#f5b92e"] },
  { value: "default", name: "الكِت الافتراضي", colors: ["oklch(0.33 0 0)"] },
  { value: "underground", name: "Underground", colors: ["oklch(0.5315 0.0694 156.19)"] },
  { value: "rose-garden", name: "Rose Garden", colors: ["oklch(0.5827 0.2418 12.23)"] },
  { value: "lake-view", name: "Lake View", colors: ["oklch(0.765 0.177 163.22)"] },
  { value: "sunset-glow", name: "Sunset Glow", colors: ["oklch(0.5827 0.2187 36.98)"] },
  { value: "forest-whisper", name: "Forest Whisper", colors: ["oklch(0.5276 0.1072 182.22)"] },
  { value: "ocean-breeze", name: "Ocean Breeze", colors: ["oklch(0.59 0.20 277.12)"] },
  { value: "lavender-dream", name: "Lavender Dream", colors: ["oklch(0.71 0.16 293.54)"] },
] as const;

/** الدرجة 600 من لوحة Tailwind — كما في الكِت؛ الـhex للعينات فقط. */
export const THEME_COLORS = [
  { value: "red", name: "أحمر", hex: "#dc2626" },
  { value: "orange", name: "برتقالي", hex: "#ea580c" },
  { value: "amber", name: "كهرماني", hex: "#d97706" },
  { value: "yellow", name: "أصفر", hex: "#ca8a04" },
  { value: "lime", name: "ليموني", hex: "#65a30d" },
  { value: "green", name: "أخضر", hex: "#16a34a" },
  { value: "emerald", name: "زمردي", hex: "#059669" },
  { value: "teal", name: "أزرق مخضرّ", hex: "#0d9488" },
  { value: "cyan", name: "سماوي", hex: "#0891b2" },
  { value: "sky", name: "سماء", hex: "#0284c7" },
  { value: "blue", name: "أزرق", hex: "#2563eb" },
  { value: "indigo", name: "نيلي", hex: "#4f46e5" },
  { value: "violet", name: "بنفسجي", hex: "#7c3aed" },
  { value: "purple", name: "أرجواني", hex: "#9333ea" },
  { value: "fuchsia", name: "فوشيا", hex: "#c026d3" },
  { value: "pink", name: "وردي", hex: "#db2777" },
  { value: "rose", name: "زهري", hex: "#e11d48" },
] as const;

export const RADIUS_OPTIONS = ["none", "sm", "default", "md", "lg"] as const;
export const SCALE_OPTIONS = ["sm", "none", "lg"] as const;
export const CONTENT_LAYOUT_OPTIONS = ["full", "centered"] as const;
export const SIDEBAR_VARIANTS = ["inset", "sidebar", "floating"] as const;
export const SIDEBAR_COLLAPSIBLE_OPTIONS = ["icon", "offcanvas"] as const;

export type SidebarVariant = (typeof SIDEBAR_VARIANTS)[number];
export type SidebarCollapsible = (typeof SIDEBAR_COLLAPSIBLE_OPTIONS)[number];

const ALLOWED: Record<keyof ThemeConfig, readonly string[]> = {
  preset: THEME_PRESETS.map((preset) => preset.value),
  color: ["default", ...THEME_COLORS.map((color) => color.value)],
  radius: RADIUS_OPTIONS,
  scale: SCALE_OPTIONS,
  contentLayout: CONTENT_LAYOUT_OPTIONS,
  sidebarVariant: SIDEBAR_VARIANTS,
  sidebarCollapsible: SIDEBAR_COLLAPSIBLE_OPTIONS,
};

const COOKIE_KEYS: Record<keyof ThemeConfig, string> = {
  preset: "preset",
  color: "color",
  radius: "radius",
  scale: "scale",
  contentLayout: "content_layout",
  sidebarVariant: "sidebar_variant",
  sidebarCollapsible: "sidebar_collapsible",
};

export function themeCookieName(key: keyof ThemeConfig): string {
  return `${THEME_COOKIE_PREFIX}${COOKIE_KEYS[key]}`;
}

/** يقرأ الإعدادات من الكوكيز ويرفض أي قيمة خارج القوائم المعروفة. */
export function readThemeFromCookies(
  read: (name: string) => string | undefined,
): ThemeConfig {
  const theme: ThemeConfig = { ...DEFAULT_THEME };
  for (const key of Object.keys(DEFAULT_THEME) as Array<keyof ThemeConfig>) {
    const value = read(themeCookieName(key));
    if (value && ALLOWED[key].includes(value)) theme[key] = value;
  }
  return theme;
}

/** سمات data-theme-* التي تقرأها themes.css — تُرسم على الخادم لتفادي وميض المظهر. */
export function themeDataAttributes(theme: ThemeConfig): Record<string, string> {
  const attributes: Record<string, string> = {
    "data-theme-preset": theme.preset,
    "data-theme-content-layout": theme.contentLayout,
    "data-theme-sidebar-variant": theme.sidebarVariant,
    "data-theme-sidebar-collapsible": theme.sidebarCollapsible,
  };
  if (theme.color !== "default") attributes["data-theme-color"] = theme.color;
  if (theme.radius !== "default") attributes["data-theme-radius"] = theme.radius;
  if (theme.scale !== "none") attributes["data-theme-scale"] = theme.scale;
  return attributes;
}

export const THEME_ATTRIBUTE_NAMES = [
  "data-theme-preset",
  "data-theme-color",
  "data-theme-radius",
  "data-theme-scale",
  "data-theme-content-layout",
  "data-theme-sidebar-variant",
  "data-theme-sidebar-collapsible",
] as const;
