import { JAK_SANDBOX } from "@/lib/jak-report-document";

/** A viewport-height frame preserves the report's own scrolling and sticky scenes. */
export function JakCodeFrame({ id, title }: { id: string; title: string }) {
  return <iframe
    id="jak-report-frame"
    className="jak-reader-frame"
    src={`/api/jak-reports/${encodeURIComponent(id)}/document`}
    title={title}
    sandbox={JAK_SANDBOX}
    referrerPolicy="no-referrer"
  />;
}
