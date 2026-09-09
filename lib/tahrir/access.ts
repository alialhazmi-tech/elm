/**
 * حلّ الصلاحيات الفعلية للجلسة — «الحارس الموحّد» لكل مسارات API وشاشات اللوحة.
 *
 * الرمز الموقَّع يحمل هوية العضو فقط؛ الدور والحالة يُقرآن من القاعدة عند كل طلب (بحث بمفتاح أساسي)
 * فيسري تغيير الدور والتعليق فورًا. خريطة «دور → صلاحيات» صغيرة وتُقرأ بكاش 30 ثانية، وأي تعديل
 * من شاشة الأدوار يُسقطها في العملية نفسها (على Workers لكل isolate كاشه — يلحق خلال 30 ثانية).
 */

import { cache } from "react";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { rolePermissions, roles, userPermissions, users } from "@/db/schema";
import { getDb } from "@/lib/db";

import { getSession } from "./auth";
import {
  hasPermission,
  LEGACY_ROLE_MAP,
  resolvePermissions,
  WILDCARD,
  type OverrideEffect,
} from "./permissions";
import { mfaConfigured } from "./totp";

/**
 * صلاحيات الإدارة التي تستوجب التحقق بخطوتين: من يملك إحداها بلا سرّ MFA يُحوَّل إلى «أمان الحساب»
 * وتُرفض طلباته إلى API حتى يفعّله. الإلزام معطّل افتراضيًا ولا يسري إلا بـ TAHRIR_MFA_ENFORCE=1 مع مفتاح
 * التشفير مضبوطًا — بلا المفتاح لا يستطيع أحد التفعيل أصلًا فيُقفل كل مسؤول خارج اللوحة.
 */
/** الإلزام اختياري بقرار المالك (2026-09-09): لا يسري إلا بـ TAHRIR_MFA_ENFORCE=1 صراحةً مع مفتاح MFA مضبوط. */
export function mfaEnforcementEnabled(): boolean {
  return process.env.TAHRIR_MFA_ENFORCE === "1" && mfaConfigured();
}

export const MFA_REQUIRED_PERMISSIONS = [WILDCARD, "users.manage", "roles.manage"] as const;
export const MFA_REQUIRED_MESSAGE = "فعّل التحقق بخطوتين من «أمان الحساب» أولًا — إلزامي لحسابات الإدارة.";

export interface RoleInfo {
  id: string;
  label: string;
  description: string;
  isSystem: boolean;
  position: number;
  permissions: Set<string>;
}

const ROLE_CACHE_MS = 30_000;
let roleCache: { at: number; map: Map<string, RoleInfo> } | null = null;

/** يُستدعى بعد أي كتابة في roles أو role_permissions. */
export function invalidateRoleCache() {
  roleCache = null;
}

export async function loadRoleMap(): Promise<Map<string, RoleInfo>> {
  if (roleCache && Date.now() - roleCache.at < ROLE_CACHE_MS) return roleCache.map;
  const db = getDb();
  if (!db) return new Map();

  const [roleRows, permissionRows] = await Promise.all([
    db.select().from(roles),
    db.select().from(rolePermissions),
  ]);
  const map = new Map<string, RoleInfo>();
  for (const row of roleRows) {
    map.set(row.id, {
      id: row.id,
      label: row.label,
      description: row.description,
      isSystem: row.isSystem === 1,
      position: row.position,
      permissions: new Set(),
    });
  }
  for (const row of permissionRows) map.get(row.roleId)?.permissions.add(row.permissionKey);
  roleCache = { at: Date.now(), map };
  return map;
}

export interface Actor {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  roleLabel: string;
  mustChangePassword: boolean;
  /** التحقق بخطوتين مفعّل على الحساب. */
  mfaEnabled: boolean;
  /** حساب إداري بلا تحقق بخطوتين والمفتاح مضبوط — يُحجب عن كل شيء عدا تفعيله. */
  mfaRequired: boolean;
  permissions: Set<string>;
  can(key: string): boolean;
}

/**
 * الفاعل الحالي: الجلسة + صف العضو الحي + صلاحياته المحلولة.
 * null عند غياب الجلسة أو تعليق العضوية أو حذفها — والطبقة العليا تعيد إلى الدخول.
 * مغلّف بـ cache() فيتشاركه الـlayout والصفحة في الرندر الواحد.
 */
