"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function MemberEntry() {
  const [member, setMember] = useState<{ name?: string } | null>(null);
  useEffect(() => {
    fetch("/api/auth/get-session", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => setMember(session?.user ?? null))
      .catch(() => null);
  }, []);
  return <Link className={`member-entry${member ? " is-member" : ""}`} href={member ? "/account" : "/join"}>{member ? `حسابي${member.name ? ` · ${member.name.split(" ")[0]}` : ""}` : "انضم"}</Link>;
}
