"use client";

import Link from "next/link";
import { ProfileAvatar } from "@/components/profile-avatar";
import { usePathname, useSearchParams } from "next/navigation";
import { ExternalLinkIcon, PanelRightCloseIcon, PanelRightOpenIcon, PlusIcon } from "lucide-react";

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

import { HelpTour } from "./help-tour";
import { EditorialNotifications } from "./notifications";
import { pageTitleFor } from "./nav";
import { ThemeCustomizerPanel } from "./theme-customizer";
import { ThemeSwitch } from "./theme-switch";

/** الهيدر اللاصق: طيّ الشريط، الفتات، تاريخ اليوم، ثم «مادة جديدة» وتبديل الوضع ومخصّص المظهر. */
export function SiteHeader({ today, user, actorId, permissions }: { today: string; actorId: string; permissions: string[]; user: { name: string; image: string | null } }) {
  const { toggleSidebar, open } = useSidebar();
  const pathname = usePathname();
  const status = useSearchParams().get("status");
  const title = pageTitleFor(pathname, status);

  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/80 bg-background/90 backdrop-blur-md md:rounded-t-xl">
      <div className="flex w-full items-center gap-1 px-3 sm:px-4 lg:gap-2">
        <Button
          onClick={toggleSidebar}
          size="icon-sm"
          variant="ghost"
          className="size-9 md:size-7"
          aria-label={open ? "طيّ الشريط الجانبي" : "فتح الشريط الجانبي"}
        >
          {open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </Button>
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="hidden min-w-0 sm:block">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden sm:block">
              <BreadcrumbLink asChild>
                <Link href="/tahrir">تحرير العلم</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block rtl:rotate-180" />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate font-display font-bold">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Separator orientation="vertical" className="mx-1 hidden data-[orientation=vertical]:h-4 md:block" />
        <span className="hidden text-xs text-muted-foreground md:inline">{today}</span>

        <div className="ms-auto flex shrink-0 items-center gap-1">
          <HelpTour actorId={actorId} permissions={permissions} />
          <EditorialNotifications />
          <Button asChild size="sm" variant="outline">
            <Link href="/" target="_blank" rel="noopener noreferrer" prefetch={false} aria-label="عرض الصفحة الرئيسية للموقع — يفتح في تبويب جديد" title="عرض الموقع في تبويب جديد">
              <ExternalLinkIcon data-icon="inline-start" />
              <span className="hidden sm:inline">عرض الموقع</span>
            </Link>
          </Button>
          {(permissions.includes("*") || permissions.includes("story.create")) && <Button asChild size="sm" className="me-1 font-display font-bold shadow-md shadow-primary/30">
            <Link href="/tahrir/editor/new" data-tour-link="/tahrir/editor/new">
              <PlusIcon data-icon="inline-start" />
              <span className="hidden sm:inline">مادة جديدة</span>
              <span className="sr-only sm:hidden">مادة جديدة</span>
            </Link>
          </Button>
          }
          <Link href="/tahrir/profile" aria-label={`ملفي الشخصي: ${user.name}`} className="flex items-center gap-2 rounded-lg p-1 hover:bg-muted"><ProfileAvatar name={user.name} image={user.image} size={30} /><span className="hidden max-w-28 truncate text-sm font-semibold lg:inline">{user.name}</span></Link>
          <ThemeSwitch />
          <div className="hidden sm:block"><ThemeCustomizerPanel /></div>
        </div>
      </div>
    </header>
  );
}
