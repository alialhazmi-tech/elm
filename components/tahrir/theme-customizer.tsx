"use client";

import { BanIcon, PaletteIcon, RotateCcwIcon, ShuffleIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { useSidebar } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CONTENT_LAYOUT_OPTIONS,
  DEFAULT_THEME,
  RADIUS_OPTIONS,
  SCALE_OPTIONS,
  SIDEBAR_COLLAPSIBLE_OPTIONS,
  SIDEBAR_VARIANTS,
  THEME_COLORS,
  THEME_PRESETS,
  type ThemeConfig,
} from "@/lib/tahrir/themes";
import { cn } from "@/lib/utils";

import { useThemeConfig } from "./active-theme";

/** مخصّص المظهر من الكِت — درج على الطرف الأيسر (نهاية السطر في RTL) بلا ستار حتى تُرى النتيجة فورًا. */
export function ThemeCustomizerPanel() {
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="تخصيص المظهر">
          <PaletteIcon />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-80 data-[vaul-drawer-direction=left]:sm:max-w-80" overlay={false}>
        <DrawerHeader>
          <DrawerTitle>تخصيص المظهر</DrawerTitle>
          <DrawerDescription>يُحفظ اختيارك في هذا المتصفح. «هوية العلم» هي الافتراضي.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-5 overflow-y-auto px-4 pb-2">
          <PresetSelector />
          <ColorSelector />
          <SidebarVariantSelector />
          <SidebarCollapseSelector />
          <RadiusSelector />
          <ScaleSelector />
          <ColorModeSelector />
          <ContentLayoutSelector />
        </div>
        <DrawerFooter>
          <div className="flex gap-2">
            <RandomThemeButton />
            <ResetThemeButton />
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function presetPrimary(preset: string): string {
  const found = THEME_PRESETS.find((item) => item.value === preset) ?? THEME_PRESETS[0];
  return found.colors[found.colors.length - 1];
}

function swatchStyle(colors: readonly string[]): React.CSSProperties {
  return colors.length > 1
    ? { background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` }
    : { background: colors[0] };
}

function PresetSelector() {
  const { theme, setTheme } = useThemeConfig();
  return (
    <div className="grid gap-2">
      <Label>لوحة الألوان</Label>
      <div className="grid grid-cols-2 gap-1.5">
        {THEME_PRESETS.map((preset) => {
          const active = theme.preset === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme({ ...theme, preset: preset.value, color: "default" })}
              className={cn(
                "flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-start text-xs transition-colors hover:bg-accent",
                active && "border-foreground ring-1 ring-foreground",
              )}
            >
              <span className="size-3.5 shrink-0 rounded-sm border" style={swatchStyle(preset.colors)} />
              <span className="truncate">{preset.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColorSelector() {
  const { theme, setTheme } = useThemeConfig();
  const options = [
    { value: "default", name: "لون اللوحة", hex: presetPrimary(theme.preset) },
    ...THEME_COLORS,
  ];
  return (
    <div className="grid gap-2">
      <Label>اللون الأساسي</Label>
      <div className="grid grid-cols-9 gap-1.5">
        {options.map((color) => {
          const active = theme.color === color.value;
          return (
            <button
              key={color.value}
              type="button"
              title={color.name}
              aria-label={color.name}
              aria-pressed={active}
              onClick={() => setTheme({ ...theme, color: color.value })}
              className={cn(
                "size-6 rounded-full border-2 border-transparent transition-transform hover:scale-110",
                active && "border-foreground shadow-[inset_0_0_0_2px_var(--card)]",
              )}
              style={{ background: color.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label>{label}</Label>
      <ToggleGroup
        type="single"
        className="w-full"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as T);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} variant="outline" className="grow" value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

const RADIUS_LABELS: Record<(typeof RADIUS_OPTIONS)[number], React.ReactNode> = {
  none: <BanIcon />,
  sm: "صغيرة",
  default: "افتراضي",
  md: "متوسطة",
  lg: "كبيرة",
};

function RadiusSelector() {
  const { theme, setTheme } = useThemeConfig();
  return (
    <OptionGroup
      label="الزوايا"
      value={theme.radius}
      options={RADIUS_OPTIONS.map((value) => ({ value, label: RADIUS_LABELS[value] }))}
      onChange={(radius) => setTheme({ ...theme, radius })}
    />
  );
}

const SCALE_LABELS: Record<(typeof SCALE_OPTIONS)[number], string> = {
  sm: "مضغوط",
  none: "عادي",
  lg: "واسع",
};

function ScaleSelector() {
  const { theme, setTheme } = useThemeConfig();
  return (
    <OptionGroup
      label="المقياس"
      value={theme.scale}
      options={SCALE_OPTIONS.map((value) => ({ value, label: SCALE_LABELS[value] }))}
      onChange={(scale) => setTheme({ ...theme, scale })}
    />
  );
}

const LAYOUT_LABELS: Record<(typeof CONTENT_LAYOUT_OPTIONS)[number], string> = {
  full: "كامل العرض",
  centered: "متمركز",
};

function ContentLayoutSelector() {
  const { theme, setTheme } = useThemeConfig();
  return (
    <OptionGroup
      className="hidden lg:grid"
      label="تخطيط المحتوى"
      value={theme.contentLayout}
      options={CONTENT_LAYOUT_OPTIONS.map((value) => ({ value, label: LAYOUT_LABELS[value] }))}
      onChange={(contentLayout) => setTheme({ ...theme, contentLayout })}
    />
  );
}

const VARIANT_LABELS: Record<(typeof SIDEBAR_VARIANTS)[number], string> = {
  inset: "مطوّق",
  sidebar: "ملاصق",
  floating: "عائم",
};

function SidebarVariantSelector() {
  const { theme, setTheme } = useThemeConfig();
  return (
    <OptionGroup
      className="hidden lg:grid"
      label="نمط الشريط الجانبي"
      value={theme.sidebarVariant}
      options={SIDEBAR_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }))}
      onChange={(sidebarVariant) => setTheme({ ...theme, sidebarVariant })}
    />
  );
}

const COLLAPSE_LABELS: Record<"expanded" | (typeof SIDEBAR_COLLAPSIBLE_OPTIONS)[number], string> = {
  expanded: "موسّع",
  icon: "أيقونات",
  offcanvas: "مخفي",
};

function SidebarCollapseSelector() {
  const { state, setOpen } = useSidebar();
  const { theme, setTheme } = useThemeConfig();
  const value = state === "collapsed" ? theme.sidebarCollapsible : "expanded";
  return (
    <OptionGroup
      className="hidden lg:grid"
      label="طيّ الشريط"
      value={value}
      options={(["expanded", ...SIDEBAR_COLLAPSIBLE_OPTIONS] as const).map((option) => ({
        value: option,
        label: COLLAPSE_LABELS[option],
      }))}
      onChange={(next) => {
        if (next === "expanded") {
          setOpen(true);
          return;
        }
        setTheme({ ...theme, sidebarCollapsible: next });
        setOpen(false);
      }}
    />
  );
}

function ColorModeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <OptionGroup
      label="الوضع"
      value={theme ?? "system"}
      options={[
        { value: "light", label: "فاتح" },
        { value: "dark", label: "داكن" },
        { value: "system", label: "النظام" },
      ]}
      onChange={setTheme}
    />
  );
}

function pick<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function RandomThemeButton() {
  const { theme, setTheme } = useThemeConfig();
  return (
    <Button
      variant="outline"
      className="flex-1"
      onClick={() =>
        setTheme({
          ...theme,
          preset: pick(THEME_PRESETS).value,
          color: pick(["default", ...THEME_COLORS.map((color) => color.value)]),
          radius: pick(RADIUS_OPTIONS),
          scale: pick(SCALE_OPTIONS),
          contentLayout: pick(CONTENT_LAYOUT_OPTIONS),
          sidebarVariant: pick(SIDEBAR_VARIANTS),
        })
      }
    >
      <ShuffleIcon />
      لوحة عشوائية
    </Button>
  );
}

function ResetThemeButton() {
  const { setTheme } = useThemeConfig();
  const { setTheme: setColorMode } = useTheme();
  const { setOpen } = useSidebar();
  return (
    <Button
      className="flex-1"
      onClick={() => {
        setTheme({ ...DEFAULT_THEME } as ThemeConfig);
        setColorMode("system");
        setOpen(true);
      }}
    >
      <RotateCcwIcon />
      إعادة إلى هوية العلم
    </Button>
  );
}
