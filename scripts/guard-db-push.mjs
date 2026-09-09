// حارس db:push: يقرأ DATABASE_URL (كما يقرؤها drizzle-kit من .env.local) ويرفض أي مضيف غير محلي.
// الإنتاج يُرحَّل بترحيلات drizzle/ عبر scripts/migrate-db.mjs — لا db:push أبدًا.
import { pathToFileURL } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** صحيح فقط لعنوان صالح مضيفه محلي؛ الفارغ أو التالف مرفوض. */
export function isLocalDatabaseUrl(url) {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** يعيد 0 عند السماح و1 عند الرفض مع الرسالة العربية على stderr. */
export function guardDbPush(url, { log = console.log, error = console.error } = {}) {
  if (!url) {
    error("db:push: DATABASE_URL غير مضبوط في .env.local — اضبطه على قاعدة محلية (localhost) أولًا.");
    return 1;
  }
  if (!isLocalDatabaseUrl(url)) {
    let host = "(غير قابل للقراءة)";
    try { host = new URL(url).hostname; } catch { /* عنوان تالف */ }
    error(
      `db:push مرفوض: المضيف «${host}» ليس localhost/127.0.0.1.\n` +
        "ممنوع دفع المخطط مباشرة إلى Neon أو أي قاعدة بعيدة. للإنتاج: ترحيل مرقّم في drizzle/ ثم\n" +
        "  npm run db:push:prod   # يطبع خطوات الترحيل المعتمدة",
    );
    return 1;
  }
  log(`db:push: المضيف محلي (${new URL(url).hostname}) — يتابع.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(guardDbPush(process.env.DATABASE_URL ?? ""));
}
