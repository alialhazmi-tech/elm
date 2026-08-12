import { contentSource, getBreaking, seedContentProvider } from "@/lib/content/provider";
import { MOBILE_HOME_CONTRACT, toMobileHome } from "@/lib/mobile/home";

export async function GET() {
  const [home, breaking] = await Promise.all([seedContentProvider.getHome(), getBreaking()]);
  const payload = toMobileHome(home, breaking);

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "X-Content-Contract": MOBILE_HOME_CONTRACT,
      "X-Content-Source": await contentSource(),
    },
  });
}
