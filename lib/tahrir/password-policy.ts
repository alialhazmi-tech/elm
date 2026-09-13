export const STAFF_PASSWORD_MIN_LENGTH = 15;
export const STAFF_PASSWORD_MAX_LENGTH = 512;
export const STAFF_PASSWORD_HELP = "من 15 إلى 512 محرفًا. اختر عبارة مرور طويلة وفريدة؛ لا يُشترط خلط أنواع الحروف.";
// قائمة محلية أولية للقيم الشائعة؛ ليست ادعاءً بفحص جميع كلمات المرور المسرّبة.
const COMMON_PASSWORDS = new Set([
  "123456789012345", "1234567890123456", "12345678901234567890", "123456789123456789",
  "passwordpassword", "passwordpasswordpassword", "password123456789", "password1234567890",
  "qwertyuiopasdfgh", "qwertyuiopasdfghjkl", "qwertyuiop123456789", "123456789qwertyuiop",
  "iloveyouiloveyou", "letmeinletmeinletmein", "adminadminadmin", "administrator123",
  "changemechangeme", "welcome123456789", "000000000000000", "111111111111111",
  "كلمةالمروركلمةالمرور",
]);
/** الفحص لا يغيّر كلمة المرور التي ستُجزّأ، ولا يرسلها إلى طرف خارجي. */
export function staffPasswordError(password: unknown): string | null {
  if (typeof password !== "string" || password.length > STAFF_PASSWORD_MAX_LENGTH) return "كلمة المرور لا تتجاوز 512 محرفًا.";
  if ([...password].length < STAFF_PASSWORD_MIN_LENGTH) return "كلمة المرور 15 محرفًا على الأقل.";
  const comparable = password.normalize("NFKC").trim().toLowerCase();
  if (!comparable || COMMON_PASSWORDS.has(comparable)) return "كلمة المرور شائعة وسهلة التخمين. اختر عبارة مرور أخرى فريدة.";
  return null;
}

/** كلمة مؤقتة عشوائية من 20 محرفًا؛ مشتركة بين الإدارة وأداة الاستيراد. */
export function generateStaffTemporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const limit = 256 - (256 % alphabet.length);
  let password = "";
  while (password.length < 20) {
    for (const value of crypto.getRandomValues(new Uint8Array(32))) {
      if (value < limit) password += alphabet[value % alphabet.length];
      if (password.length === 20) break;
    }
  }
  return password;
}
