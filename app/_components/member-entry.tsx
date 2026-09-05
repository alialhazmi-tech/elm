"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ProfileAvatar } from "@/components/profile-avatar";
type Identity = { name: string; image?: string | null };
export function MemberEntry() {
  const [viewer, setViewer] = useState<{
    member?: Identity;
    editor?: Identity;
  }>({});
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menu.current) menu.current.open = false;
    const closeOutside = (event: PointerEvent) => {
      if (
        menu.current &&
        event.target instanceof Node &&
        !menu.current.contains(event.target)
      )
        menu.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pathname]);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () =>
      fetch("/api/viewer", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : {}))
        .then((data) => {
          setViewer(data);
          setLoaded(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoaded(true);
        });
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("alelm:profile-updated", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("alelm:profile-updated", refresh);
    };
  }, [pathname]);
  if (!loaded)
    return (
      <span className="member-entry" aria-busy="true" aria-label="تحميل الحساب">
        …
      </span>
    );
  if (!viewer.member && !viewer.editor)
    return (
      <Link className="member-entry" href="/join">
        دخول <span aria-hidden="true">↪</span>
      </Link>
    );
  const identity = viewer.member ?? viewer.editor!;
  const close = () => {
    if (menu.current) menu.current.open = false;
  };
  return (
    <details className="account-menu" ref={menu}>
      <summary
        className="member-entry is-member"
        aria-label={`حسابي: ${identity.name}`}
      >
        <ProfileAvatar name={identity.name} image={identity.image} size={28} />
        <span className="account-menu-name">{identity.name || "حسابي"}</span>
        <svg
          className="account-menu-caret"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m3 4.5 3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <nav className="account-menu-panel" aria-label="روابط حسابي">
        {viewer.member && (
          <Link href="/account" onClick={close}>
            <ProfileAvatar name={viewer.member.name} image={viewer.member.image} size={36} />
            <span className="account-menu-identity">
              <strong>الملف الشخصي</strong>
              <small>{viewer.member.name}</small>
            </span>
          </Link>
        )}
        {viewer.editor && (
          <>
            <Link href="/tahrir/profile" onClick={close}>
              <ProfileAvatar name={viewer.editor.name} image={viewer.editor.image} size={36} />
              <span className="account-menu-identity">
                <strong>ملف المحرر</strong>
                <small>{viewer.editor.name}</small>
              </span>
            </Link>
            <Link href="/tahrir/profile/saved" onClick={close}>
              <strong>محفوظات الحساب الإداري</strong>
            </Link>
            <Link href="/tahrir" onClick={close}>
              <strong>لوحة التحكم</strong>
            </Link>
          </>
        )}
      </nav>
    </details>
  );
}
