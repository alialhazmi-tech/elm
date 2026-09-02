import { InfographicStudio } from "@/components/tahrir/infographic/infographic-studio";

export const metadata = { title: "استوديو الإنفوجرافيك" };

export default function InfographicsPage() {
  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">استوديو الإنفوجرافيك</h1>
        <span className="text-xs text-muted-foreground">تجربة بصرية تفاعلية من أي تقرير — وصور حقيقية بنقرة</span>
      </div>
      <InfographicStudio />
    </main>
  );
}