export const loadActor = cache(async (): Promise<Actor | null> => {
  const session = await getSession();
  if (!session) return null;
  const db = getDb();
  if (!db) return null;

  const [userRows, overrideRows, roleMap] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.userId)).limit(1),
    db.select().from(userPermissions).where(eq(userPermissions.userId, session.userId)),
    loadRoleMap(),
  ]);
  const user = userRows[0];
  if (!user || (session.sessionVersion ?? 0) !== user.sessionVersion || user.status !== "active") return null;

  const roleId = LEGACY_ROLE_MAP[user.role] ?? user.role;
  const role = roleMap.get(roleId);
  const permissions = resolvePermissions(
    role?.permissions ?? [],
    overrideRows.map((row) => ({ permissionKey: row.permissionKey, effect: row.effect as OverrideEffect })),
  );

  const mfaEnabled = Boolean(user.mfaSecret);
  const mfaRequired = !mfaEnabled && mfaEnforcementEnabled() && MFA_REQUIRED_PERMISSIONS.some((key) => permissions.has(key));

  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: roleId,
    roleLabel: role?.label ?? roleId,
    mustChangePassword: user.mustChangePassword === 1,
    mfaEnabled,
    mfaRequired,
    permissions,
    can: (key) => hasPermission(permissions, key),
  };
});

const mfaRequiredResponse = () =>
  NextResponse.json({ error: MFA_REQUIRED_MESSAGE, mfaRequired: true }, { status: 403 });

export type Gate = { ok: true; actor: Actor } | { ok: false; response: NextResponse };

/**
 * بوابة مسارات API: 401 بلا جلسة حية، و403 بلا الصلاحية. الاستعمال:
 *   const gate = await requirePermission("story.publish");
 *   if (!gate.ok) return gate.response;
 */
export async function requirePermission(key: string, forbiddenMessage?: string): Promise<Gate> {
  const actor = await loadActor();
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 }) };
  }
  if (actor.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json({ error: "غيّر كلمة المرور المؤقتة أولًا." }, { status: 403 }),
    };
  }
  if (actor.mfaRequired) return { ok: false, response: mfaRequiredResponse() };
  if (!actor.can(key)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: forbiddenMessage ?? "ليست لديك صلاحية هذا الإجراء.", permission: key },
        { status: 403 },
      ),
    };
  }
  return { ok: true, actor };
}

/**
 * بوابة الجلسة فقط (بلا صلاحية بعينها) — للمسارات المفتوحة لكل عضو فعّال.
 * allowMissingMfa لمسارات الحساب التي يحتاجها المسؤول ليفعّل التحقق بخطوتين أصلًا (mfa، password).
 */
export async function requireActor(options: { allowTemporaryPassword?: boolean; allowMissingMfa?: boolean } = {}): Promise<Gate> {
  const actor = await loadActor();
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 }) };
  }
  if (actor.mustChangePassword && !options.allowTemporaryPassword) {
    return { ok: false, response: NextResponse.json({ error: "غيّر كلمة المرور المؤقتة أولًا." }, { status: 403 }) };
  }
  if (actor.mfaRequired && !options.allowMissingMfa) return { ok: false, response: mfaRequiredResponse() };
  return { ok: true, actor };
}

/**
 * بوابة الشاشات — requireScreen — تعيش في ./screen.ts: تحتاج next/navigation ومكوّن «بلا صلاحية»،
 * وهذا الملف يُحزَم في مسارات API وحزم الاختبار المعزولة فلا يحمل واجهة.
 */
/**
 * تحرير مادة: صاحبها بـ story.edit.own، وغيره بـ story.edit.any.
 * الملكية بمعرف المستخدم الثابت؛ الاسم المعروض ليس إثبات ملكية.
 */
export function canEditStory(actor: Actor, story: { authorId: string | null; assignedTo?: string | null } | null): boolean {
  if (actor.mustChangePassword) return false;
  if (story && actor.can("story.edit.any")) return true;
  if (!story) return actor.can("story.create");
  return actor.can("story.edit.own") && (story.authorId === actor.userId || story.assignedTo === actor.userId);
}
