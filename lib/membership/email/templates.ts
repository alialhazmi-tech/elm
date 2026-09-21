export const EMAIL_ORIGIN = "https://alelm.net";
export type AccountEmailKind =
  | "reset-link"
  | "staff-reset-link"
  | "verify-otp"
  | "verify-link"
  | "reset-otp"
  | "signin-otp"
  | "signin-link"
  | "welcome"
  | "password-changed";
export type AccountEmailInput = {
  kind: AccountEmailKind;
  name?: string;
  otp?: string;
  actionUrl?: string;
  issuedAt?: string;
  expiresAt?: string;
  changedAt?: string;
};
export type RenderedAccountEmail = {
  subject: string;
  html: string;
  text: string;
};

export function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

// Event timestamps keep retries byte-identical for the delivery idempotency key.
export function emailValidity(issuedAt?: string, expiresAt?: string): string {
  const seconds = Math.floor(
    (Date.parse(expiresAt ?? "") - Date.parse(issuedAt ?? "")) / 1000,
  );
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error("INVALID_EMAIL_EXPIRY");
  if (seconds < 60) return "أقل من دقيقة";
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "دقيقة واحدة";
  if (minutes === 2) return "دقيقتين";
  if (minutes === 60) return "ساعة واحدة";
  if (minutes === 120) return "ساعتين";
  return `${minutes} ${minutes <= 10 ? "دقائق" : "دقيقة"}`;
}

function safeActionUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== EMAIL_ORIGIN || url.username || url.password)
    throw new Error("INVALID_EMAIL_LINK");
  return url.href;
}

