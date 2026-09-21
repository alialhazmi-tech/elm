import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL ?? "https://auth-not-configured.invalid";
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET ?? "membership-auth-build-placeholder-32-chars";

/** عضوية الجمهور فقط — مستقلة تمامًا عن جلسة ومستخدمي «تحرير العلم». */
export const memberAuthConfigured = Boolean(
  process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET,
);

export const memberAuth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sessionDataTtl: 300,
    sameSite: "lax",
  },
  logLevel: "warn",
});
