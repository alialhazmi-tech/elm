"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelRightCloseIcon, PanelRightOpenIcon, PlusIcon } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";

import { pageTitleFor } from "./nav";
import { ThemeCustomizerPanel } from "./theme-customizer";
import { ThemeSwitch } from "./theme-switch";

/** الهيدر اللاصق: طيّ الشريط، الفتات، تاريخ اليوم، ثم «مادة جديدة» وتبديل الوضع ومخصّص المظهر. */
export function SiteHeader({ today }: { today: string }) {
  const { toggleSidebar, open } = useSidebar();
  const pathname = usePathname();
  const status = useSearchParams().get("status");
  const title = pageTitleFor(pathname, status);

  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-md md:rounded-t-xl">
      <div className="flex w-full items-center gap-1 px-3 sm:px-4 lg:gap-2">
        <Button
          onClick={toggleSidebar}
          size="icon-sm"
          variant="ghost"
          aria-label={open ? "طيّ الشريط الجانبي" : "فتح الشريط الجانبي"}
        >
          {open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </Button>
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden sm:block">
              <BreadcrumbLink asChild>
                <Link href="/tahrir">تحرير العلم</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block rtl:rotate-180" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-display font-bold">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Separator orientation="vertical" className="mx-1 hidden data-[orientation=vertical]:h-4 md:block" />
        <span className="hidden text-xs text-muted-foreground md:inline">{today}</span>

        <div className="ms-auto flex items-center gap-1">
          <Button asChild size="sm" className="me-1 font-display font-bold shadow-md shadow-primary/30">
            <Link href="/tahrir/editor/new">
              <PlusIcon data-icon="inline-start" />
              <span className="hidden sm:inline">مادة جديدة</span>
              <span className="sr-only sm:hidden">مادة جديدة</span>
            </Link>
          </Button>
          <ThemeSwitch />
          <ThemeCustomizerPanel />
        </div>
      </div>
    </header>
  );
}
