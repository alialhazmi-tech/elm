import { notFound } from "next/navigation";

import { InteractiveInfographic } from "@/app/_components/interactive-infographic";
import { getBlueEconomyPreset } from "@/lib/ai/infographic";

export const metadata = {
  title: "اقتصاد المدّ الأزرق | إنفوجرافيك تفاعلي - العلم",
  description: "تقرير بصري متحرك وتفاعلي يوضح آفاق ومستهدفات الاستزراع المائي والثروة السمكية في المملكة العربية السعودية ضمن رؤية 2030.",
};

export default function InfographicPublicPage() {
  // كنموذج أولي نعرض الإنفوجرافيك الافتراضي التفاعلي
  const infographic = getBlueEconomyPreset();

  if (!infographic) notFound();

  return (
    <div className="min-h-screen w-full bg-[#021224]">
      <InteractiveInfographic data={infographic} enableControls={true} />
    </div>
  );
}
