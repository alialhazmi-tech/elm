import { accountTab, getMemberAccountData } from "@/lib/membership/account-data";
import { getMemberSession } from "@/lib/membership/session";
import { accountItems, MOBILE_ACCOUNT_CONTRACT } from "@/lib/mobile/account";
import { requestOrigin } from "@/lib/mobile/home";
import { privateJson } from "@/lib/personalization/session";

export async function GET(request: Request) {
  const { data } = await getMemberSession();
  const user = data?.user;
  if (!user) return privateJson({ error: "يلزم تسجيل الدخول", contract: MOBILE_ACCOUNT_CONTRACT }, 401);
  const params = new URL(request.url).searchParams;
  const tab = accountTab(params.get("tab") ?? undefined);
  const name = user.name || "عضو العلم";
  const email = user.email || "";
  const account = await getMemberAccountData(user.id, email, name, tab, Number(params.get("page") ?? 1));
  const origin = requestOrigin(request);
  return privateJson({
    contract: MOBILE_ACCOUNT_CONTRACT,
    memberId: user.id,
    tab,
    user: {
      name,
      email,
      joinedAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
      emailVerified: Boolean(user.emailVerified),
      image: user.image ?? null,
    },
    stats: account.stats,
    newsletterSubscribed: account.newsletterSubscribed,
    personalizationEnabled: account.profile.personalizationEnabled,
    items: accountItems(account, tab, origin),
    page: account.page,
    pageCount: account.pageCount,
  });
}
