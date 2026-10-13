import { getMemberSession } from "@/lib/membership/session";
import { loadActor } from "@/lib/tahrir/access";
import { privateJson } from "@/lib/personalization/session";
import { logViewerFailure } from "@/lib/session-diagnostics";

export async function GET() {
  const requestId = crypto.randomUUID();
  const observe = async <T,>(dependency: "member" | "editor", read: () => Promise<T>) => {
    const started = performance.now();
    try { return await read(); }
    catch (error) {
      logViewerFailure(error, requestId, dependency, performance.now() - started);
      throw error;
    }
  };
  const respond = (body: unknown, status = 200) => {
    const response = privateJson(body, status);
    response.headers.set("X-Request-Id", requestId);
    return response;
  };
  try {
    const [membership, editor] = await Promise.all([
      observe("member", () => getMemberSession({ strict: true })),
      observe("editor", () => loadActor({ strict: true })),
    ]);
    return respond({
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
    return respond({ error: "تعذر تحميل الحساب." }, 503);
  }
}
