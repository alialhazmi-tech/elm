"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function MemberEntry() {
  const [member, setMember] = useState<{ name?: string } | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => { if (active) setMember(session?.user ?? null); })
      .catch(() => null);
    return () => { active = false; };
  }, [pathname]);
  return (
    <Link className={`member-entry${member ? " is-member" : ""}`} href={member ? "/account" : "/join"}>
      <span>{member ? "حسابي" : "دخول"}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {member ? <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></> : <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 4v16" /></>}
      </svg>
    </Link>
  );
}
