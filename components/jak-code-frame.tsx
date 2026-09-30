import { JAK_SANDBOX } from "@/lib/jak-report-document";

/** A viewport-height frame preserves the report's own scrolling and sticky scenes. */
export function JakCodeFrame({ id, title }: { id: string; title: string }) {
  return <iframe
    src={`/api/jak-reports/${encodeURIComponent(id)}/document`}
    title={title}
    sandbox={JAK_SANDBOX}
    referrerPolicy="no-referrer"
    style={{ width: "100%", height: "calc(100dvh - 100px)", minHeight: 520, border: 0, display: "block", background: "#080b12" }}
  />;
}
