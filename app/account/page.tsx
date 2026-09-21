import { getMemberSession } from "@/lib/membership/session";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuthConfigured } from "@/lib/membership/auth";
import {
  accountTab,
  emptyAccountData,
  getMemberAccountData,
} from "@/lib/membership/account-data";
import { AccountView } from "./account-view";
import "./account.css";

export const metadata: Metadata = {
  title: "ملفي الشخصي",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; tab?: string; page?: string }>;
}) {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await getMemberSession();
  if (!data?.user) redirect("/join?mode=signin&next=%2Faccount");
  const params = await searchParams;
  const tab = accountTab(params.tab);
  const name = data.user.name || "عضو العلم";
  const email = data.user.email || "";
  const account = await getMemberAccountData(
    data.user.id,
    email,
    name,
    tab,
    Number(params.page ?? 1),
  ).catch(() => emptyAccountData(data.user.id, email, name));
  account.user.image = data.user.image;
  account.user.emailVerified = data.user.emailVerified;
  account.user.joinedAt = data.user.createdAt
    ? new Date(data.user.createdAt).toISOString()
    : undefined;
  return (
    <>
      <SiteHeader />
      <AccountView data={account} tab={tab} welcome={params.welcome === "1"} />
      <SiteFooter />
    </>
  );
}
