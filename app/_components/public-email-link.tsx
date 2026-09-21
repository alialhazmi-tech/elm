import { publicEmailLinkMarkup, type PublicEmailLinkOptions } from "@/lib/content/public-email";

/** رابط بريد عام محاط بعلامات Cloudflare التي تمنع إعادة كتابة mailto إلى مسار 404. */
export function PublicEmailLink(props: PublicEmailLinkOptions) {
  return <span dangerouslySetInnerHTML={{ __html: publicEmailLinkMarkup(props) }} />;
}