export function renderAccountEmail(
  input: AccountEmailInput,
): RenderedAccountEmail {
  const { kind } = input;
  let subject: string;
  let paragraphs: string[];
  let button = "";
  let url = input.actionUrl;
  const timed = kind !== "welcome" && kind !== "password-changed";
  const duration = timed ? emailValidity(input.issuedAt, input.expiresAt) : "";
  switch (kind) {
    case "reset-link":
    case "staff-reset-link":
      subject = kind === "staff-reset-link" ? "استعادة كلمة المرور لحسابك في تحرير العلم" : "إعادة تعيين كلمة المرور لحسابك في العلم";
      paragraphs = [
        kind === "staff-reset-link" ? "تلقّينا طلبًا لاستعادة كلمة المرور لحساب الإدارة والتحرير. اضغط الزر لاختيار كلمة جديدة. سيبقى التحقق الثنائي مفعّلًا إذا كان مفعّلًا لحسابك." : "تلقّينا طلبًا لإعادة تعيين كلمة المرور لحسابك في العلم. اضغط الزر التالي لاختيار كلمة مرور جديدة.",
        `تنتهي صلاحية هذا الرابط خلال ${duration}.`,
        "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة. لن تتغير كلمة مرورك دون إتمام الخطوات.",
      ];
      button = "إعادة تعيين كلمة المرور";
      break;
    case "verify-otp":
      subject = "رمز توثيق بريدك الإلكتروني في العلم";
      paragraphs = [
        "لتوثيق بريدك الإلكتروني وربطه بحسابك في العلم، أدخل الرمز التالي في صفحة توثيق البريد الإلكتروني:",
        `تنتهي صلاحية الرمز خلال ${duration}. لا تشاركه مع أي شخص.`,
        "إذا لم تطلب توثيق البريد، يمكنك تجاهل هذه الرسالة.",
      ];
      break;
    case "verify-link":
      subject = "أكّد بريدك الإلكتروني في العلم";
      paragraphs = [
        "اضغط الزر التالي لتأكيد أن هذا البريد يخصك وتوثيقه في حسابك.",
        `تنتهي صلاحية الرابط خلال ${duration}.`,
        "إذا لم تنشئ حسابًا أو تطلب توثيق هذا البريد، يمكنك تجاهل الرسالة.",
      ];
      button = "توثيق البريد الإلكتروني";
      break;
    case "reset-otp":
      subject = "رمز إعادة تعيين كلمة المرور في العلم";
      paragraphs = [
        "استخدم الرمز التالي لإكمال طلب إعادة تعيين كلمة المرور لحسابك:",
        `أدخله في صفحة استعادة كلمة المرور على موقع العلم. تنتهي صلاحيته خلال ${duration}.`,
        "لا تشارك الرمز مع أي شخص. إذا لم تطلب تغيير كلمة المرور، يمكنك تجاهل الرسالة.",
      ];
      break;
    case "signin-otp":
      subject = "رمز دخولك إلى العلم";
      paragraphs = [
        "أدخل الرمز التالي لإكمال تسجيل الدخول إلى حسابك في العلم:",
        `تنتهي صلاحية الرمز خلال ${duration}. لا تشاركه مع أي شخص، حتى لو ادّعى أنه من فريق العلم.`,
        "إذا لم تحاول تسجيل الدخول، تجاهل هذه الرسالة.",
      ];
      break;
    case "signin-link":
      subject = "رابط دخولك إلى العلم";
      paragraphs = [
        "اضغط الزر التالي للدخول إلى حسابك في العلم.",
        `هذا الرابط خاص بك. تنتهي صلاحيته خلال ${duration}، فلا تشاركه مع أي شخص.`,
        "إذا لم تطلب تسجيل الدخول، يمكنك تجاهل الرسالة.",
      ];
      button = "تسجيل الدخول";
      break;
    case "welcome":
      subject = "أهلًا بك في العلم";
      paragraphs = [
        "أهلًا بك في العلم. أصبح بريدك الإلكتروني موثّقًا، وحسابك جاهزًا.",
        "اختر اهتماماتك، واحفظ المواد التي تود العودة إليها، وتابع قراءاتك من ملفك الشخصي.",
        "نتمنى لك قراءة ممتعة ومعرفة أوسع.",
      ];
      button = "انتقل إلى حسابك";
      url = `${EMAIL_ORIGIN}/account`;
      break;
    case "password-changed": {
      const date = new Date(input.changedAt ?? "");
      if (!Number.isFinite(date.getTime()))
        throw new Error("INVALID_CHANGE_DATE");
      const day = date.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
        timeZone: "Asia/Riyadh",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const time = date.toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      });
      subject = "تم تغيير كلمة المرور لحسابك في العلم";
      paragraphs = [
        `تم تغيير كلمة المرور لحسابك في العلم بتاريخ ${day}، الساعة ${time} بتوقيت السعودية.`,
        "إذا أجريت هذا التغيير، فلا يلزمك اتخاذ أي إجراء.",
        "إذا لم تُجرِه، أعد تعيين كلمة المرور فورًا وتواصل معنا للمساعدة.",
      ];
      button = "استعادة الوصول إلى حسابك";
      url = `${EMAIL_ORIGIN}/join?mode=forgot`;
      break;
    }
  }
  const otp = kind.endsWith("-otp") ? input.otp : undefined;
  if (kind.endsWith("-otp") && !/^\d{6}$/.test(otp ?? ""))
    throw new Error("INVALID_EMAIL_OTP");
  if (button) url = safeActionUrl(url ?? "");
  const name = input.name?.trim().slice(0, 80);
  const greeting = name ? `مرحبًا ${name}،` : "مرحبًا،";
  const footer = [
    "العلم — المعرفة وراء الخبر",
    "هذه رسالة تتعلق بحسابك في العلم.",
    `للمساعدة: تواصل معنا — ${EMAIL_ORIGIN}/contact`,
  ];
  const fallback = "إذا لم يعمل الزر، انسخ الرابط التالي وافتحه في متصفحك:";
  const e = escapeEmailHtml;
  const p = (text: string) =>
    `<p style="margin:0 0 20px;line-height:1.9">${e(text)}</p>`;
  const action = button
    ? `<table role="presentation" style="margin:28px 0;border-collapse:collapse"><tr><td bgcolor="#204780" style="border-radius:10px;text-align:center"><a href="${e(url!)}" style="display:inline-block;padding:15px 25px;color:#ffffff;text-decoration:none;font-weight:bold">${e(button)}</a></td></tr></table>`
    : "";
  const code = otp
    ? `<p dir="ltr" style="margin:28px 0;padding:20px;background:#f2f5fa;border-radius:12px;text-align:center;font:700 34px monospace;letter-spacing:8px;color:#204780">${otp}</p>`
    : "";
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(subject)}</title></head><body style="margin:0;background:#f7f5f1;font-family:Tahoma,Arial,sans-serif;color:#18232d"><table role="presentation" dir="rtl" width="100%" style="padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #e6e1d9;border-radius:18px"><tr><td dir="rtl" style="padding:32px 24px;text-align:right;font-size:16px"><a href="${EMAIL_ORIGIN}" style="display:inline-block;text-decoration:none;background:#204780;padding:14px 18px;border-radius:8px;margin-bottom:24px"><img src="${EMAIL_ORIGIN}/brand/alelm-logo-light.png" width="120" alt="العلم — Al Elm" style="display:block;width:120px;height:auto;border:0"></a><h1 style="font-size:24px;line-height:1.6;margin:0 0 28px">${e(subject)}</h1>${p(greeting)}${p(paragraphs[0])}${code}${kind !== "welcome" ? action : ""}${paragraphs
    .slice(1, kind === "welcome" ? 2 : undefined)
    .map(p)
    .join(
      "",
    )}${kind === "welcome" ? action + p(paragraphs[2]) : ""}${button ? `<div style="border-top:1px solid #eee8df;margin-top:28px;padding-top:20px;font-size:13px;color:#637083">${p(fallback)}<p dir="ltr" style="text-align:left;overflow-wrap:anywhere;word-break:break-all"><a href="${e(url!)}" style="color:#204780">${e(url!)}</a></p></div>` : ""}<div style="border-top:1px solid #eee8df;margin-top:28px;padding-top:24px;font-size:13px;color:#637083">${p(footer[0])}${p(footer[1])}<a href="${EMAIL_ORIGIN}/contact" style="color:#204780">للمساعدة: تواصل معنا</a></div></td></tr></table></td></tr></table></body></html>`;
  const text = [
    greeting,
    paragraphs[0],
    otp,
    kind !== "welcome" && button ? `${button}: ${url}` : "",
    ...paragraphs.slice(1, kind === "welcome" ? 2 : undefined),
    kind === "welcome" ? `${button}: ${url}\n\n${paragraphs[2]}` : "",
    button ? `${fallback}\n${url}` : "",
    ...footer,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}
