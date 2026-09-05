import { getMemberSession } from "@/lib/membership/session";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";

const handlers = memberAuth.handler();

function unavailable() {
  return Response.json(
    { error: "خدمة العضوية غير مهيأة في هذه البيئة." },
    { status: 503 },
  );
}

type Context = { params: Promise<{ path: string[] }> };

async function guarded(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  request: Request,
  context: Context,
) {
  if (!memberAuthConfigured) return unavailable();
  const path = (await context.params).path.join("/");
  // Keep sign-out available even to suspended accounts and during database failures.
  if (path === "sign-out") return handlers[method](request, context);
  try {
    const { suspended } = await getMemberSession();
    if (suspended)
      return Response.json(
        path === "get-session" ? null : { error: "حساب العضوية معلّق." },
        {
          status: path === "get-session" ? 200 : 403,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    return handlers[method](request, context);
  } catch {
    return Response.json(
      { error: "خدمة العضوية غير متاحة مؤقتًا." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export function GET(request: Request, context: Context) {
  return guarded("GET", request, context);
}
export function POST(request: Request, context: Context) {
  return guarded("POST", request, context);
}
export function PUT(request: Request, context: Context) {
  return guarded("PUT", request, context);
}
export function DELETE(request: Request, context: Context) {
  return guarded("DELETE", request, context);
}
export function PATCH(request: Request, context: Context) {
  return guarded("PATCH", request, context);
}
