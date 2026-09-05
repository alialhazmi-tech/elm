"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, SearchIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { ProfileAvatar } from "@/components/profile-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import type { SidebarCollapsible, SidebarVariant } from "@/lib/tahrir/themes";
import { cn } from "@/lib/utils";

import { useThemeConfig } from "./active-theme";
import { CommandPalette } from "./command-palette";
import { isNavActive, navGroupsFor, type NavBadgeKey } from "./nav";
import { useLogout } from "./use-logout";

export interface SidebarUser {
  displayName: string;
  avatarUrl?: string | null;
  roleLabel: string;
  /** مفاتيح صلاحيات العضو — ترشّح القوائم فلا يرى بابًا مغلقًا. */
  permissions: string[];
}

export type NavCounts = Record<NavBadgeKey, number>;

/** الشريط الجانبي — يمين الشاشة، بلون اللوحة المختارة، وأعداد حية على المواد والاعتماد والجدولة. */
export function AppSidebar({ user, counts }: { user: SidebarUser; counts: NavCounts }) {
  const pathname = usePathname();
  const status = useSearchParams().get("status");
  const { theme } = useThemeConfig();
  const { isMobile, setOpenMobile } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const groups = navGroupsFor(user.permissions);
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <Sidebar
        side="right"
        collapsible={theme.sidebarCollapsible as SidebarCollapsible}
        variant={theme.sidebarVariant as SidebarVariant}
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                className="hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:px-0!"
              >
                <Link href="/tahrir" onClick={closeMobile}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-display text-base font-extrabold text-sidebar-primary-foreground">
                    ع
                  </span>
                  <span className="grid flex-1 leading-tight">
                    <span className="truncate font-display text-[15px] font-extrabold text-sidebar-foreground">
                      تحرير العلم
                    </span>
                    <span className="truncate text-[11px] text-sidebar-foreground/75">
                      المعرفة بسلاسة
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="بحث وأوامر — ⌘K"
                onClick={() => setPaletteOpen(true)}
                className="border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground/85"
              >
                <SearchIcon />
                <span>ابحث في المواد والأوامر</span>
                <Kbd className="ms-auto bg-transparent text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                  ⌘K
                </Kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isNavActive(item, pathname, status);
                    const count = item.badge ? counts[item.badge] : 0;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className="data-active:shadow-[inset_-2px_0_0_0_var(--sidebar-primary)]"
                        >
                          <Link href={item.href} onClick={closeMobile}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.badge && count > 0 ? (
                          <SidebarMenuBadge
                            className={cn(
                              "font-display tabular-nums",
                              item.badgeAccent
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "bg-sidebar-accent text-sidebar-accent-foreground",
                            )}
                          >
                            {count}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} />
    </>
  );
}

function NavUser({ user }: { user: SidebarUser }) {
  const { isMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const logout = useLogout();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            >
              <ProfileAvatar name={user.displayName} image={user.avatarUrl} size={32} />
              <span className="grid flex-1 text-start leading-tight">
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {user.displayName}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/75">{user.roleLabel}</span>
              </span>
              <ChevronsUpDownIcon className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 rounded-lg"
            side={isMobile ? "bottom" : "left"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex items-center gap-2 leading-tight">
              <ProfileAvatar name={user.displayName} image={user.avatarUrl} size={36} />
              <span className="grid min-w-0 gap-1">
                <span className="truncate font-semibold">{user.displayName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{user.roleLabel}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
              }}
            >
              <MoonIcon className="text-muted-foreground" />
              الوضع الداكن
              <Switch checked={resolvedTheme === "dark"} className="ms-auto" aria-hidden tabIndex={-1} />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/tahrir/profile">ملفي الشخصي</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/tahrir/security">أمان الحساب</Link></DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
              <LogOutIcon />
              خروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
