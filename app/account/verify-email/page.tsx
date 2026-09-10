import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { getMemberSession } from "@/lib/membership/session";
import { EmailVerificationForm } from "../email-verification-form";
import "../account.css";

export const metadata: Metadata = {
  title: "توثيق البريد الإلكتروني",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage() {
  const { data } = await getMemberSession();
  if (!data?.user) redirect("/join?mode=signin&next=%2Faccount%2Fverify-email");
  return (
    <>
      <SiteHeader />
      <main className="ac-shell ac-verification-page">
        <div className="ac-verification-card">
          <h1>توثيق البريد الإلكتروني</h1>
          {data.user.emailVerified ? (
            <p className="ac-feedback" role="status">
              <ShieldCheck size={20} aria-hidden="true" />
              بريدك الإلكتروني موثّق بالفعل.
            </p>
          ) : (
            <EmailVerificationForm key={data.user.email} email={data.user.email} />
          )}
          <Link className="ac-verification-back" href="/account">العودة إلى الملف الشخصي</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
