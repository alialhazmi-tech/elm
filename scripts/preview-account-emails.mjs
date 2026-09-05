import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  renderAccountEmail,
  escapeEmailHtml,
} from "../lib/membership/email/templates.ts";

const output = path.resolve(process.argv[2] ?? "outputs/account-emails");
await mkdir(output, { recursive: true });
const kinds = [
  "reset-link",
  "verify-otp",
  "welcome",
  "password-changed",
  "verify-link",
  "reset-otp",
  "signin-otp",
  "signin-link",
];
const rows = [];
for (const kind of kinds) {
  const email = renderAccountEmail({
    kind,
    name: "علي",
    otp: "123456",
    actionUrl: `https://alelm.net/join/reset?token=preview-only-not-valid`,
    issuedAt: "2026-09-05T08:00:00Z",
    expiresAt: "2026-09-05T09:00:00Z",
    changedAt: "2026-09-05T08:00:00Z",
  });
  await writeFile(path.join(output, `${kind}.html`), email.html);
  await writeFile(
    path.join(output, `${kind}.txt`),
    `${email.subject}\n\n${email.text}`,
  );
  rows.push(
    `<li><a href="${kind}.html">${escapeEmailHtml(email.subject)}</a> <small>${["reset-link", "verify-otp", "welcome", "password-changed"].includes(kind) ? "للإطلاق بعد ربط البريد" : "نموذج اختياري"}</small></li>`,
  );
}
await writeFile(
  path.join(output, "index.html"),
  `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>رسائل عضوية العلم</title><body style="max-width:800px;margin:50px auto;padding:20px;font:18px Tahoma;line-height:2;background:#f7f5f1;color:#18232d"><h1>رسائل عضوية العلم</h1><p>النصوص المعتمدة — معاينة ببيانات تجريبية. لا ترسل بريدًا، والروابط والرموز غير صالحة للاستخدام.</p><ul>${rows.join("")}</ul></body></html>`,
);
console.log(output);
