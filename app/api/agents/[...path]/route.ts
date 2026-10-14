import { agentAccessGateway } from "@/lib/agents/access-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => agentAccessGateway(request);
export const POST = (request: Request) => agentAccessGateway(request);
