import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";

const handlers = memberAuth.handler();

function unavailable() {
  return Response.json(
    { error: "خدمة العضوية غير مهيأة في هذه البيئة." },
    { status: 503 },
  );
}

type Context = { params: Promise<{ path: string[] }> };

export function GET(request: Request, context: Context) {
  return memberAuthConfigured ? handlers.GET(request, context) : unavailable();
}

export function POST(request: Request, context: Context) {
  return memberAuthConfigured ? handlers.POST(request, context) : unavailable();
}

export function PUT(request: Request, context: Context) {
  return memberAuthConfigured ? handlers.PUT(request, context) : unavailable();
}

export function DELETE(request: Request, context: Context) {
  return memberAuthConfigured ? handlers.DELETE(request, context) : unavailable();
}

export function PATCH(request: Request, context: Context) {
  return memberAuthConfigured ? handlers.PATCH(request, context) : unavailable();
}
