"use client";

import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SunMoonIcon } from "lucide-react";
import { useTheme } from "next-themes";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import { NAV_GROUPS } from "./nav";

/** لوحة الأوامر ⌘K — تنقّل بين الشاشات وإجراءات سريعة؛ الاختصار بـ code لا key ليعمل على لوحة المفاتيح العربية. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyK" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="لوحة الأوامر"
      description="انتقل إلى شاشة أو نفّذ إجراءً سريعًا"
    >
      <CommandInput placeholder="ابحث عن شاشة أو أمر…" />
      <CommandList>
        <CommandEmpty>لا نتائج مطابقة.</CommandEmpty>
        <CommandGroup heading="إجراءات">
          <CommandItem value="مادة جديدة" onSelect={() => go("/tahrir/editor/new")}>
            <PlusIcon />
            <span>مادة جديدة</span>
          </CommandItem>
          <CommandItem
            value="تبديل الوضع الفاتح الداكن"
            onSelect={() => {
              onOpenChange(false);
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
            }}
          >
            <SunMoonIcon />
            <span>تبديل الوضع الفاتح والداكن</span>
          </CommandItem>
        </CommandGroup>
        {NAV_GROUPS.map((group) => (
          <Fragment key={group.title}>
            <CommandSeparator />
            <CommandGroup heading={group.title}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${group.title} ${item.title}`}
                  onSelect={() => go(item.href)}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
