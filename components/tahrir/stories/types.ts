import type { GuardTone } from "@/components/tahrir/badges";

/** صف جدول المواد كما يُسلَّم من الخادم إلى العميل — قيم بسيطة قابلة للتسلسل فقط. */
export interface StoryTableRow {
  id: string;
  title: string;
  meta: string;
  series: { name: string; color: string } | null;
  guard: { tone: GuardTone; label: string };
  status: string;
  statusLabel: string;
  updated: string;
  href: string | null;
  publicHref: string | null;
  isJak: boolean;
}

export function countLabel(count: number, noun: { one: string; two: string; few: string; many: string }): string {
  if (count === 1) return noun.one;
  if (count === 2) return noun.two;
  if (count >= 3 && count <= 10) return `${count} ${noun.few}`;
  return `${count} ${noun.many}`;
}
