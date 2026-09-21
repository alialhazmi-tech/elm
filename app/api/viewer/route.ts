import { getMemberSession } from "@/lib/membership/session";
import { loadActor } from "@/lib/tahrir/access";
import { privateJson } from "@/lib/personalization/session";
export async function GET() {
  try {
    const [membership, editor] = await Promise.all([
      getMemberSession({ strict: true }),
      loadActor(),
    ]);
    return privateJson({
      member: membership.data?.user
        ? {
            name: membership.data.user.name,
            image: membership.data.user.image,
            emailVerified: membership.data.user.emailVerified === true,
          }
        : null,
      editor: editor
        ? { name: editor.displayName, image: editor.avatarUrl }
        : null,
    });
  } catch {
    return privateJson({ error: "تعذر تحميل الحساب." }, 503);
  }
}
