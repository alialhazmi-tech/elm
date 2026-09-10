"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { endMemberSession } from "@/app/account/actions";
import { memberSessionStore } from "@/lib/membership/client-session";
type Identity = { name: string; image?: string | null };
export type MemberIdentity = Identity & { emailVerified: boolean };
export function MemberEntry({ preview }: { preview?: MemberIdentity }) {
  const router = useRouter();
  const [liveViewer, setViewer] = useState<{
    member?: MemberIdentity;
    editor?: Identity;
  }>({});
  const [liveLoaded, setLoaded] = useState(false);
  const [signOutState, signOut, signingOut] = useActionState(async () => {
    const result = await endMemberSession();
    if (result.success) {
      memberSessionStore.update(false);
      setViewer((current) => ({ ...current, member: undefined }));
      router.push("/");
      router.refresh();
    }
    return result;
  }, {});
  const viewer = preview ? { member: preview, editor: undefined } : liveViewer;
  const loaded = Boolean(preview) || liveLoaded;
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
    if (preview) return;
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      return fetch("/api/viewer", {
        credentials: "same-origin",
        cache: "no-store",
        signal: request.signal,
      })
        .then((response) => (response.ok ? response.json() : {}))
        .then((data: { member?: MemberIdentity; editor?: Identity }) => {
          if (request.signal.aborted) return;
          memberSessionStore.update(Boolean(data.member));
          setViewer(data);
          setLoaded(true);
        })
        .catch(() => {
          if (!request.signal.aborted) setLoaded(true);
        });
    };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("alelm:profile-updated", refresh);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("alelm:profile-updated", refresh);
    };
  }, [pathname, preview]);
  if (!loaded)
    return (
      <span className="member-entry" aria-busy="true" aria-label="تحميل الحساب">
        …
      </span>
    );
  if (!viewer.member && !viewer.editor)
    return (
      <Link className="member-entry" href="/join?mode=signin">
        دخول <span aria-hidden="true">↪</span>
      </Link>
    );
  const identity = viewer.member ?? viewer.editor!;
  const needsVerification = viewer.member?.emailVerified === false;
  const accountHref = preview ? "/prototype/account" : "/account";
  const close = () => {
    if (menu.current) menu.current.open = false;
  };
  return (
    <details className="account-menu" ref={menu}>
      <summary
        className="member-entry is-member"
        aria-label={`حسابي: ${identity.name}${needsVerification ? "، تنبيه: بريدك الإلكتروني غير موثّق" : ""}`}
      >
        <span className="account-menu-avatar">
          <ProfileAvatar name={identity.name} image={identity.image} size={28} />
          {needsVerification && <span className="account-menu-alert-dot" aria-hidden="true" />}
        </span>
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
        {needsVerification && (
          <Link
            className="account-menu-alert"
            href="/account/verify-email"
            onClick={close}
          >
            <span className="account-menu-alert-marker" aria-hidden="true" />
            <span className="account-menu-identity">
              <strong>بريدك غير موثّق</strong>
              <small>اضغط لإكمال توثيق البريد</small>
            </span>
          </Link>
        )}
        {viewer.member && (
          <Link href={accountHref} onClick={close}>
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
        {viewer.member && (
          <form action={signOut} className="account-menu-signout">
            <button type="submit" disabled={signingOut}>
              <LogOut size={18} aria-hidden="true" />
              {signingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
            </button>
            {signOutState.error && <p role="alert">{signOutState.error}</p>}
          </form>
        )}
      </nav>
    </details>
  );
}
