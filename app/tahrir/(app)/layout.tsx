import { AppShell } from "@/components/tahrir/app-shell";
import { requireScreenActor } from "@/lib/tahrir/screen";

export default async function TahrirAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // الفاعل يُحلّ من القاعدة عند كل طلب: التعليق وتغيير الدور يسريان فورًا، والرمز يحمل الهوية فقط.
  const actor = await requireScreenActor();

  return <AppShell actor={actor}>{children}</AppShell>;
}
