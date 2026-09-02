import {
  BarChart3Icon,
  CalendarClockIcon,
  CheckCheckIcon,
  FileClockIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LayersIcon,
  ListIcon,
  PenLineIcon,
  ChartNoAxesColumnIcon,
  SparklesIcon,
  Settings2Icon,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "total" | "review" | "scheduled";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** المفتاح الذي يُقرأ منه العدد الحي في الشارة. */
  badge?: NavBadgeKey;
  /** الشارة بلون الهوية (الاعتماد) بدل الرمادي. */
  badgeAccent?: boolean;
  /** مطابقة المسار حرفيًا (الرئيسية) بدل البادئة. */
  exact?: boolean;
  /** بادئة المسار التي تعتبر هذا البند نشطًا — عند غياب قيمة، يُشتق من href بلا استعلام. */
  match?: string | null;
  /** قيمة status في الاستعلام التي تنقل التمييز إلى هذا البند (الاعتماد). */
  status?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "العمل اليومي",
    items: [
      { title: "نظرة اليوم", href: "/tahrir", icon: LayoutDashboardIcon, exact: true },
      { title: "المواد", href: "/tahrir/stories", icon: ListIcon, badge: "total" },
      { title: "المحرر", href: "/tahrir/editor/new", icon: PenLineIcon, match: "/tahrir/editor" },
      { title: "الجدولة", href: "/tahrir/schedule", icon: CalendarClockIcon, badge: "scheduled" },
      {
        title: "الاعتماد",
        href: "/tahrir/stories?status=review",
        icon: CheckCheckIcon,
        badge: "review",
        badgeAccent: true,
        match: "/tahrir/stories",
        status: "review",
      },
    ],
  },
  {
    title: "المحتوى",
    items: [
      { title: "جاك العلم", href: "/tahrir/jak", icon: LayoutGridIcon },
      { title: "السلاسل", href: "/tahrir/series", icon: LayersIcon },
      { title: "الوسائط", href: "/tahrir/media", icon: ImagesIcon },
    ],
  },
  {
    title: "الذكاء الاصطناعي",
    items: [
      { title: "استوديو الإنفوجرافيك", href: "/tahrir/infographics", icon: BarChart3Icon },
      { title: "توليد الصور", href: "/tahrir/ai-images", icon: SparklesIcon },
      { title: "إعدادات الذكاء", href: "/tahrir/ai-settings", icon: Settings2Icon },
    ],
  },
  {
    title: "المنصة",
    items: [
      { title: "الإحصاءات", href: "/tahrir/stats", icon: ChartNoAxesColumnIcon },
      { title: "سجل التدقيق", href: "/tahrir/audit", icon: FileClockIcon },
    ],
  },
];

const matchPrefix = (item: NavItem) => item.match ?? item.href.split("?")[0];

/** البند النشط: الرئيسية بمطابقة حرفية، والبقية بالبادئة، و«الاعتماد» يأخذ التمييز من المواد عند status=review. */
export function isNavActive(item: NavItem, pathname: string, status: string | null): boolean {
  if (item.exact) return pathname === item.href;
  const prefix = matchPrefix(item);
  if (!(pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  const sibling = NAV_GROUPS.flatMap((group) => group.items).find(
    (other) => other !== item && other.status && matchPrefix(other) === prefix,
  );
  if (item.status) return status === item.status;
  return sibling ? status !== sibling.status : true;
}

/** عنوان الشاشة للفتات والتبويب. */
export function pageTitleFor(pathname: string, status: string | null): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isNavActive(item, pathname, status)) return item.title;
    }
  }
  return "تحرير العلم";
}
