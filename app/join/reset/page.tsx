import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuthConfigured } from "@/lib/membership/auth";
import { ResetForm } from "./reset-form";
import "../member-auth.css";
export const metadata: Metadata = {
  title: "استعادة كلمة المرور",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="member-auth-shell" style={{ maxWidth: 540 }}>
        <section className="member-auth-panel">
          <ResetForm
            token={typeof token === "string" ? token : ""}
            available={memberAuthConfigured}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
