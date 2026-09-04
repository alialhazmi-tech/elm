import { brandSharingImage } from "@/lib/brand-sharing-image";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const bytes = await brandSharingImage();
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "image/jpeg",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "X-Content-Type-Options": "nosniff",
  } });
}
