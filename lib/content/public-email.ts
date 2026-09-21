const EMAIL_ADDRESS = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type PublicEmailLinkOptions = {
  email: string;
  label?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Markup for a public mailto that Cloudflare must leave untouched.
 * The comments deliberately surround the whole anchor, including its href.
 */
export function publicEmailLinkMarkup({ email, label = email, className, ariaLabel }: PublicEmailLinkOptions): string {
  const safeLabel = escapeHtml(label);
  if (!EMAIL_ADDRESS.test(email)) return `<!--email_off-->${safeLabel}<!--/email_off-->`;

  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  const ariaAttribute = ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : "";
  const safeEmail = escapeHtml(email);
  return `<!--email_off--><a href="mailto:${safeEmail}" dir="ltr"${classAttribute}${ariaAttribute}>${safeLabel}</a><!--/email_off-->`;
}
